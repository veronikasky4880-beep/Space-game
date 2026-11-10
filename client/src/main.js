import { createLoop } from "./loop.js";
import { createInput } from "./input.js";
import { 
  World, 
  Ship, 
  Asteroid, 
  Pickup, 
  resolveCollisions, 
  encodeInput, 
  decodeSnapshot 
} from "shared";
import { setupCanvas } from "./render/canvas.js";
import { drawWorld } from "./render/draw.js";
import { loadAll, fetchJson } from "./assets/loader.js";
import { soundSystem } from "./audio.js";
import { Lobby } from "./lobby.js";

if (window.__GAME_LOOP__) {
  window.__GAME_LOOP__.stop();
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const canvas = document.getElementById("game");
const ctx = setupCanvas(canvas, GAME_WIDTH, GAME_HEIGHT);
const input = createInput(window);

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const world = new World();
let score = 0;
let loadedAssets = null;
let ship = null;
let respawnTimer = 0;

const lobbyUI = document.getElementById("lobby-ui");
const roomsListEl = document.getElementById("rooms-list");
const playerNameInput = document.getElementById("player-name");
const lobby = new Lobby();

// Мережевий стан для Prediction / Reconciliation (Lab 05)
let inputSeq = 0;
const pendingInputs = [];
let myPlayerId = null;
const remoteShips = new Map(); // id -> { prevPos, targetPos, lastUpdate }

// Netgraph показники
let rtt = 0;
let snapshotAge = 0;
let bytesReceived = 0;
let bytesSent = 0;
let lastBytesReset = performance.now();
let bytesInPerSec = 0;
let bytesOutPerSec = 0;
let lastCorrectionMag = 0;

// Обробка бінарних знімків від сервера
lobby.addEventListener("binarySnapshot", (e) => {
  const buffer = e.detail;
  bytesReceived += buffer.byteLength;
  snapshotAge = performance.now();

  const snapshot = decodeSnapshot(buffer);
  const ackSeq = snapshot.lastAckSeq;

  // Очищаємо підтверджені сервером інпути
  while (pendingInputs.length > 0 && pendingInputs[0].seq <= ackSeq) {
    pendingInputs.shift();
  }

  // Оновлюємо сутності
  for (const snapEntity of snapshot.entities) {
    if (ship && snapEntity.id === myPlayerId) {
      // Reconciliation: перевіряємо розбіжність позиції
      const dx = snapEntity.x - ship.pos.x;
      const dy = snapEntity.y - ship.pos.y;
      lastCorrectionMag = Math.hypot(dx, dy);

      // Встановлюємо авторитетну позицію сервера
      ship.pos.x = snapEntity.x;
      ship.pos.y = snapEntity.y;
      ship.rot = snapEntity.angle;

      // Replay: повторно застосовуємо непідтверджені інпути
      for (const pending of pendingInputs) {
        ship.integrate(pending.inputState, 1 / 60);
      }
    } else {
      // Інтерполяція для чужих кораблів
      if (!remoteShips.has(snapEntity.id)) {
        remoteShips.set(snapEntity.id, {
          prevPos: { x: snapEntity.x, y: snapEntity.y, rot: snapEntity.angle },
          targetPos: { x: snapEntity.x, y: snapEntity.y, rot: snapEntity.angle },
          lastUpdate: performance.now()
        });
      } else {
        const remote = remoteShips.get(snapEntity.id);
        remote.prevPos = { ...remote.targetPos };
        remote.targetPos = { x: snapEntity.x, y: snapEntity.y, rot: snapEntity.angle };
        remote.lastUpdate = performance.now();
      }
    }
  }
});

// Ініціалізація об'єктів у світові гри
function initGameWorld() {
  world.clear();
  ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));
  if (myPlayerId) ship.id = myPlayerId;

  for (let i = 0; i < 4; i++) {
    let x = Math.random() * GAME_WIDTH;
    let y = Math.random() * GAME_HEIGHT;
    while (Math.hypot(x - GAME_WIDTH / 2, y - GAME_HEIGHT / 2) < 150) {
      x = Math.random() * GAME_WIDTH;
      y = Math.random() * GAME_HEIGHT;
    }
    world.spawn(new Asteroid(x, y));
  }

  world.spawn(new Pickup(200, 200));
}

// Головний ігровий цикл
const loop = createLoop({
  step: 1 / 60,
  simulate: (dt) => {
    // 1. Надсилання бінарних вхідних команд (Input)
    if (lobby.socket && lobby.socket.readyState === 1) {
      inputSeq++;
      const thrust = input.isDown("KeyW") || input.isDown("ArrowUp");
      let turn = 0;
      if (input.isDown("KeyA") || input.isDown("ArrowLeft")) turn = -1;
      if (input.isDown("KeyD") || input.isDown("ArrowRight")) turn = 1;
      const fire = input.justPressed("Space");

      const inputBuffer = encodeInput(inputSeq, thrust, turn, fire);
      lobby.socket.send(inputBuffer);
      bytesSent += inputBuffer.byteLength;

      const inputState = {
        isDown: (code) => {
          if (code === "KeyW" && thrust) return true;
          if (code === "KeyA" && turn === -1) return true;
          if (code === "KeyD" && turn === 1) return true;
          return false;
        }
      };

      pendingInputs.push({ seq: inputSeq, inputState });

      // Client-Side Prediction: рухаємо свій корабель миттєво локально
      if (ship && ship.alive) {
        ship.integrate(inputState, dt);
      }
    }

    // 2. Локальна симуляція пострілів, спавну астероїдів та фізики
    const asteroidCount = [...world.ofKind("asteroid")].length;
    if (asteroidCount < 4) {
      let x = Math.random() * GAME_WIDTH;
      let y = Math.random() * GAME_HEIGHT;
      if (ship && ship.alive) {
        while (Math.hypot(x - ship.pos.x, y - ship.pos.y) < 150) {
          x = Math.random() * GAME_WIDTH;
          y = Math.random() * GAME_HEIGHT;
        }
      }
      world.spawn(new Asteroid(x, y));
    }

    if (ship && ship.alive) {
      if (input.justPressed("Space")) world.spawn(ship.fire());
      if (input.justPressed("KeyH")) world.spawn(ship.fireHoming());
    } else {
      respawnTimer += dt;
      if (respawnTimer >= 2.0) {
        respawnTimer = 0;
        ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));
        if (myPlayerId) ship.id = myPlayerId;
      }
    }

    // 3. Інтерполяція позицій чужих кораблів
    const now = performance.now();
    for (const [id, remote] of remoteShips.entries()) {
      const progress = Math.min(1, (now - remote.lastUpdate) / 33.3);
      remote.currentX = remote.prevPos.x + (remote.targetPos.x - remote.prevPos.x) * progress;
      remote.currentY = remote.prevPos.y + (remote.targetPos.y - remote.prevPos.y) * progress;
      remote.currentRot = remote.prevPos.rot + (remote.targetPos.rot - remote.prevPos.rot) * progress;
    }

    // Оновлення об'єктів у світі
    for (const e of world) {
      if (e.kind === "bullet") {
        e.update(dt, world);
      } else {
        e.update(dt);
      }

      if (e.pos.x < 0) e.pos.x += GAME_WIDTH;
      if (e.pos.x > GAME_WIDTH) e.pos.x -= GAME_WIDTH;
      if (e.pos.y < 0) e.pos.y += GAME_HEIGHT;
      if (e.pos.y > GAME_HEIGHT) e.pos.y -= GAME_HEIGHT;
    }

    resolveCollisions(world, (pts) => { score += pts; });
    world.sweep();

    // Підрахунок мережевої статистики (bytes/sec)
    if (now - lastBytesReset >= 1000) {
      bytesInPerSec = bytesReceived;
      bytesOutPerSec = bytesSent;
      bytesReceived = 0;
      bytesSent = 0;
      lastBytesReset = now;
    }
  },
  render: (alpha) => {
    drawWorld(ctx, world, alpha, null, score, loadedAssets);

    // Малювання Netgraph поверх гри (Lab 05)
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(10, 10, 230, 110);
    ctx.strokeStyle = "#00ff00";
    ctx.strokeRect(10, 10, 230, 110);

    ctx.fillStyle = "#00ff00";
    ctx.font = "12px monospace";
    ctx.fillText(`Netgraph (Lab 05 Binary)`, 20, 28);
    ctx.fillText(`RTT (Ping): ${Math.round(rtt)} ms`, 20, 46);
    ctx.fillText(`In/Out: ${bytesInPerSec} B/s / ${bytesOutPerSec} B/s`, 20, 64);
    ctx.fillText(`Pending Inputs: ${pendingInputs.length}`, 20, 82);
    ctx.fillText(`Correction Mag: ${lastCorrectionMag.toFixed(2)} px`, 20, 100);
  },
});

window.__GAME_LOOP__ = loop;

// Відображення списку кімнат у DOM
lobby.addEventListener("roomsUpdated", (e) => {
  const rooms = e.detail;
  roomsListEl.innerHTML = "";

  if (rooms.length === 0) {
    roomsListEl.innerHTML = "<div>Немає доступних кімнат</div>";
    return;
  }

  rooms.forEach(room => {
    const div = document.createElement("div");
    div.className = "room-item";
    div.innerHTML = `
      <span>${room.name} (${room.players}/${room.maxPlayers})</span>
      <button data-room="${room.id}">Приєднатися</button>
    `;
    div.querySelector("button").addEventListener("click", () => {
      const name = playerNameInput.value || "Пілот";
      lobby.connectSocket(room.id, name);
    });
    roomsListEl.appendChild(div);
  });
});

// Підтвердження входу в кімнату та старт сесії гри
lobby.addEventListener("joinedRoom", (e) => {
  if (e.detail && e.detail.playerId) {
    myPlayerId = e.detail.playerId;
  }
  lobby.stopPolling();
  lobbyUI.classList.add("hidden");

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  initGameWorld();
  loop.start();
});

// Завантаження ресурсів гри та підготовка лоббі
async function bootGame() {
  try {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "white";
    ctx.font = "20px monospace";
    ctx.fillText("Завантаження ресурсів...", GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2);

    const manifest = await fetchJson(`/manifest.json?t=${Date.now()}`);

    loadedAssets = await loadAll(manifest, audioCtx, {
      onProgress: (percent) => {
        ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = "white";
        ctx.fillText(`Завантаження... ${Math.round(percent * 100)}%`, GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2 - 30);
        ctx.strokeStyle = "white";
        ctx.strokeRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2, 300, 30);
        ctx.fillStyle = "green";
        ctx.fillRect(GAME_WIDTH / 2 - 150, GAME_HEIGHT / 2, 300 * percent, 30);
      }
    });

    soundSystem.init(audioCtx, loadedAssets.sounds);
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    lobby.startPolling();

  } catch (err) {
    console.error("Помилка завантаження ресурсів:", err);
  }
}

bootGame();
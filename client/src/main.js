import { createLoop } from "./loop.js";
import { createInput } from "./input.js";
import { World } from "./sim/world.js";
import { Ship, Asteroid, Pickup } from "./sim/entities.js";
import { resolveCollisions } from "./sim/collision.js";
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

// Ініціалізація об'єктів у світові гри
function initGameWorld() {
  world.clear();
  ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));

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
      ship.integrate(input, dt);
    } else {
      respawnTimer += dt;
      if (respawnTimer >= 2.0) {
        respawnTimer = 0;
        ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));
      }
    }

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
  },
  render: (alpha) => {
    drawWorld(ctx, world, alpha, null, score, loadedAssets);
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
      // Підключаємося до нашого WebSocket-сервера Node.js
      lobby.connectSocket(room.id, name);
    });
    roomsListEl.appendChild(div);
  });
});

// Підтвердження входу в кімнату та старт сесії гри
lobby.addEventListener("joinedRoom", () => {
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
    // Початковий текст на канвасі
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    ctx.fillStyle = "white";
    ctx.font = "20px monospace";
    ctx.fillText("Завантаження ресурсів...", GAME_WIDTH / 2 - 140, GAME_HEIGHT / 2);

    const manifest = await fetchJson(`/manifest.json?t=${Date.now()}`);

    loadedAssets = await loadAll(manifest, audioCtx, {
      onProgress: (percent) => {
        // Зелений індикатор прогресу завантаження
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
    
    // Очищаємо канвас від текстів та смуги завантаження!
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Запускаємо оновлення списку кімнат з сервера
    lobby.startPolling();

  } catch (err) {
    console.error("Помилка завантаження ресурсів:", err);
  }
}

bootGame();
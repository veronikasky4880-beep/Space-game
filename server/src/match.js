import { World, Ship, encodeSnapshot, decodeInput, MSG_TYPES } from "shared";

export class Match {
  constructor(roomId, broadcastFn) {
    this.roomId = roomId;
    this.broadcast = broadcastFn;
    this.world = new World();
    this.tick = 0;
    this.players = new Map(); // socket -> { id, ship, lastSeq, inputQueue }
    this.isRunning = false;
    this.nextTickTime = 0;
    this.timer = null;

    // Ініціалізація точного ігрового циклу 30 Hz (33.33 мс)
    this.TICK_RATE = 30;
    this.TICK_INTERVAL = 1000 / this.TICK_RATE;
  }

  addPlayer(socket, name) {
    const ship = new Ship(400, 300);
    const playerId = Math.floor(Math.random() * 60000) + 1;
    this.world.spawn(ship);

    this.players.set(socket, {
      id: playerId,
      ship,
      lastSeq: 0,
      inputQueue: []
    });

    if (!this.isRunning) {
      this.start();
    }

    return playerId;
  }

  removePlayer(socket) {
    const player = this.players.get(socket);
    if (player) {
      this.world.destroy(player.ship.id);
      this.players.delete(socket);
    }
    if (this.players.size === 0) {
      this.stop();
    }
  }

  handleInput(socket, buffer) {
    const player = this.players.get(socket);
    if (!player) return;

    const inputData = decodeInput(buffer);
    if (inputData.type === MSG_TYPES.INPUT) {
      player.lastSeq = inputData.seq;
      player.inputQueue.push(inputData);
    }
  }

  start() {
    this.isRunning = true;
    this.nextTickTime = performance.now();
    this.tickLoop();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
  }

  tickLoop = () => {
    if (!this.isRunning) return;

    const now = performance.now();
    this.tick++;

    // 1. Застосовуємо команди гравців
    for (const player of this.players.values()) {
      while (player.inputQueue.length > 0) {
        const input = player.inputQueue.shift();
        // Перетворюємо вхідні дані в формат об'єкта input для кораблика
        const inputState = {
          isDown: (code) => {
            if (code === "KeyW" && input.thrust) return true;
            if (code === "KeyA" && input.turn === -1) return true;
            if (code === "KeyD" && input.turn === 1) return true;
            return false;
          }
        };
        player.ship.integrate(inputState, 1 / 60);
      }
    }

    // 2. Симуляція світу
    for (const entity of this.world) {
      entity.update(1 / 30);
    }

    // 3. Формуємо бінарний знімок для кожного гравця
    const entitySnapshots = [];
    for (const entity of this.world) {
      entitySnapshots.push({
        id: entity.id,
        x: entity.pos.x,
        y: entity.pos.y,
        angle: entity.rot || 0
      });
    }

    for (const [socket, player] of this.players.entries()) {
      if (socket.readyState === 1) { // OPEN
        const snapshotBuffer = encodeSnapshot(this.tick, player.lastSeq, entitySnapshots);
        socket.send(snapshotBuffer);
      }
    }

    // Точний таймер проти розсинхронізації (Jitter fix)
    this.nextTickTime += this.TICK_INTERVAL;
    const delay = Math.max(0, this.nextTickTime - performance.now());
    this.timer = setTimeout(this.tickLoop, delay);
  };
}
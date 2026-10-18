import { createLoop } from "./loop.js";
import { createInput } from "./input.js";
import { World } from "./sim/world.js";
import { Ship, Asteroid, Pickup, Particle } from "./sim/entities.js";
import { resolveCollisions } from "./sim/collision.js";
import { setupCanvas } from "./render/canvas.js";
import { drawWorld } from "./render/draw.js";

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;

const canvas = document.getElementById("game");
const ctx = setupCanvas(canvas, GAME_WIDTH, GAME_HEIGHT);
const input = createInput(window);

const world = new World();
let score = 0;

let ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));

// Спав стартові астероїди
for (let i = 0; i < 5; i++) {
  world.spawn(new Asteroid(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT));
}

// Спавн бонус
world.spawn(new Pickup(200, 200));

let respawnTimer = 0;

const loop = createLoop({
  step: 1 / 60,
  simulate: (dt) => {
    // постріли
    if (ship && ship.alive) {
      if (input.justPressed("Space")) {
        world.spawn(ship.fire());
      }
      if (input.justPressed("KeyH")) { // Homing bullet на клавишу H
        world.spawn(ship.fireHoming());
      }
      ship.integrate(input, dt);
    } else if (!ship || !ship.alive) {
      // Респавн через 2 сек
      respawnTimer += dt;
      if (respawnTimer >= 2.0) {
        respawnTimer = 0;
        ship = world.spawn(new Ship(GAME_WIDTH / 2, GAME_HEIGHT / 2));
      }
    }

    // Обновлюємо усі сутности
    for (const e of world) {
      if (e.kind === "bullet") {
        e.update(dt, world);
      } else if (e.kind !== "ship") {
        e.update(dt);
      }

      // Завертання країв
      if (e.pos.x < 0) e.pos = e.pos.add({ x: GAME_WIDTH, y: 0 });
      if (e.pos.x > GAME_WIDTH) e.pos = e.pos.sub({ x: GAME_WIDTH, y: 0 });
      if (e.pos.y < 0) e.pos = e.pos.add({ x: 0, y: GAME_HEIGHT });
      if (e.pos.y > GAME_HEIGHT) e.pos = e.pos.sub({ x: 0, y: GAME_HEIGHT });
    }

    // Проверка коллизії
    resolveCollisions(world, (pts) => { score += pts; });

    // Очистка мертвих об'єктов
    world.sweep();
  },
  render: (alpha, stats) => {
    drawWorld(ctx, world, alpha, stats, score);
  },
});

loop.start();
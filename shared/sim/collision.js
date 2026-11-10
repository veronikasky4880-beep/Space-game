import { emit } from "../events.js";

export function resolveCollisions(world, onScore) {
  const ships = [...world.ofKind("ship")];
  const bullets = [...world.ofKind("bullet")];
  const asteroids = [...world.ofKind("asteroid")];
  const pickups = [...world.ofKind("pickup")];

  // 1. Влучання кулі в астероїд
  for (const bullet of bullets) {
    if (!bullet.alive) continue;
    for (const asteroid of asteroids) {
      if (!asteroid.alive) continue;

      const dist = bullet.pos.dist(asteroid.pos);
      if (dist < bullet.radius + asteroid.radius) {
        bullet.alive = false;
        asteroid.alive = false;

        emit("exploded");
        if (onScore) onScore(100);
        break;
      }
    }
  }

  // 2. Зіткнення корабля з астероїдом
  for (const ship of ships) {
    if (!ship.alive) continue;
    for (const asteroid of asteroids) {
      if (!asteroid.alive) continue;

      const dist = ship.pos.dist(asteroid.pos);
      if (dist < ship.radius + asteroid.radius) {
        ship.takeDamage(25);
        asteroid.alive = false;

        emit("exploded");
        break;
      }
    }
  }

  // 3. Підбір бонуса кораблем (лікування + очки)
  for (const ship of ships) {
    if (!ship.alive) continue;
    for (const pickup of pickups) {
      if (!pickup.alive) continue;

      const dist = ship.pos.dist(pickup.pos);
      if (dist < ship.radius + pickup.radius) {
        pickup.alive = false;
        ship.heal(30); // Відновлюємо 30 HP
        if (onScore) onScore(500);
      }
    }
  }
}
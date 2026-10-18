export function checkCircleCollision(a, b) {
  const dist = a.pos.sub(b.pos).length();
  return dist < a.radius + b.radius;
}

export function resolveCollisions(world, onScore) {
  const entities = [...world];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i];
      const b = entities[j];

      if (!a.alive || !b.alive) continue;

      if (checkCircleCollision(a, b)) {
        // Пуля попала в астероїд
        if ((a.kind === "bullet" && b.kind === "asteroid") || (b.kind === "bullet" && a.kind === "asteroid")) {
          a.alive = false;
          b.alive = false;
          onScore(100);
        }

        // Корабль зіткнувся з астероїдом
        if (a.kind === "ship" && b.kind === "asteroid") {
          a.takeDamage(20);
          b.alive = false;
        } else if (b.kind === "ship" && a.kind === "asteroid") {
          b.takeDamage(20);
          a.alive = false;
        }

        // Корабль підібрав аптечку (Pickup)
        if (a.kind === "ship" && b.kind === "pickup") {
          a.heal(30);
          b.alive = false;
        } else if (b.kind === "ship" && a.kind === "pickup") {
          b.heal(30);
          a.alive = false;
        }
      }
    }
  }
}
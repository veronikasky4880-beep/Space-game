export function createShip(x, y) {
  return { x, y, vx: 0, vy: 0, angle: -Math.PI / 2, thrust: 0 };
}

export function integrate(ship, input, dt) {
  const next = { ...ship };

  const turnSpeed = 4.0;
  if (input.isDown("ArrowLeft")) next.angle -= turnSpeed * dt;
  if (input.isDown("ArrowRight")) next.angle += turnSpeed * dt;

  const acceleration = 400;
  if (input.isDown("ArrowUp")) {
    next.thrust = 1;
    next.vx += Math.cos(next.angle) * acceleration * dt;
    next.vy += Math.sin(next.angle) * acceleration * dt;
  } else {
    next.thrust = 0;
  }

  const friction = Math.pow(0.99, dt * 60);
  next.vx *= friction;
  next.vy *= friction;

  const speed = Math.hypot(next.vx, next.vy);
  const maxSpeed = 500;
  if (speed > maxSpeed) {
    next.vx = (next.vx / speed) * maxSpeed;
    next.vy = (next.vy / speed) * maxSpeed;
  }

  next.x += next.vx * dt;
  next.y += next.vy * dt;

  return next;
}

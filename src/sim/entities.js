import { Entity } from "./entity.js";
import { Vector2 } from "./vector.js";

export class Ship extends Entity {
  #hp = 100;

  constructor(x, y) {
    super(x, y, 15, "ship");
    this.thrust = 0;
  }

  get hp() { return this.#hp; }

  takeDamage(amount) {
    this.#hp = Math.max(0, this.#hp - amount);
    if (this.#hp === 0) this.alive = false;
  }

  heal(amount) {
    this.#hp = Math.min(100, this.#hp + amount);
  }

  integrate(input, dt) {
    const turnSpeed = 4.0;
    if (input.isDown("ArrowLeft")) this.angle -= turnSpeed * dt;
    if (input.isDown("ArrowRight")) this.angle += turnSpeed * dt;

    const acceleration = 400;
    if (input.isDown("ArrowUp")) {
      this.thrust = 1;
      const force = Vector2.fromAngle(this.angle).scale(acceleration * dt);
      this.vel = this.vel.add(force);
    } else {
      this.thrust = 0;
    }

    const friction = Math.pow(0.99, dt * 60);
    this.vel = this.vel.scale(friction);

    if (this.vel.length() > 500) {
      this.vel = this.vel.normalize().scale(500);
    }

    this.update(dt);
  }

  fire() {
    const nosePos = this.pos.add(Vector2.fromAngle(this.angle).scale(15));
    const bulletVel = this.vel.add(Vector2.fromAngle(this.angle).scale(400));
    return new Bullet(nosePos.x, nosePos.y, bulletVel, false);
  }

  fireHoming() {
    const nosePos = this.pos.add(Vector2.fromAngle(this.angle).scale(15));
    const bulletVel = Vector2.fromAngle(this.angle).scale(250);
    return new Bullet(nosePos.x, nosePos.y, bulletVel, true);
  }
}

export class Bullet extends Entity {
  constructor(x, y, vel, isHoming = false) {
    super(x, y, 4, "bullet");
    this.vel = vel;
    // Збільшуємо час життя для самонавідних кулей до 4 секунд, щоб вони встигали долітати
    this.ttl = isHoming ? 4.0 : 2.0; 
    this.isHoming = isHoming;
  }

  update(dt, world) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.alive = false;

    if (this.isHoming && world) {
      let closest = null;
      let minDist = Infinity;
      let targetVector = null;

      for (const ast of world.ofKind("asteroid")) {
        // Враховуємо загортання країв екрана (800x600) для найкоротшого шляху
        let dx = ast.pos.x - this.pos.x;
        let dy = ast.pos.y - this.pos.y;

        if (dx > 400) dx -= 800;
        if (dx < -400) dx += 800;
        if (dy > 300) dy -= 600;
        if (dy < -300) dy += 600;

        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          minDist = d;
          closest = ast;
          targetVector = new Vector2(dx, dy);
        }
      }

      if (closest && targetVector) {
        const targetDir = targetVector.normalize();
        const currentDir = this.vel.normalize();
        
        // Поворот став чутливішим і залежить від dt
        const turnSpeed = Math.min(1.0, 8.0 * dt);
        const newDir = currentDir.scale(1 - turnSpeed).add(targetDir.scale(turnSpeed)).normalize();
        this.vel = newDir.scale(320);
      }
    }

    super.update(dt);
  }
}

export class Asteroid extends Entity {
  constructor(x, y, radius = 25) {
    super(x, y, radius, "asteroid");
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 60;
    this.vel = Vector2.fromAngle(angle).scale(speed);
  }
}

export class Pickup extends Entity {
  constructor(x, y) {
    super(x, y, 12, "pickup");
  }
}

export class Particle extends Entity {
  constructor(x, y) {
    super(x, y, 2, "particle");
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 100;
    this.vel = Vector2.fromAngle(angle).scale(speed);
    this.ttl = 0.5 + Math.random() * 0.3;
  }

  update(dt) {
    this.ttl -= dt;
    if (this.ttl <= 0) this.alive = false;
    super.update(dt);
  }
}
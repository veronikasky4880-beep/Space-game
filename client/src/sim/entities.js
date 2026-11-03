import { emit } from "../events.js";

// Клас вектора для математики координат та напрямку
export class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) { return new Vector(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
  mult(n) { return new Vector(this.x * n, this.y * n); }
  dist(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// Базовий клас для всіх сутностей у грі
export class Entity {
  constructor(x, y, radius, kind, hp = 1) {
    this.pos = new Vector(x, y);
    this.vel = new Vector(0, 0);
    this.radius = radius;
    this.kind = kind;
    this.angle = 0;
    this.alive = true;
    this.hp = hp;
    this.maxHp = hp;
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.hp = 0;
      this.alive = false;
    }
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  update(dt) {
    this.pos = this.pos.add(this.vel.mult(dt));
  }
}

// Клас Корабля
export class Ship extends Entity {
  constructor(x, y) {
    super(x, y, 20, "ship", 100); // 100 HP
    this.rotationSpeed = 4;
    this.thrustPower = 200;
  }

  integrate(input, dt) {
    if (input.isDown("ArrowLeft") || input.isDown("KeyA")) this.angle -= this.rotationSpeed * dt;
    if (input.isDown("ArrowRight") || input.isDown("KeyD")) this.angle += this.rotationSpeed * dt;
    if (input.isDown("ArrowUp") || input.isDown("KeyW")) {
      const dir = new Vector(Math.cos(this.angle), Math.sin(this.angle));
      this.vel = this.vel.add(dir.mult(this.thrustPower * dt));
    }

    // М'яке гальмування
    this.vel = this.vel.mult(0.98);
    this.update(dt);
  }

  fire() {
    emit("fired");
    const bulletX = this.pos.x + Math.cos(this.angle) * this.radius;
    const bulletY = this.pos.y + Math.sin(this.angle) * this.radius;
    return new Bullet(bulletX, bulletY, this.angle, false);
  }

  fireHoming() {
    emit("fired");
    const bulletX = this.pos.x + Math.cos(this.angle) * this.radius;
    const bulletY = this.pos.y + Math.sin(this.angle) * this.radius;
    return new Bullet(bulletX, bulletY, this.angle, true);
  }
}

// Клас Кулі (підтримує автонаведення на астероїди)
export class Bullet extends Entity {
  constructor(x, y, angle, isHoming = false) {
    super(x, y, 4, "bullet", 1);
    this.angle = angle;
    this.speed = 350;
    this.life = 2.0;
    this.isHoming = isHoming;
    this.vel = new Vector(Math.cos(angle) * this.speed, Math.sin(angle) * this.speed);
  }

  update(dt, world) {
    // Автонаведення: шукаємо найближчий астероїд та корегуємо напрямок
    if (this.isHoming && world) {
      let nearestAsteroid = null;
      let minDist = Infinity;

      for (const e of world.ofKind("asteroid")) {
        if (!e.alive) continue;
        const d = this.pos.dist(e.pos);
        if (d < minDist) {
          minDist = d;
          nearestAsteroid = e;
        }
      }

      if (nearestAsteroid) {
        const targetAngle = Math.atan2(
          nearestAsteroid.pos.y - this.pos.y,
          nearestAsteroid.pos.x - this.pos.x
        );

        // Плавний поворот кулі до цілі
        const turnSpeed = 5 * dt;
        let diff = targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;

        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), turnSpeed);
        this.vel = new Vector(Math.cos(this.angle) * this.speed, Math.sin(this.angle) * this.speed);
      }
    }

    super.update(dt);
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }
}

// Клас Астероїда (1 HP — знищується з 1 влучання)
export class Asteroid extends Entity {
  constructor(x, y) {
    super(x, y, 25, "asteroid", 1);
    const randomAngle = Math.random() * Math.PI * 2;
    const randomSpeed = 30 + Math.random() * 50;
    this.vel = new Vector(Math.cos(randomAngle) * randomSpeed, Math.sin(randomAngle) * randomSpeed);
  }
}

// Клас Бонусу (Аптечка)
export class Pickup extends Entity {
  constructor(x, y) {
    super(x, y, 12, "pickup", 1);
  }
}
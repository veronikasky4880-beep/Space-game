import { Vector2 } from "./vector.js";

export class Entity {
  static #nextId = 1;
  #id = Entity.#nextId++;

  constructor(x, y, radius = 10, kind = "entity") {
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(0, 0);
    this.angle = 0;
    this.radius = radius;
    this.kind = kind;
    this.alive = true;
  }

  get id() { return this.#id; }

  update(dt) {
    this.pos = this.pos.add(this.vel.scale(dt));
  }
}
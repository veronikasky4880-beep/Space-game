export class World {
  constructor() {
    this.entities = [];
  }

  spawn(entity) {
    this.entities.push(entity);
    return entity;
  }

  clear() {
    this.entities = []; // Очистка мира при рестарте
  }

  sweep() {
    this.entities = this.entities.filter(e => e.alive);
  }

  *ofKind(kind) {
    for (const e of this.entities) {
      if (e.kind === kind) yield e;
    }
  }

  [Symbol.iterator]() {
    return this.entities[Symbol.iterator]();
  }
}
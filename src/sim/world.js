export class World {
  #entities = new Map();

  spawn(e) {
    this.#entities.set(e.id, e);
    return e;
  }

  despawn(id) {
    const e = this.#entities.get(id);
    if (e) e.alive = false;
  }

  get(id) { return this.#entities.get(id); }

  *[Symbol.iterator]() {
    yield* this.#entities.values();
  }

  *ofKind(kind) {
    for (const e of this) {
      if (e.kind === kind) yield e;
    }
  }

  sweep() {
    for (const [id, e] of this.#entities) {
      if (!e.alive) this.#entities.delete(id);
    }
  }
}
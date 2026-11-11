export class ObjectPool<T> {
  private pool: T[] = [];

  constructor(
    private readonly factory: () => T,
    private readonly resetFn: (obj: T) => void,
    initialSize = 50
  ) {
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  get(): T {
    const obj = this.pool.pop() || this.factory();
    return obj;
  }

  release(obj: T): void {
    this.resetFn(obj);
    this.pool.push(obj);
  }

  get size(): number {
    return this.pool.length;
  }
}
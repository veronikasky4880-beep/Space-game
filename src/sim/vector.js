export class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
  scale(n) { return new Vector2(this.x * n, this.y * n); }
  length() { return Math.hypot(this.x, this.y); }
  normalize() {
    const len = this.length();
    return len === 0 ? new Vector2() : new Vector2(this.x / len, this.y / len);
  }
  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }
  static fromAngle(angle) {
    return new Vector2(Math.cos(angle), Math.sin(angle));
  }
}
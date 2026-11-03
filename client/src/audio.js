import { bus } from "./events.js";

class SoundSystem {
  constructor() {
    this.ctx = null;
    this.buffers = {};
  }

  // Ініціалізація та підписка на події гри
  init(audioCtx, loadedSounds) {
    this.ctx = audioCtx;
    this.buffers = loadedSounds;

    // Підписуємося на події через шину EventTarget (без прямого імпорту в симуляцію)
    bus.addEventListener("fired", () => this.play("/sounds/shoot.wav"));
    bus.addEventListener("exploded", () => this.play("/sounds/explosion.wav"));
  }

  // Програвання декодованого буфера через AudioBufferSourceNode
  play(soundUrl) {
    if (!this.ctx || !this.buffers[soundUrl]) return;

    const source = this.ctx.createBufferSource();
    source.buffer = this.buffers[soundUrl];
    source.connect(this.ctx.destination);
    source.start(0);
  }
}

export const soundSystem = new SoundSystem();
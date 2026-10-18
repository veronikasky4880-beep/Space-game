export function createLoop({ step = 1 / 60, simulate, render }) {
  let accumulator = 0;
  let last = performance.now();
  let rafId;

  let framesThisSecond = 0;
  let stepsThisSecond = 0;
  let lastFpsTime = last;
  const stats = { stepsPerSec: 0, framesPerSec: 0, frameMs: 0 };

  function frame(now) {
    const dt = now - last;
    stats.frameMs = dt;
    
    accumulator += Math.min(dt / 1000, 0.25);
    last = now;

    while (accumulator >= step) {
      simulate(step);
      accumulator -= step;
      stepsThisSecond++;
    }

    render(accumulator / step, stats);
    framesThisSecond++;

    if (now - lastFpsTime >= 1000) {
      stats.stepsPerSec = stepsThisSecond;
      stats.framesPerSec = framesThisSecond;
      stepsThisSecond = 0;
      framesThisSecond = 0;
      lastFpsTime = now;
    }

    rafId = requestAnimationFrame(frame);
  }

  return {
    start: () => {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    },
    stop: () => cancelAnimationFrame(rafId),
  };
}
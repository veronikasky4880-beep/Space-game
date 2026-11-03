export function createLoop({ step = 1 / 60, simulate, render }) {
  let running = false;
  let lastTime = null;
  let accumulator = 0;
  let frameId = null;

  function tick(currentTime) {
    if (!running) return;

    if (lastTime === null) {
      lastTime = currentTime;
    }

    let dt = (currentTime - lastTime) / 1000;
    if (dt > 0.25) dt = 0.25; // Защита от зависаний вкладки
    lastTime = currentTime;

    accumulator += dt;

    while (accumulator >= step) {
      simulate(step);
      accumulator -= step;
    }

    render(accumulator / step);
    frameId = requestAnimationFrame(tick);
  }

  return {
    start: () => {
      if (running) return;
      running = true;
      lastTime = null;
      accumulator = 0;
      frameId = requestAnimationFrame(tick);
    },
    stop: () => {
      running = false;
      if (frameId) cancelAnimationFrame(frameId);
    }
  };
}
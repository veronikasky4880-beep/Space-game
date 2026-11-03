export function setupCanvas(canvas, cssWidth, cssHeight) {
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  
  return ctx;
}

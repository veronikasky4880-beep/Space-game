export function wrapArena(ship, width, height) {
  const next = { ...ship };
  if (next.x < 0) next.x += width;
  if (next.x > width) next.x -= width;
  if (next.y < 0) next.y += height;
  if (next.y > height) next.y -= height;
  return next;
}

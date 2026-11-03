export function drawWorld(ctx, world, alpha, stats, score, assets) {
  if (!ctx) return;

  // Очищаємо канвас перед кожним кадром
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const entity of world) {
    ctx.save();
    ctx.translate(entity.pos.x, entity.pos.y);

    // Малюємо шкалу здоров'я ТІЛЬКИ для корабля гравця
    if (entity.kind === "ship" && entity.maxHp > 1) {
      const barWidth = entity.radius * 2;
      const barHeight = 5;
      const barX = -entity.radius;
      const barY = -entity.radius - 12;

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(barX, barY, barWidth, barHeight);

      const hpPercent = Math.max(0, entity.hp / entity.maxHp);
      ctx.fillStyle = "#00ff00";
      ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

      ctx.strokeStyle = "black";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    ctx.rotate(entity.angle || 0);

    let img = null;
    if (entity.kind === "ship" && assets?.images?.["/sprites/ship.png"]) {
      img = assets.images["/sprites/ship.png"];
    } else if (entity.kind === "asteroid" && assets?.images?.["/sprites/asteroid.png"]) {
      img = assets.images["/sprites/asteroid.png"];
    } else if (entity.kind === "bullet" && assets?.images?.["/sprites/bullet.png"]) {
      img = assets.images["/sprites/bullet.png"];
    }

    if (img) {
      if (entity.kind === "ship") {
        ctx.rotate(Math.PI / 2);
      }
      const size = entity.radius * 2;
      ctx.drawImage(img, -entity.radius, -entity.radius, size, size);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, entity.radius, 0, Math.PI * 2);
      ctx.strokeStyle = entity.kind === "pickup" ? "gold" : "white";
      ctx.stroke();
    }

    ctx.restore();
  }

  // Малюємо акуратний лічильник очок (X: 80, Y: 50, розмір: 16px)
  ctx.save();
  ctx.fillStyle = "#00ffcc";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(`SCORE: ${score}`, 80, 50);
  ctx.restore();
}
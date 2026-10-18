function lerp(a, b, alpha) { return a + (b - a) * alpha; }

function lerpAngle(a, b, alpha) {
  let diff = b - a;
  while (diff < -Math.PI) diff += Math.PI * 2;
  while (diff > Math.PI) diff -= Math.PI * 2;
  return a + diff * alpha;
}

export function drawWorld(ctx, world, alpha, stats, score) {
  ctx.clearRect(0, 0, 800, 600);

  for (const e of world) {
    ctx.save();
    ctx.translate(e.pos.x, e.pos.y);

    if (e.kind === "ship") {
      ctx.rotate(e.angle);
      if (e.thrust) {
        ctx.beginPath();
        ctx.moveTo(-10, 0); ctx.lineTo(-22, -4); ctx.lineTo(-22, 4);
        ctx.fillStyle = "orange"; ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10);
      ctx.fillStyle = "#00ffcc"; ctx.fill();
    } else if (e.kind === "bullet") {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = e.isHoming ? "#ff00ff" : "#ffff00";
      ctx.fill();
    } else if (e.kind === "asteroid") {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = "#aaa"; ctx.lineWidth = 2; ctx.stroke();
    } else if (e.kind === "pickup") {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#00ff00"; ctx.fill();
    } else if (e.kind === "particle") {
      ctx.beginPath();
      ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fillStyle = "#ff5500"; ctx.fill();
    }

    ctx.restore();
  }

  // HUD
  ctx.fillStyle = "#00ff00";
  ctx.font = "14px monospace";
  ctx.fillText(`steps/s:  ${stats.stepsPerSec}`, 10, 20);
  ctx.fillText(`frames/s: ${stats.framesPerSec}`, 10, 40);
  ctx.fillText(`Score:    ${score}`, 10, 80);

  const ship = [...world.ofKind("ship")][0];
  if (ship) {
    ctx.fillText(`HP:       ${ship.hp}`, 10, 60);
  } else {
    ctx.fillStyle = "red";
    ctx.fillText(`SHIP DESTROYED (RESPAWNING...)`, 10, 60);
  }
}
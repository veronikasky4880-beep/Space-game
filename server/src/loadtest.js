import WebSocket from "ws";

const TARGET_HOST = process.env.WS_URL || "ws://localhost:3000";
const CLIENT_COUNTS = [8, 32, 64, 128];

async function runLoadTest(count) {
  console.log(`\n--- Тестування навантаження: ${count} безвіконних клієнтів ---`);
  const sockets = [];
  let snapshotsReceived = 0;
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const ws = new WebSocket(TARGET_HOST);
    ws.binaryType = "arraybuffer";

    ws.on("open", () => {
      ws.send(JSON.stringify({ type: "join", roomId: "default", name: `Bot-${i}` }));
    });

    ws.on("message", (data) => {
      if (data instanceof ArrayBuffer || Buffer.isBuffer(data)) {
        snapshotsReceived++;
      }
    });

    sockets.push(ws);
  }

  // Залишаємо клієнтів активними на 5 секунд
  await new Promise((resolve) => setTimeout(resolve, 5000));

  const durationSec = (Date.now() - startTime) / 1000;
  console.log(`Отримано знімків: ${snapshotsReceived} за ${durationSec.toFixed(1)} сек`);
  console.log(`Частота кадрів сервера для ${count} клієнтів: ${(snapshotsReceived / count / durationSec).toFixed(1)} Hz/клієнт`);

  sockets.forEach((s) => s.close());
}

async function start() {
  for (const count of CLIENT_COUNTS) {
    await runLoadTest(count);
  }
  process.exit(0);
}

start();
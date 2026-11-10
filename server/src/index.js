import { createServer } from "node:http";
import process from "node:process";
import { createReadStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { RoomManager } from "./rooms.js";
import { createMatchLogger } from "./matchlog.js";
import { Match } from "./match.js";

const roomManager = new RoomManager();
const matches = new Map(); // Зберігаємо екземпляри симуляцій ігрових кімнат

// Ініціалізуємо логування подій для кімнат
for (const room of roomManager.rooms.values()) {
  async function* eventGenerator() {
    for await (const [event] of onEvents(room, "match_event")) {
      yield event;
    }
  }
  createMatchLogger(eventGenerator(), config.logDir, room.id);
}

// Допоміжна функція перетворення подій EventEmitter на AsyncIterable
async function* onEvents(emitter, eventName) {
  while (true) {
    const event = await new Promise((resolve) => emitter.once(eventName, resolve));
    yield [event];
  }
}

// 1. HTTP-сервер
const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Перевірка стану (GET /health)
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  // Список кімнат (GET /api/rooms)
  if (req.method === "GET" && req.url === "/api/rooms") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(roomManager.getPublicList()));
  }

  // Віддача логу матчу стрімом (GET /api/replays/:filename)
  if (req.method === "GET" && req.url.startsWith("/api/replays/")) {
    const filename = path.basename(req.url.replace("/api/replays/", ""));
    const filePath = path.join(config.logDir, filename);

    if (existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      const readStream = createReadStream(filePath);
      try {
        await pipeline(readStream, res);
      } catch (err) {
        console.error("Помилка передачі повтору:", err.message);
      }
      return;
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Replay Not Found");
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

// 2. WebSocket-сервер із обмеженням розміру повідомлення maxPayload (1024 байти)
const wss = new WebSocketServer({ 
  server, 
  maxPayload: 1024 
});

wss.on("connection", (socket) => {
  socket.binaryType = "arraybuffer"; // Увімкнення бінарного режиму для передачі DataView кадрів
  let currentRoom = null;
  let currentMatch = null;
  socket.isAlive = true;

  // Лімітер повідомлень (Token Bucket: max 30 повідомлень на секунду для ігрового інпуту)
  let msgCount = 0;
  const rateLimitInterval = setInterval(() => {
    msgCount = 0;
  }, 1000);

  // Обробник відповіді на Ping (Heartbeat)
  socket.on("pong", () => {
    socket.isAlive = true;
  });

  // Обов'язковий слухач помилок сокета
  socket.on("error", (err) => {
    console.error("WebSocket Помилка:", err.message);
  });

  socket.on("message", (rawMessage) => {
    // 1. Захист від Спаму (Rate limit)
    msgCount++;
    if (msgCount > 60) {
      console.warn("Перевищено ліміт повідомлень. Закриваємо сокет.");
      socket.close(1008, "Rate limit exceeded");
      return;
    }

    // 2. Захист від повільного клієнта (Backpressure check через bufferedAmount)
    if (socket.bufferedAmount > 65536) {
      console.warn("Клієнт не встигає зчитувати дані. Відключаємо.");
      socket.close(1008, "Buffer overflow");
      return;
    }

    // 3. Обробка бінарних даних (команди керування input від клієнта)
    if (rawMessage instanceof ArrayBuffer || Buffer.isBuffer(rawMessage)) {
      if (currentMatch) {
        const buffer = rawMessage.buffer.slice(
          rawMessage.byteOffset, 
          rawMessage.byteOffset + rawMessage.byteLength
        );
        currentMatch.handleInput(socket, buffer);
      }
      return;
    }

    // 4. Обробка текстових JSON повідомлень (вхід у кімнату, чат)
    try {
      const msg = JSON.parse(rawMessage.toString());

      if (msg.type === "join") {
        const room = roomManager.getRoom(msg.roomId);
        if (room && room.addPlayer(socket, { name: msg.name })) {
          currentRoom = room;

          // Ініціалізація або отримання матчу для цієї кімнати
          if (!matches.has(msg.roomId)) {
            matches.set(msg.roomId, new Match(msg.roomId));
          }
          currentMatch = matches.get(msg.roomId);
          const playerId = currentMatch.addPlayer(socket, msg.name);

          socket.send(JSON.stringify({ 
            type: "joined", 
            roomId: msg.roomId, 
            playerId 
          }));
        } else {
          socket.send(JSON.stringify({ type: "error", message: "Не вдалося приєднатися" }));
        }
      } else if (msg.type === "chat" && currentRoom) {
        currentRoom.logEvent("chat", { sender: msg.sender, text: msg.text });
        currentRoom.broadcast({
          type: "chat",
          sender: msg.sender || "Анонім",
          text: msg.text
        });
      }
    } catch (err) {
      console.error("Некоректна форма JSON:", err.message);
      socket.close(1007, "Invalid JSON");
    }
  });

  socket.on("close", () => {
    clearInterval(rateLimitInterval);
    if (currentMatch) {
      currentMatch.removePlayer(socket);
    }
    if (currentRoom) {
      currentRoom.removePlayer(socket);
    }
  });
});

// Інтервал серцебиття (Ping раз на 15 секунд, 2 пропущені pong = розрив)
const heartbeatInterval = setInterval(() => {
  for (const socket of wss.clients) {
    if (socket.isAlive === false) {
      console.log("Клієнт не відповів на ping. Розриваємо з'єднання.");
      return socket.terminate();
    }
    socket.isAlive = false;
    socket.ping();
  }
}, 15000);

wss.on("close", () => {
  clearInterval(heartbeatInterval);
});

// Graceful Shutdown (Завершення за SIGINT / SIGTERM з кодом 0)
const shutdown = () => {
  console.log("\nОтримано сигнал зупинки. Закриваємо з'єднання...");
  clearInterval(heartbeatInterval);
  wss.close(() => {
    server.close(() => {
      console.log("Сервер успішно зупинено (code 0).");
      process.exit(0);
    });
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(config.port, () => {
  console.log(`🚀 Сервер запущено на http://localhost:${config.port}`);
});
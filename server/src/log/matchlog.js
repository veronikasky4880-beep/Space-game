import { Transform, Readable } from "node:stream";
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import path from "node:path";

// Потік трансформації: конвертує об'єкти подій у рядки NDJSON
export class NdjsonTransform extends Transform {
  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk, encoding, callback) {
    try {
      const line = JSON.stringify(chunk) + "\n";
      callback(null, line);
    } catch (err) {
      callback(err);
    }
  }
}

// Створення стрімінгового логера матчу
export async function createMatchLogger(roomEventsIterable, logDir, roomId) {
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  const timestamp = Date.now();
  const filePath = path.join(logDir, `${roomId}-${timestamp}.ndjson`);
  const writeStream = createWriteStream(filePath);
  const transform = new NdjsonTransform();

  const source = Readable.from(roomEventsIterable);

  pipeline(source, transform, writeStream).catch((err) => {
    console.error(`[MatchLog Error] Помилка запису логу для ${roomId}:`, err.message);
  });

  return filePath;
}
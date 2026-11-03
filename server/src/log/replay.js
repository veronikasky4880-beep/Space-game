import { createReadStream } from "node:fs";
import readline from "node:readline";

// Асинхронний генератор для подекудного читання логу
export async function* readMatchReplay(filePath) {
  const fileStream = createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      yield JSON.parse(line);
    }
  }
}
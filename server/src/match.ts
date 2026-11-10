import { WebSocket } from "ws";
import { parseClientMessage, encodeSnapshot, type Tick, type Seq, type SnapshotEntity, asTick, asSeq } from "shared";

interface PlayerSession {
  id: number;
  lastSeq: Seq;
  inputQueue: Array<{ thrust: boolean; turn: -1 | 0 | 1 }>;
}

export class Match {
  private tick: Tick = asTick(0);
  private players = new Map<WebSocket, PlayerSession>();
  private isRunning = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  addPlayer(socket: WebSocket): number {
    const id = Math.floor(Math.random() * 60000) + 1;
    this.players.set(socket, { id, lastSeq: asSeq(0), inputQueue: [] });
    if (!this.isRunning) this.start();
    return id;
  }

  removePlayer(socket: WebSocket): void {
    this.players.delete(socket);
    if (this.players.size === 0) this.stop();
  }

  handleMessage(socket: WebSocket, raw: unknown): void {
    const parsed = parseClientMessage(raw);
    if (!parsed.success) {
      console.warn(`[Match] Invalid message: ${parsed.error}`);
      return;
    }

    const msg = parsed.data;
    const player = this.players.get(socket);
    if (!player) return;

    switch (msg.type) {
      case "input":
        player.lastSeq = asSeq(msg.seq);
        player.inputQueue.push({ thrust: msg.thrust, turn: msg.turn });
        break;
      case "join":
        break;
      default: {
        const _exhaustiveCheck: never = msg as never;
        return _exhaustiveCheck;
      }
    }
  }

  private start(): void {
    this.isRunning = true;
    this.loop();
  }

  private stop(): void {
    this.isRunning = false;
    if (this.timer) clearTimeout(this.timer);
  }

  private loop = (): void => {
    if (!this.isRunning) return;

    this.tick = asTick(this.tick + 1);
    const entities: SnapshotEntity[] = [];

    for (const [socket, player] of this.players.entries()) {
      if (socket.readyState === WebSocket.OPEN) {
        const buf = encodeSnapshot(this.tick, player.lastSeq, entities);
        socket.send(buf);
      }
    }

    this.timer = setTimeout(this.loop, 33);
  };
}
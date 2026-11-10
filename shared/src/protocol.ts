import { z } from "zod";
import { type Seq, type Tick, type SnapshotEntity, type EntityKind, asSeq, asTick, asEntityId } from "./types.js";

export const InputMessageSchema = z.object({
  type: z.literal("input"),
  seq: z.number().int().nonnegative(),
  thrust: z.boolean(),
  turn: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  fire: z.boolean(),
});

export const JoinMessageSchema = z.object({
  type: z.literal("join"),
  roomId: z.string(),
  name: z.string().min(1).max(20),
});

export const ClientMessageSchema = z.discriminatedUnion("type", [
  InputMessageSchema,
  JoinMessageSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ParseResult<T> = 
  | { success: true; data: T } 
  | { success: false; error: string };

export function parseClientMessage(raw: unknown): ParseResult<ClientMessage> {
  if (typeof raw === "string") {
    try {
      const json: unknown = JSON.parse(raw);
      const res = ClientMessageSchema.safeParse(json);
      if (res.success) return { success: true, data: res.data };
      return { success: false, error: res.error.message };
    } catch {
      return { success: false, error: "Invalid JSON format" };
    }
  }
  return { success: false, error: "Expected string" };
}

export const PROTOCOL_VERSION = 1;

export function encodeSnapshot(tick: Tick, lastAckSeq: Seq, entities: SnapshotEntity[]): ArrayBuffer {
  const buffer = new ArrayBuffer(12 + entities.length * 13);
  const view = new DataView(buffer);

  view.setUint8(0, PROTOCOL_VERSION);
  view.setUint32(1, tick, true);
  view.setUint32(5, lastAckSeq, true);
  view.setUint16(9, entities.length, true);

  let offset = 11;
  for (const e of entities) {
    view.setUint16(offset, e.id, true);
    const kindByte = e.kind === "ship" ? 1 : e.kind === "asteroid" ? 2 : e.kind === "bullet" ? 3 : 4;
    view.setUint8(offset + 2, kindByte);
    view.setFloat32(offset + 3, e.x, true);
    view.setFloat32(offset + 7, e.y, true);
    view.setInt16(offset + 11, Math.round(e.angle * 1000), true);
    offset += 13;
  }

  return buffer;
}

export function decodeSnapshot(buffer: ArrayBuffer): { tick: Tick; lastAckSeq: Seq; entities: SnapshotEntity[] } {
  const view = new DataView(buffer);
  const version = view.getUint8(0);
  if (version !== PROTOCOL_VERSION) {
    throw new Error(`Protocol version mismatch: ${version}`);
  }

  const tick = asTick(view.getUint32(1, true));
  const lastAckSeq = asSeq(view.getUint32(5, true));
  const count = view.getUint16(9, true);

  const entities: SnapshotEntity[] = [];
  let offset = 11;
  for (let i = 0; i < count; i++) {
    const id = asEntityId(view.getUint16(offset, true));
    const kByte = view.getUint8(offset + 2);
    let kind: EntityKind = "ship";
    switch (kByte) {
      case 1: kind = "ship"; break;
      case 2: kind = "asteroid"; break;
      case 3: kind = "bullet"; break;
      case 4: kind = "pickup"; break;
      default: {
        const _exhaustive: never = kByte as never;
        kind = "ship";
      }
    }
    const x = view.getFloat32(offset + 3, true);
    const y = view.getFloat32(offset + 7, true);
    const angle = view.getInt16(offset + 11, true) / 1000;

    entities.push({ id, kind, x, y, angle });
    offset += 13;
  }

  return { tick, lastAckSeq, entities };
}
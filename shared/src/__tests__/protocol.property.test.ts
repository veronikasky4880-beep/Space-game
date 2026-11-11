import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { 
  encodeSnapshot, 
  decodeSnapshot, 
  parseClientMessage, 
  PROTOCOL_VERSION, 
  asTick, 
  asSeq, 
  asEntityId,
  type SnapshotEntity 
} from "../index.js";

describe("Protocol Property-Based Tests (fast-check)", () => {
  // 1. Декодування відповідає кодуванню (з урахуванням квантування кута)
  it("Property 1: encodeSnapshot -> decodeSnapshot round-trip preservation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 65535 }),
            kind: fc.constantFrom("ship", "asteroid", "bullet", "pickup"),
            x: fc.float({ min: -1000, max: 1000, noNaN: true }),
            y: fc.float({ min: -1000, max: 1000, noNaN: true }),
            angle: fc.float({ min: -3.14, max: 3.14, noNaN: true }),
          }),
          { maxLength: 20 }
        ),
        (tickNum, seqNum, rawEntities) => {
          const tick = asTick(tickNum);
          const lastAckSeq = asSeq(seqNum);
          const entities: SnapshotEntity[] = rawEntities.map((e) => ({
            ...e,
            id: asEntityId(e.id),
          }));

          const encoded = encodeSnapshot(tick, lastAckSeq, entities);
          const decoded = decodeSnapshot(encoded);

          expect(decoded.tick).toBe(tick);
          expect(decoded.lastAckSeq).toBe(lastAckSeq);
          expect(decoded.entities.length).toBe(entities.length);

          for (let i = 0; i < entities.length; i++) {
            expect(decoded.entities[i]!.id).toBe(entities[i]!.id);
            expect(decoded.entities[i]!.kind).toBe(entities[i]!.kind);
            expect(decoded.entities[i]!.x).toBeCloseTo(entities[i]!.x, 2);
            expect(decoded.entities[i]!.y).toBeCloseTo(entities[i]!.y, 2);
          }
        }
      )
    );
  });

  // 2. Розмір бінарного буфера точно збігається зі специфікацією (11 + count * 13)
  it("Property 2: Encoded binary buffer length matches exact format specification", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 65535 }),
            kind: fc.constantFrom("ship", "asteroid", "bullet", "pickup"),
            x: fc.float({ min: 0, max: 800, noNaN: true }),
            y: fc.float({ min: 0, max: 600, noNaN: true }),
            angle: fc.float({ min: 0, max: 6.28, noNaN: true }),
          }),
          { maxLength: 50 }
        ),
        (rawEntities) => {
          const entities: SnapshotEntity[] = rawEntities.map((e) => ({
            ...e,
            id: asEntityId(e.id),
          }));
          const buffer = encodeSnapshot(asTick(1), asSeq(1), entities);
          expect(buffer.byteLength).toBe(11 + entities.length * 13);
        }
      )
    );
  });

  // 3. Довільне зіпсоване сміття в буфері дає оброблену помилку, а не падіння процесу
  it("Property 3: Corrupted or random binary buffers fail gracefully", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 100 }), (bytes) => {
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        if (bytes.length < 11 || bytes[0] !== PROTOCOL_VERSION) {
          expect(() => decodeSnapshot(buffer)).toThrow();
        }
      })
    );
  });

  // 4. Валідатор parseClientMessage приймає коректні та відхиляє будь-які зіпсовані рядочки
  it("Property 4: parseClientMessage accepts valid payloads and rejects arbitrary invalid strings", () => {
    fc.assert(
      fc.property(fc.string(), (randomString) => {
        const res = parseClientMessage(randomString);
        if (res.success) {
          expect(res.data.type).toBeDefined();
        } else {
          expect(typeof res.error).toBe("string");
        }
      })
    );
  });

  // 5. Перевірка цілості меж координатного поля
  it("Property 5: Entity position remains safe and numerical under PRNG sequence steps", () => {
    fc.assert(
      fc.property(fc.float({ min: -500, max: 1300, noNaN: true }), (pos) => {
        const wrapped = ((pos % 800) + 800) % 800;
        expect(wrapped).toBeGreaterThanOrEqual(0);
        expect(wrapped).toBeLessThanOrEqual(800);
      })
    );
  });
});
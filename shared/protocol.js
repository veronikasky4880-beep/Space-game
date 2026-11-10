// Типи бінарних повідомлень
export const MSG_TYPES = {
  INPUT: 1,
  SNAPSHOT: 2,
};

// Кодування вхідних команд (Input): seq (Uint32), thrust (Uint8), turn (Int8), fire (Uint8)
export function encodeInput(seq, thrust, turn, fire) {
  const buffer = new ArrayBuffer(7);
  const view = new DataView(buffer);
  view.setUint8(0, MSG_TYPES.INPUT);
  view.setUint32(1, seq, true); // Little-endian
  view.setUint8(5, thrust ? 1 : 0);
  view.setInt8(6, turn); // -1, 0, 1
  return buffer;
}

export function decodeInput(buffer) {
  const view = new DataView(buffer);
  return {
    type: view.getUint8(0),
    seq: view.getUint32(1, true),
    thrust: view.getUint8(5) === 1,
    turn: view.getInt8(6),
  };
}

// Кодування знімка стану (Snapshot): tick (Uint32), lastAckSeq (Uint32), count (Uint8), [id (Uint16), x (Float32), y (Float32), angle (Int16)]
export function encodeSnapshot(tick, lastAckSeq, entities) {
  // Header: type(1) + tick(4) + lastAckSeq(4) + entityCount(2) = 11 bytes
  // Per entity: id(2) + x(4) + y(4) + angle(2) = 12 bytes
  const bufferSize = 11 + entities.length * 12;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  view.setUint8(0, MSG_TYPES.SNAPSHOT);
  view.setUint32(1, tick, true);
  view.setUint32(5, lastAckSeq, true);
  view.setUint16(9, entities.length, true);

  let offset = 11;
  for (const e of entities) {
    view.setUint16(offset, e.id, true);
    view.setFloat32(offset + 2, e.x, true);
    view.setFloat32(offset + 6, e.y, true);
    // Квантування кута: Int16 замість Float32 для економії байтів
    const quantizedAngle = Math.round(e.angle * 1000);
    view.setInt16(offset + 10, quantizedAngle, true);
    offset += 12;
  }

  return buffer;
}

export function decodeSnapshot(buffer) {
  const view = new DataView(buffer);
  const type = view.getUint8(0);
  const tick = view.getUint32(1, true);
  const lastAckSeq = view.getUint32(5, true);
  const count = view.getUint16(9, true);

  const entities = [];
  let offset = 11;
  for (let i = 0; i < count; i++) {
    const id = view.getUint16(offset, true);
    const x = view.getFloat32(offset + 2, true);
    const y = view.getFloat32(offset + 6, true);
    const angle = view.getInt16(offset + 10, true) / 1000;
    entities.push({ id, x, y, angle });
    offset += 12;
  }

  return { type, tick, lastAckSeq, entities };
}
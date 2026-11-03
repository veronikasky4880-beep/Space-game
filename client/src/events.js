// Шина подій для розв'язки модулів (Decoupled Event Bus)
export const bus = new EventTarget();

export function emit(eventName, detail = {}) {
  bus.dispatchEvent(new CustomEvent(eventName, { detail }));
}
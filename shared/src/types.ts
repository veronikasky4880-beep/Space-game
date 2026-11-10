export type EntityId = number & { readonly __brand: "EntityId" };
export type Tick = number & { readonly __brand: "Tick" };
export type Seq = number & { readonly __brand: "Seq" };

export const asEntityId = (n: number): EntityId => n as EntityId;
export const asTick = (n: number): Tick => n as Tick;
export const asSeq = (n: number): Seq => n as Seq;

export type EntityKind = "ship" | "asteroid" | "bullet" | "pickup";

export interface SnapshotEntity {
  id: EntityId;
  kind: EntityKind;
  x: number;
  y: number;
  angle: number;
}
import { EventEmitter } from "events";

declare global {
  var __dataEvents: EventEmitter | undefined;
}

export const dataEvents: EventEmitter = globalThis.__dataEvents ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalThis.__dataEvents = dataEvents;
}

import { EventEmitter } from "events";

declare global {
  var __dataEvents: EventEmitter | undefined;
}

// Route handlers, server actions and the scheduler each load their own copy of this module
export const dataEvents: EventEmitter = (globalThis.__dataEvents ??= new EventEmitter());

import type { PullRecord, PullTombstone } from "@/lib/sync/pull";

// What a pull page looks like after JSON: every Date is an ISO string
export type Wire<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export type WireRecord = Wire<PullRecord>;

export type PullPage = {
  reset: false;
  cursor: number;
  more: boolean;
  tombstones: PullTombstone[];
  records: WireRecord[];
};

export type StoredRecord = WireRecord & { key: string; bucketId: number | null };

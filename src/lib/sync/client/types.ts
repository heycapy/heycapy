import type { PullRecord, PullTombstone } from "@/lib/sync/pull";
import type { Mutation } from "@/lib/sync/protocol";

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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export type NewMutation = DistributiveOmit<Mutation, "seq">;

// `seq` is the key the database hands out; `sent` is set before a batch goes out, because the
// server may have applied it even when the answer never arrived
export type QueueEntry = { seq: number; sent: boolean; mutation: NewMutation };

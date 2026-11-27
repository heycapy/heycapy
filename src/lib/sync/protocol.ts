import { z } from "zod";
import { RecurringConfig } from "@/types/rules";
import { PUSH_MAX_MUTATIONS } from "@/constants";

export const PushEnvelope = z.object({
  deviceId: z.uuid(),
  mutations: z
    .array(z.object({ seq: z.int().positive(), type: z.string() }).loose())
    .max(PUSH_MAX_MUTATIONS),
});

const Recurring = z.custom<RecurringConfig>((v) => RecurringConfig.safeParse(v).success);
const Properties = z.record(z.string(), z.unknown());
const Fields = {
  deadline: z.string().nullable(),
  status: z.string(),
  recurring: Recurring.nullable(),
  properties: Properties.nullable(),
  reminders: z.array(z.number()).nullable(),
  assigneeIds: z.array(z.int()),
  clock: z.string().nullable(),
};

const Seq = z.int().positive();

export const ItemCreate = z.strictObject({
  seq: Seq,
  type: z.literal("item.create"),
  id: z.uuid(),
  bucketId: z.int(),
  title: z.string(),
  description: z.string().optional(),
  deadline: Fields.deadline,
  status: Fields.status.optional(),
  recurring: Fields.recurring.optional(),
  properties: Fields.properties.optional(),
  reminders: Fields.reminders.optional(),
  assigneeIds: Fields.assigneeIds.optional(),
  clock: Fields.clock.optional(),
});

const Patch = z.strictObject({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  deadline: Fields.deadline.optional(),
  status: Fields.status.optional(),
  recurring: Fields.recurring.optional(),
  properties: Fields.properties.optional(),
  reminders: Fields.reminders.optional(),
  assigneeIds: Fields.assigneeIds.optional(),
  clock: Fields.clock.optional(),
});

export const ItemPatchMutation = z.strictObject({
  seq: Seq,
  type: z.literal("item.patch"),
  id: z.uuid(),
  patch: Patch,
});

export const ItemDelete = z.strictObject({
  seq: Seq,
  type: z.literal("item.delete"),
  id: z.uuid(),
});

export const Mutation = z.discriminatedUnion("type", [ItemCreate, ItemPatchMutation, ItemDelete]);

export type Mutation = z.infer<typeof Mutation>;
export type RawMutation = z.infer<typeof PushEnvelope>["mutations"][number];
export type PushResult =
  | { seq: number; result: "applied" | "duplicate" }
  | { seq: number; result: "rejected"; reason: string };

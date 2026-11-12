"use client";

import { useState } from "react";
import { DAY_MS } from "@/lib/account/constants";
import { ITEM_STATUS } from "@/constants";
import { cn } from "@/lib/utils";
import { PlaceTab } from "@/components/buckets/BucketTabs";
import { TickBox } from "@/components/buckets/TickBox";
import { ItemDue } from "@/components/buckets/ItemDue";
import { Icon } from "@/components/ui/Icon";
import { InputBar } from "@/components/ui/InputBar";
import { TextButton } from "@/components/ui/TextButton";
import { LookProvider, useLookParts } from "./LookProvider";
import { LOOK_PREVIEW_BUCKET, LOOK_PREVIEW_ITEMS, type Look } from "./constants";

const PREVIEW_COLOR = "var(--p2)";

export function LookPreview({ look }: { look: Look }) {
  return (
    <div
      data-look={look}
      inert
      className="bg-card text-foreground font-ui rounded-panel overflow-hidden pb-1 text-left"
    >
      <LookProvider look={look}>
        <PreviewTabs />
        <PreviewList />
        <PreviewAddBar />
      </LookProvider>
    </div>
  );
}

function PreviewTabs() {
  return (
    <div className="border-border border-b-frame flex">
      <TextButton variant="ghost" className="shrink-0 py-0 pr-3 pl-3">
        <Icon name="search" />
      </TextButton>
      <span className="bg-border h-4 w-px shrink-0 self-center" />
      <PlaceTab active={false} color="var(--foreground)" onSelect={() => {}}>
        <span className="flex items-center gap-1.5">
          <Icon name="clock" />
          today
        </span>
      </PlaceTab>
      <PlaceTab active color={PREVIEW_COLOR} onSelect={() => {}}>
        {LOOK_PREVIEW_BUCKET}
      </PlaceTab>
    </div>
  );
}

function PreviewList() {
  const framed = useLookParts().listFrame === "framed";
  const [today] = useState(() => Date.now());
  return (
    <div className={cn(framed && "border-border border-b-frame")}>
      {LOOK_PREVIEW_ITEMS.map((item) => (
        <div key={item.title} className={cn("flex items-stretch px-3", item.done && "opacity-45")}>
          <TickBox title={item.title} checked={item.done} color={PREVIEW_COLOR} />
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1 py-2.5">
            <span className="max-w-full truncate text-sm">{item.title}</span>
            <ItemDue
              due={
                item.dueInDays === null
                  ? null
                  : { at: new Date(today + item.dueInDays * DAY_MS), allDay: true }
              }
              status={item.done ? ITEM_STATUS.completed : ITEM_STATUS.active}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

function PreviewAddBar() {
  const floating = useLookParts().footer === "floating";
  return (
    <div className={cn("mt-3", floating ? "px-2.5 pb-1" : "border-border border-t-frame")}>
      <InputBar
        className={cn(
          floating && "border-border rounded-panel border-frame shadow-raised bg-background"
        )}
      >
        <Icon name="plus" className="shrink-0 text-(--p2)" />
        <span className="text-muted-foreground/50 min-w-0 flex-1 truncate py-1 text-sm">
          add to {LOOK_PREVIEW_BUCKET}
        </span>
      </InputBar>
    </div>
  );
}

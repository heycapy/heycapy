import {
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Reorder, useDragControls } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  TAB_DROP_SPRING,
  TAB_HOLD_MS,
  TAB_HOLD_SLOP_PX,
  TAB_LIFT_SCALE,
  TAB_LIFT_VIBRATE_MS,
  TAB_SLIDE,
} from "./constants";

type ReorderTabProps = {
  id: number;
  color: string;
  onDragStart: () => void;
  onDragEnd: () => void;
  children: ReactNode;
};

export function ReorderTab({ id, color, onDragStart, onDragEnd, children }: ReorderTabProps) {
  const controls = useDragControls();
  const hold = useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number } | null>(null);
  const [lifted, setLifted] = useState(false);

  function cancelHold() {
    if (hold.current) clearTimeout(hold.current.timer);
    hold.current = null;
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.button !== 0) return;
    const press = e.nativeEvent;
    cancelHold();
    hold.current = {
      x: e.clientX,
      y: e.clientY,
      timer: setTimeout(() => {
        hold.current = null;
        setLifted(true);
        navigator.vibrate?.(TAB_LIFT_VIBRATE_MS);
        window.addEventListener("pointerup", () => setLifted(false), { once: true });
        onDragStart();
        controls.start(press);
      }, TAB_HOLD_MS),
    };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const start = hold.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAB_HOLD_SLOP_PX)
      cancelHold();
  }

  return (
    <Reorder.Item
      as="span"
      value={id}
      dragListener={false}
      dragControls={controls}
      dragMomentum={false}
      dragTransition={TAB_DROP_SPRING}
      transition={TAB_SLIDE}
      onDragEnd={() => {
        setLifted(false);
        onDragEnd();
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelHold}
      onPointerCancel={cancelHold}
      onContextMenu={(e) => e.preventDefault()}
      animate={{ scale: lifted ? TAB_LIFT_SCALE : 1 }}
      data-lifted={lifted || undefined}
      style={{ "--tab-color": color } as CSSProperties}
      className={cn(
        "bg-background relative flex shrink-0 select-none [-webkit-touch-callout:none]",
        lifted &&
          "rounded-control z-10 cursor-grabbing bg-(--lift-bg) shadow-(--lift-shadow) outline-2 -outline-offset-2 outline-(--tab-color) [outline-style:var(--lift-outline)]"
      )}
    >
      {children}
    </Reorder.Item>
  );
}

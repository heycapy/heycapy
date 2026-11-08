// "raised" sits above another open modal, like the schema editor over bucket settings
export const MODAL_LAYERS = {
  base: { overlay: "z-[55]", panel: "z-[60]" },
  raised: { overlay: "z-[65]", panel: "z-[70]" },
} as const;

export type ModalLayer = keyof typeof MODAL_LAYERS;

export const MODAL_PANELS = {
  dialog: {
    className:
      "fixed top-[8%] left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-panel shadow-raised-lg outline-none sm:top-[12%]",
    initial: { opacity: 0, scale: 0.96, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  sheet: {
    className:
      "bg-background border-border dock fixed flex w-[calc(100%-2*var(--dock-inset))] flex-col shadow-edge outline-none sm:w-80",
    initial: { x: "100%" },
    animate: { x: 0 },
    transition: { duration: 0.2, ease: "easeInOut" },
  },
  side: {
    className:
      "bg-background border-border dock fixed flex w-chat flex-col shadow-(--side-shadow) outline-none",
    initial: { x: "100%" },
    animate: { x: 0 },
    transition: { duration: 0.18, ease: "easeOut" },
  },
  drawer: {
    className: "pointer-events-none fixed inset-0 outline-none",
    initial: { opacity: 1 },
    animate: { opacity: 1 },
    transition: { duration: 0 },
  },
  page: {
    className: "bg-background fixed inset-0 flex flex-col outline-none",
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.12 },
  },
} as const;

export const MENU_SURFACE =
  "bg-background border-border rounded-panel border-frame shadow-raised-sm p-(--menu-inset)";

export type ModalVariant = keyof typeof MODAL_PANELS;

// Popovers inside a modal render in its panel; see usePopover
export const MODAL_PANEL_SELECTOR = "[data-modal-panel]";
export const POPOVER_SELECTOR = "[data-popover]";
export const ITEM_PANEL_SELECTOR = "[data-item-panel]";
// set on a field while its own list is open, so Escape closes the list and not the modal
export const HANDLES_ESCAPE_SELECTOR = "[data-handles-escape]";

// Every icon set supplies all of these, so swapping sets can never leave a hole
export const ICON_NAMES = [
  "archive",
  "arrow-left",
  "arrow-up",
  "bell",
  "briefcase",
  "calendar",
  "chart",
  "check",
  "chevron-left",
  "chevron-right",
  "clock",
  "close",
  "collapse",
  "copy",
  "credit-card",
  "expand",
  "eye",
  "eye-off",
  "grip",
  "list",
  "logout",
  "map",
  "megaphone",
  "message",
  "mic",
  "minus",
  "more",
  "package",
  "pencil",
  "plus",
  "reload",
  "search",
  "sidebar-close",
  "sidebar-open",
  "sliders",
  "square",
  "trash",
  "user-plus",
  "warning",
] as const;
export const TOOLTIP_FLIP_PX = 48;

// more than this and the oldest closes, so a burst never leaves a pile to clear by hand
export const NOTIFY_LIMIT = 3;
export const NOTIFY_MS = { info: 3000, action: 5000, error: 6000 } as const;

export const DRAWER_DIM = 0.25;
export const DRAWER_DIM_FADE = { duration: 0.3, ease: "easeOut" } as const;
export const DRAWER_MOTION = {
  initial: { y: "100%" },
  animate: { y: 0, transition: { type: "spring", duration: 0.5, bounce: 0 } },
  exit: { y: "100%", transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } },
} as const;

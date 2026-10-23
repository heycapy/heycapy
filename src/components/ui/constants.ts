// Half of pixelarticons' 24px grid: the only small size where crispEdges keeps every icon even
export const PIXEL_ICON_SIZE = 12;

// "raised" sits above another open modal, like the schema editor over bucket settings
export const MODAL_LAYERS = {
  base: { overlay: "z-[55]", panel: "z-[60]" },
  raised: { overlay: "z-[65]", panel: "z-[70]" },
} as const;

export type ModalLayer = keyof typeof MODAL_LAYERS;

export const MODAL_PANELS = {
  dialog: {
    className:
      "fixed top-[8%] left-1/2 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 shadow-[5px_5px_0_var(--border)] outline-none sm:top-[12%]",
    initial: { opacity: 0, scale: 0.96, y: -10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.15, ease: "easeOut" },
  },
  sheet: {
    className:
      "bg-background border-border fixed top-0 right-0 flex h-full w-full flex-col border-l-2 shadow-[-4px_0_0_var(--border)] outline-none sm:w-80",
    initial: { x: "100%" },
    animate: { x: 0 },
    transition: { duration: 0.2, ease: "easeInOut" },
  },
  // a full-screen holder: the panel inside animates and drags itself
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

export type ModalVariant = keyof typeof MODAL_PANELS;

// Popovers inside a modal render in its panel; see usePopover
export const MODAL_PANEL_SELECTOR = "[data-modal-panel]";
export const POPOVER_SELECTOR = "[data-popover]";
// set on a field while its own list is open, so Escape closes the list and not the modal
export const HANDLES_ESCAPE_SELECTOR = "[data-handles-escape]";

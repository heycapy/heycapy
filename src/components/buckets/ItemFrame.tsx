import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { ItemDialogFrame } from "./ItemDialogFrame";
import { ItemPageFrame } from "./ItemPageFrame";
import { ItemPanelFrame, type ItemPanel } from "./ItemPanelFrame";

type ItemFrameProps = {
  open: boolean;
  mode: "add" | "edit";
  isMobile: boolean;
  panel?: ItemPanel;
  wide: boolean;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  titleField: (boxed: boolean) => ReactNode;
  details: ReactNode;
  confirm: ReactNode;
  deleteButton: ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
};

// A phone gets a page; on a wider screen the form grows out of the footer, or is a dialog where
// there's no footer to grow from (search)
export function ItemFrame({
  open,
  mode,
  isMobile,
  panel,
  wide,
  scrollBodyRef,
  titleField,
  details,
  confirm,
  deleteButton,
  onCancel,
  onSubmit,
}: ItemFrameProps) {
  const heading = mode === "add" ? "new item" : "edit item";

  // Ctrl/Cmd+Enter adds or saves from any field; a field that used Enter itself (the title, a
  // suggestion list) has already claimed it
  function submitOnShortcut(e: KeyboardEvent) {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || e.defaultPrevented) return;
    if (e.nativeEvent.isComposing) return;
    e.preventDefault();
    onSubmit();
  }

  function frameFor() {
    if (isMobile) {
      return (
        <ItemPageFrame
          open={open}
          heading={heading}
          scrollBodyRef={scrollBodyRef}
          onCancel={onCancel}
          confirm={confirm}
          secondary={
            deleteButton && <div className="border-border mt-6 border-t pt-4">{deleteButton}</div>
          }
        >
          {titleField(false)}
          {details}
        </ItemPageFrame>
      );
    }

    if (panel) {
      return (
        <ItemPanelFrame
          open={open}
          heading={heading}
          panel={panel}
          scrollBodyRef={scrollBodyRef}
          title={titleField(true)}
          confirm={confirm}
          secondary={
            deleteButton && <div className="border-border mt-6 border-t pt-4">{deleteButton}</div>
          }
          returnToOpener={mode === "edit"}
          onCancel={onCancel}
        >
          {details}
        </ItemPanelFrame>
      );
    }

    return (
      <ItemDialogFrame
        open={open}
        heading={heading}
        wide={wide}
        scrollBodyRef={scrollBodyRef}
        onCancel={onCancel}
        footer={
          <div className="flex w-full items-center justify-between">
            {deleteButton || <span />}
            {confirm}
          </div>
        }
      >
        {titleField(false)}
        {details}
      </ItemDialogFrame>
    );
  }

  return (
    // the frames render in portals, whose key events still bubble through here
    <div className="contents" onKeyDown={submitOnShortcut}>
      {frameFor()}
    </div>
  );
}

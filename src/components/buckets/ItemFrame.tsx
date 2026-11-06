import type { ReactNode, RefObject } from "react";
import { ItemDialogFrame } from "./ItemDialogFrame";
import { ItemPageFrame } from "./ItemPageFrame";
import { ItemPanelFrame, type AddPanel } from "./ItemPanelFrame";

type ItemFrameProps = {
  open: boolean;
  mode: "add" | "edit";
  isMobile: boolean;
  panel?: AddPanel;
  wide: boolean;
  scrollBodyRef: RefObject<HTMLDivElement | null>;
  titleField: ReactNode;
  details: ReactNode;
  confirm: ReactNode;
  deleteButton: ReactNode;
  onCancel: () => void;
};

// A phone gets a page; on a wider screen a new item grows out of the add box, an edit is a dialog
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
}: ItemFrameProps) {
  const heading = mode === "add" ? "new item" : "edit item";

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
        {titleField}
        {details}
      </ItemPageFrame>
    );
  }

  if (panel && mode === "add") {
    return (
      <ItemPanelFrame
        open={open}
        heading={heading}
        panel={panel}
        scrollBodyRef={scrollBodyRef}
        title={titleField}
        confirm={confirm}
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
      {titleField}
      {details}
    </ItemDialogFrame>
  );
}

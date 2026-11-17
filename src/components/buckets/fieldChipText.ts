import { formatDisplay } from "@/components/ui/DatePicker";
import { dueClock, dueDate } from "@/lib/format-date";
import type { FieldDef } from "@/types/rules";
import type { FieldChip } from "./ItemDetails";

export function isFieldSet(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim() !== "";
  return !Array.isArray(value) || value.length > 0;
}

function valueText(field: FieldDef, value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    return `${field.type === "currency" ? (field.currency ?? "") : ""}${value}`;
  }
  if (typeof value !== "string") return "";
  if (field.type === "date") return formatDisplay(value);
  if (field.type === "datetime") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? value : `${dueDate(d)} ${dueClock(d)}`;
  }
  return value;
}

// A set field reads "name value" with the name muted, an empty one is just its name
export function fieldChipText(field: FieldDef, value: unknown): { prefix?: string; label: string } {
  const name = field.icon ? `${field.icon} ${field.label}` : field.label;
  const text = isFieldSet(value) ? valueText(field, value) : "";
  if (text) return { prefix: name, label: text };
  return { label: field.validation?.required ? `${name} *` : name };
}

export function fieldChips(
  fields: FieldDef[],
  properties: Record<string, unknown>,
  attempted: boolean
): FieldChip[] {
  return fields.map((field) => {
    const value = properties[field.key];
    return {
      key: field.key,
      name: field.label,
      ...fieldChipText(field, value),
      set: isFieldSet(value),
      invalid: attempted && !!field.validation?.required && !isFieldSet(value),
      field,
      value,
    };
  });
}

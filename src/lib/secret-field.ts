// What a secret field of an admin form writes (entity fields and settings):
// undefined keeps the stored value (empty field), "" clears it (the Remove
// switch `<name>__clear`, or a single "-" in the field as before), anything
// else is the new value. The value itself is never shown again.
export function secretFormValue(raw: FormDataEntryValue | null, clear: FormDataEntryValue | null): string | undefined {
  if (clear === "1") return "";
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s) return undefined;
  return s === "-" ? "" : s;
}

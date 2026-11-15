"use client";

// Buttons that check the rights of a preset (lib/admin-perms.ts ROLE_PRESETS)
// in the rights boxes of an admin's page; saved only with the form.
export function PermPresets({ label, hint, presets }: { label: string; hint: string; presets: { id: string; name: string; perms: string[] }[] }) {
  const apply = (perms: string[]) => {
    for (const box of document.querySelectorAll<HTMLInputElement>('.perm-groups input[name="perm"]')) box.checked = perms.includes(box.value);
  };
  return (
    <div className="perm-presets">
      <span>{label}</span>
      {presets.map((p) => (
        <button key={p.id} type="button" className="button small" onClick={() => apply(p.perms)}>
          {p.name}
        </button>
      ))}
      <small className="muted">{hint}</small>
    </div>
  );
}

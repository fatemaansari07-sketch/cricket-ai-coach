// Storage keys break on spaces, brackets and non-ASCII characters, and phone
// gallery names are full of them ("VID 2025 (1).mp4", Hindi names, ...).
// Keep the extension, make the rest URL-safe.
export function safeFileName(name = "file") {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const clean = base.normalize("NFKD").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "file";
  return ext ? `${clean}.${ext}` : clean;
}

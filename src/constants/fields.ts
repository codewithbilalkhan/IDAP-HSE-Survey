export const FIELDS = {
  projectSite: "Project Site",
  performance: "Performance",
  submissionDate: "SubmissionDate", // agar column ka naam alag ho to yahan badlein
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/_x0020_/g, "")
    .replace(/[^a-z0-9]/g, "");

export function getField(item: any, name: string): string {
  const target = norm(name);
  for (const key of Object.keys(item)) {
    if (norm(key) === target) {
      const v = item[key];
      if (v == null) return "";
      if (typeof v === "object") return String(v.Value ?? v.LookupValue ?? "");
      return String(v).trim();
    }
  }
  return "";
}

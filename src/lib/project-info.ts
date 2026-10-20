// lib/project-info.ts
// SharePoint list "HSE Project Dates" se project ki info laata hai.

const SITE_URL = "https://idappk.sharepoint.com/sites/DummyProjects";
const LIST_TITLE = "HSE Project Dates";

export type ProjectInfo = {
  site: string;
  start: Date | null;
  end: Date | null;
  director: string;
  consultant: string;
  contractor: string;
};

/** "Project_x0020_Site" / "Project Site" / "projectSite" -> "projectsite" */
const norm = (s: string) =>
  String(s ?? "")
    .replace(/_x0020_/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

/** Choice, Person, Lookup, plain text — sab ko string bana deta hai */
const txt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
  if (typeof v === "object")
    return txt(v.Value ?? v.LookupValue ?? v.Title ?? v.Name ?? v.Email ?? "");
  return String(v);
};

const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  // 1900 / invalid dates = "not set"
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d;
};

const pick = (row: any, names: string[]) => {
  const map: Record<string, any> = {};
  Object.keys(row).forEach((k) => (map[norm(k)] = row[k]));
  for (const n of names) {
    const v = map[norm(n)];
    if (v !== undefined && v !== null && txt(v) !== "") return v;
  }
  return null;
};

let cache: any[] | null = null;

export async function fetchProjectInfo(
  spToken: string,
  site: string,
  force = false,
): Promise<ProjectInfo | null> {
  if (!cache || force) {
    const url =
      `${SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')` +
      `/items?$top=5000`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${spToken}`,
        Accept: "application/json;odata=nometadata",
      },
    });
    if (!res.ok) throw new Error(`Project info load nahi hui (${res.status})`);
    const json = await res.json();
    cache = json.value ?? [];
  }

  const target = norm(site);
  const rows = cache ?? [];

  // Is list ke columns ke internal naam field_1..field_7 hain (Title khali).
  // Isliye site ko row ki kisi bhi text value mein dhoondte hain.
  let row: any = null;
  let siteKey = "";
  for (const r of rows) {
    const k = Object.keys(r).find(
      (key) => typeof r[key] === "string" && norm(r[key]) === target,
    );
    if (k) {
      row = r;
      siteKey = k;
      break;
    }
  }

  if (!row) {
    const sample = rows
      .slice(0, 4)
      .map((r) =>
        Object.keys(r)
          .filter((k) => /^field_/.test(k))
          .map((k) => txt(r[k]))
          .join(" ; "),
      )
      .join("\n");
    throw new Error(
      `"${site}" list mein nahi mila.\nRows: ${rows.length}\nSample:\n${sample}`,
    );
  }

  // List ki order: Project Site, Site Short, Start, Completion, Director, Consultant, Contractor
  // Site wale column se aage ke columns offset se uthate hain.
  const m = /^field_(\d+)$/.exec(siteKey);
  const at = (offset: number) =>
    m ? row[`field_${Number(m[1]) + offset}`] : undefined;

  return {
    site,
    start: toDate(at(2) ?? pick(row, ["StartDate", "Start Date"])),
    end: toDate(at(3) ?? pick(row, ["CompletionDate", "Completion Date"])),
    director: txt(at(4) ?? pick(row, ["ProjectDirector", "Project Director"])),
    consultant: txt(at(5) ?? pick(row, ["Consultant"])),
    contractor: txt(at(6) ?? pick(row, ["Contractor", "Contractors"])),
  };
}

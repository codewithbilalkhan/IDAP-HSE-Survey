const RESPONDENT_KEY = ""; // asal key yahan likhein (lowercase mein)
const RATING: Record<string, number> = {
  excellent: 5,
  good: 4,
  fair: 3,
  poor: 2,
  "very poor": 1,
};

const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Power Apps ki 19 categories (question column numbers)
const CATEGORIES: number[][] = [
  range(2, 10), // Housekeeping
  range(11, 19), // PPE
  range(20, 28), // Excavation
  [29, 30, 31, 32, 36, 37, 38, 39], // WAH
  range(40, 48), // Scaffold
  range(49, 57), // Lifting
  range(58, 61), // Risk Assessment
  range(62, 70), // Tools
  range(71, 78), // Fire
  range(79, 82), // Permits
  range(83, 89), // Electrical
  range(90, 96), // Hot Work
  range(97, 99), // Lighting
  range(100, 106), // Training
  range(107, 111), // Inspections
  range(112, 116), // Statistics
  range(117, 120), // Incentives
  range(121, 126), // Health
  range(127, 130), // Confined Space
];

// SharePoint keys ko decode karta hai: "_x0031_0" -> "10"
const decode = (k: string) =>
  k
    .replace(/_x([0-9a-fA-F]{4})_/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    )
    .toLowerCase();

function flat(item: any): Record<string, any> {
  const src = { ...(item ?? {}), ...(item?.fields ?? {}) };
  const out: Record<string, any> = {};
  for (const k of Object.keys(src)) out[decode(k)] = src[k];
  return out;
}

const text = (v: any): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "object") {
    return String(
      v.LookupValue ?? v.displayName ?? v.Email ?? v.Value ?? v.value ?? "",
    ).trim();
  }
  return String(v).trim();
};

function answer(f: Record<string, any>, n: number): string {
  return text(f[String(n)] ?? f[`field_${n}`]);
}

// Ek survey ka score (Power Apps: catSum / catCount)
export function surveyScore(item: any): number {
  const f = flat(item);
  let sum = 0;
  let count = 0;
  for (const qs of CATEGORIES) {
    let t = 0;
    let c = 0;
    for (const q of qs) {
      const a = answer(f, q).toLowerCase();
      if (!a || a === "not applicable") continue;
      t += RATING[a] ?? 0;
      c++;
    }
    if (c > 0) {
      sum += t / c;
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

function respondentOf(f: Record<string, any>): string {
  return text(f["title"]).toLowerCase();
}
function isToday(value: any) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function computeKpis(items: any[], siteOf: (i: any) => string) {
  const siteTotals = new Map<string, { sum: number; n: number }>();
  const people = new Set<string>();
  let today = 0;

  for (const i of items) {
    const site = siteOf(i);
    if (site) {
      const cur = siteTotals.get(site) ?? { sum: 0, n: 0 };
      cur.sum += surveyScore(i);
      cur.n += 1;
      siteTotals.set(site, cur);
    }

    const r = respondentOf(flat(i));
    if (r) people.add(r);

    const created = i._created ?? i?.fields?.Created ?? i?.Created;
    if (isToday(created)) today++;
  }

  const top = Array.from(siteTotals.entries())
    .map(([site, v]) => ({ site, avg: v.sum / v.n, surveys: v.n }))
    .filter((t) => t.avg > 0)
    .sort((a, b) => b.avg - a.avg);

  let poor = 0;
  siteTotals.forEach((v) => {
    if (v.sum / v.n <= 2.5) poor++;
  });

  const avgs = Array.from(siteTotals.values()).map((v) => v.sum / v.n);
  const pct = (n: number) =>
    avgs.length === 0 ? 0 : Math.round((n / avgs.length) * 10000) / 100;

  const breakdown = [
    { status: "Excellent", count: pct(avgs.filter((a) => a >= 4.5).length) },
    {
      status: "Good",
      count: pct(avgs.filter((a) => a >= 3.5 && a < 4.5).length),
    },
    {
      status: "Fair",
      count: pct(avgs.filter((a) => a >= 2.5 && a < 3.5).length),
    },
    {
      status: "Poor",
      count: pct(avgs.filter((a) => a >= 1.5 && a < 2.5).length),
    },
    { status: "Very Poor", count: pct(avgs.filter((a) => a < 1.5).length) },
  ];

  return {
    sites: siteTotals.size,
    respondents: people.size,
    today,
    poor,
    breakdown,
    top,
  };
}

export const CATEGORY_META = [
  { name: "Waste Mgmt / Housekeeping", icon: "trash-outline" },
  {
    name: "Personal Protection Equipment (PPE)",
    icon: "shield-checkmark-outline",
  },
  { name: "Excavation", icon: "construct-outline" },
  { name: "Working at Height", icon: "arrow-up-circle-outline" },
  { name: "Scaffold & Ladders", icon: "git-network-outline" },
  { name: "Hoisting & Lifting", icon: "cog-outline" },
  { name: "Risk Assessment", icon: "warning-outline" },
  { name: "Tools & Equipment", icon: "hammer-outline" },
  { name: "Fire Protection", icon: "flame-outline" },
  { name: "Permits", icon: "document-text-outline" },
  { name: "Electrical Safety", icon: "flash-outline" },
  { name: "Hot Works", icon: "bonfire-outline" },
  { name: "Lighting & Ventilation", icon: "bulb-outline" },
  { name: "HSE Training & Induction", icon: "school-outline" },
  { name: "Observations & Meetings", icon: "search-outline" },
  { name: "Statistics & Reporting", icon: "stats-chart-outline" },
  { name: "Incentives & Discipline", icon: "ribbon-outline" },
  { name: "Health & Medical", icon: "medkit-outline" },
  { name: "Confined Space", icon: "contract-outline" },
];

export function levelOf(avg: number) {
  if (avg >= 4.5) return "Excellent";
  if (avg >= 3.5) return "Good";
  if (avg >= 2.5) return "Fair";
  if (avg >= 1.5) return "Poor";
  return "Very Poor";
}

function categoryScores(item: any): (number | null)[] {
  const f = flat(item);
  return CATEGORIES.map((qs) => {
    let t = 0;
    let c = 0;
    for (const q of qs) {
      const a = answer(f, q).toLowerCase();
      if (!a || a === "not applicable") continue;
      t += RATING[a] ?? 0;
      c++;
    }
    return c > 0 ? t / c : null;
  });
}

export function siteDetail(
  items: any[],
  siteOf: (i: any) => string,
  site: string,
) {
  const rows = items.filter((i) => siteOf(i) === site);
  const sums = CATEGORIES.map(() => ({ t: 0, n: 0 }));
  let total = 0;
  let last = 0;

  for (const r of rows) {
    let s = 0;
    let c = 0;
    categoryScores(r).forEach((v, idx) => {
      if (v === null) return;
      sums[idx].t += v;
      sums[idx].n += 1;
      s += v;
      c += 1;
    });
    total += c > 0 ? s / c : 0;

    const d = new Date(r._created ?? r?.fields?.Created ?? "");
    if (!isNaN(d.getTime())) last = Math.max(last, d.getTime());
  }

  const avg = rows.length ? total / rows.length : 0;
  const categories = CATEGORY_META.map((m, i) => ({
    name: m.name,
    icon: m.icon,
    score: sums[i].n ? sums[i].t / sums[i].n : 0,
  }));

  return {
    avg,
    level: levelOf(avg),
    surveys: rows.length,
    last: last ? new Date(last) : null,
    categories,
  };
}

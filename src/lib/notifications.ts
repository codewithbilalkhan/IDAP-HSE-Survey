import { useMemo, useSyncExternalStore } from "react";

import { FIELDS, getField } from "@/constants/fields";
import { siteDetail } from "@/lib/hse-kpis";
import { getCache, getCacheVersion, subscribeCache } from "@/lib/survey-cache";

/* ---------------- safe storage ---------------- */
type Store = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

let storage: Store | null = null;
try {
  storage = require("expo-sqlite/kv-store").default;
} catch {
  try {
    storage = require("@react-native-async-storage/async-storage").default;
  } catch {
    storage = null;
  }
}

console.log("storage available:", !!storage);

export type NotifKind = "alert" | "survey";
export type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  site: string;
  who: string;
  score: number;
  level: string;
  time: Date;
  unread?: boolean;
};

const DAY = 86400000;
const MAX = 40;
const UNREAD_WINDOW = 2 * DAY;

/* ---------------- helpers ---------------- */
const siteOf = (i: any) => getField(i, FIELDS.projectSite);

// SharePoint site ka timezone (list mein jo time dikhta hai)
const SP_TZ = "America/Los_Angeles";

const toSiteTime = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: SP_TZ,
    hour12: false,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(d);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return new Date(
    g("year"),
    g("month") - 1,
    g("day"),
    g("hour") % 24,
    g("minute"),
  );
};

const dateOf = (it: any): Date | null => {
  const raw = getField(it, FIELDS.submissionDate) || it?._created;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : toSiteTime(d);
};
const respondentOf = (item: any): string => {
  const f = item?.fields ?? item ?? {};
  const t = String(f.Title ?? "").trim();
  if (t) return t;
  const k = Object.keys(f).find((x) => /^respondent$/i.test(x));
  const r = k ? f[k] : undefined;
  return typeof r === "string" ? r.trim() : "";
};

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const levelOf = (n: number) =>
  n >= 4.5
    ? "Excellent"
    : n >= 3.5
      ? "Good"
      : n >= 2.5
        ? "Fair"
        : n >= 1.5
          ? "Poor"
          : "Very Poor";

/* ---------------- build ---------------- */
function build(items: any[] | null | undefined): Notif[] {
  if (!items?.length) return [];

  const dated = items
    .map((it) => ({ it, d: dateOf(it) }))
    .filter((x): x is { it: any; d: Date } => !!x.d)
    .sort((a, b) => b.d.getTime() - a.d.getTime())
    .slice(0, MAX);

  const out: Notif[] = [];
  for (const { it, d } of dated) {
    const site = siteOf(it);
    if (!site) continue;

    let score = 0;
    try {
      score = siteDetail([it], siteOf, site).avg || 0;
    } catch {}

    const level = score > 0 ? levelOf(score) : "";
    const who = nameFromEmail(respondentOf(it)) || "A surveyor";
    const rawId = it?.id ?? it?.ID ?? it?.fields?.id ?? it?.fields?.ID;
    const id = String(rawId ?? `${site}|${d.getTime()}`);

    if (score > 0 && score < 2.5) {
      out.push({
        id,
        kind: "alert",
        title: "Low score alert",
        body: `${site} scored ${score.toFixed(1)} (${level}). Needs attention.`,
        site,
        who,
        score,
        level,
        time: d,
      });
    } else {
      out.push({
        id,
        kind: "survey",
        title: "New survey submitted",
        body: site,
        site,
        who,
        score,
        level,
        time: d,
      });
    }
  }
  return out;
}

/* ---------------- read state (tiny store) ---------------- */
const KEY = "notif-read-state-v2";
const MAX_SAVED = 500;
const listeners = new Set<() => void>();
let version = 0;
let hydrated = false;
let baseline = Date.now() - UNREAD_WINDOW;
const readIds = new Set<string>();
let snap = {
  hydrated: false,
  baseline,
  ids: new Set<string>() as Set<string>,
};

const emit = () => {
  version++;
  snap = { hydrated, baseline, ids: new Set(readIds) };
  listeners.forEach((l) => l());
};
const getSnap = () => snap;
const persist = () => {
  try {
    storage
      ?.setItem(
        KEY,
        JSON.stringify({
          baseline,
          ids: Array.from(readIds).slice(-MAX_SAVED),
        }),
      )
      .catch(() => {});
  } catch {}
};
export async function hydrateNotifications() {
  try {
    const raw = await storage?.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.baseline === "number") baseline = p.baseline;
      readIds.clear();
      (p.ids ?? []).forEach((id: string) => readIds.add(id));
    } else {
      persist();
    }
    hydrated = true;
  } catch {
    hydrated = true;
    storage = null;
  }
  emit();
}
hydrateNotifications();

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getVersion = () => version;

export const isUnread = (n: Notif) =>
  hydrated && !readIds.has(n.id) && n.time.getTime() > baseline;

export function markRead(id: string) {
  if (!readIds.has(id)) {
    readIds.add(id);
    persist();
    emit();
  }
}

export function markAllRead(list?: Notif[]) {
  const src = Array.isArray(list) ? list : build(getCache());
  src.forEach((n) => readIds.add(n.id));
  persist();
  emit();
}

export function clearNotifications() {
  baseline = Date.now() - UNREAD_WINDOW;
  readIds.clear();
  try {
    storage?.removeItem(KEY).catch(() => {});
  } catch {}
  emit();
}

export function useNotifications(items?: any[] | null) {
  const rs = useSyncExternalStore(subscribe, getSnap, getSnap);
  const cacheVer = useSyncExternalStore(
    subscribeCache,
    getCacheVersion,
    getCacheVersion,
  );
  const source = items && items.length ? items : getCache();
  const list = useMemo(
    () =>
      build(source).map((n) => ({
        ...n,
        unread:
          rs.hydrated && !rs.ids.has(n.id) && n.time.getTime() > rs.baseline,
      })),
    [source, cacheVer, rs],
  );
  const unread = useMemo(() => list.filter((n) => n.unread).length, [list]);
  return { list, unread };
}

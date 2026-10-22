// lib/notifications.ts
// Notifications survey data se bante hain (naya survey + low score alert).
// Read/unread state abhi memory mein hai (app band hone par reset).
import { useMemo, useSyncExternalStore } from "react";

import { FIELDS, getField } from "@/constants/fields";
import { siteDetail } from "@/lib/hse-kpis";
import { getCache } from "@/lib/survey-cache";

export type NotifKind = "alert" | "survey";
export type Notif = {
  id: string;
  kind: NotifKind;
  title: string;
  body: string;
  site: string;
  who: string;
  score: number; // 0 = score available nahi
  level: string;
  time: Date;
};

const DAY = 86400000;
const MAX = 40;
const UNREAD_WINDOW = 2 * DAY; // pehli baar: pichle 2 din ke surveys unread

/* ---------------- helpers ---------------- */
const siteOf = (i: any) => getField(i, FIELDS.projectSite);

const dateOf = (it: any): Date | null => {
  const raw = getField(it, FIELDS.submissionDate) || it?._created;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

// "Respondent" column ka internal name Title hai
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
const listeners = new Set<() => void>();
let version = 0;
let baseline = Date.now() - UNREAD_WINDOW;
const readIds = new Set<string>();

const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getVersion = () => version;

export const isUnread = (n: Notif) =>
  !readIds.has(n.id) && n.time.getTime() > baseline;

export function markRead(id: string) {
  if (!readIds.has(id)) {
    readIds.add(id);
    emit();
  }
}

export function markAllRead() {
  baseline = Date.now();
  readIds.clear();
  emit();
}

// Sign out par call karo (clearHeaderProfile ke saath)
export function clearNotifications() {
  baseline = Date.now() - UNREAD_WINDOW;
  readIds.clear();
  emit();
}

/* ---------------- hook ---------------- */
export function useNotifications() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const cache = getCache();
  const list = useMemo(() => build(cache), [cache]);
  const unread = list.filter(isUnread).length;
  return { list, unread };
}

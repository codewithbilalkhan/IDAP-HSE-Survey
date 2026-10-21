import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { BottomNav, navSpace } from "@/components/bottom-nav";
import { ScrollTopButton } from "@/components/scroll-top-button";
import { SideDrawer } from "@/components/side-drawer";
import { FIELDS, getField } from "@/constants/fields";
import { SITE_CITY } from "@/constants/site-cities";
import { SITE_IMAGES } from "@/constants/site-images";
import { C, shadow } from "@/constants/theme";
import { getSurveyItems } from "@/hooks/sharepoint";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
import { computeKpis } from "@/lib/hse-kpis";
import { getCache, setCache } from "@/lib/survey-cache";

const GOLD = "#EC991B";
const DAY = 86400000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const MEDAL = ["#F5B731", "#B8BCC4", "#C98B5A"];

const LEVEL_COLOR = {
  Excellent: "#F8BF32",
  Good: "#7D7D7D",
  Fair: "#FF9900",
  Poor: "#E5484D",
  "Very Poor": "#8E1F24",
};
const colorOf = (v: number) =>
  v >= 4.5
    ? LEVEL_COLOR.Excellent
    : v >= 3.5
      ? LEVEL_COLOR.Good
      : v >= 2.5
        ? LEVEL_COLOR.Fair
        : v >= 1.5
          ? LEVEL_COLOR.Poor
          : LEVEL_COLOR["Very Poor"];

const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

const ago = (d: Date) => {
  const days = Math.floor((Date.now() - d.getTime()) / DAY);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    return `${m} ${m === 1 ? "month" : "months"} ago`;
  }
  const y = Math.floor(days / 365);
  return `${y} ${y === 1 ? "year" : "years"} ago`;
};

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

const siteInitials = (name: string) => {
  const w = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "S";
};

/* ---------- photo (Microsoft 365) ---------- */
const photoCache = new Map<string, string | null>();

function Photo({
  email,
  name,
  token,
  size,
}: {
  email: string;
  name: string;
  token: string;
  size: number;
}) {
  const key = email.toLowerCase();
  const [uri, setUri] = useState<string | null>(photoCache.get(key) ?? null);

  useEffect(() => {
    if (!email || !token || photoCache.has(key)) {
      setUri(photoCache.get(key) ?? null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) {
          photoCache.set(key, null);
          return;
        }
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const data = reader.result as string;
          photoCache.set(key, data);
          if (alive) setUri(data);
        };
        reader.readAsDataURL(blob);
      } catch {
        // keep initials
      }
    })();
    return () => {
      alive = false;
    };
  }, [email, key, token]);

  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size * 0.34 },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[s.avatarText, { fontSize: size * 0.34 }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/* ---------- animations ---------- */
function Rise({ i = 0, children }: { i?: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 80 + Math.min(i, 8) * 80,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, i]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [26, 0],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function CountUp({ value, style }: { value: number; style: any }) {
  const a = useRef(new Animated.Value(0)).current;
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = a.addListener(({ value: v }) => setN(Math.round(v)));
    Animated.timing(a, {
      toValue: value,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => a.removeListener(id);
  }, [value, a]);
  return <Text style={style}>{n}</Text>;
}

function Bar({
  pct,
  color,
  delay = 0,
}: {
  pct: number;
  color: string;
  delay?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: pct,
      duration: 900,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, delay, v]);
  return (
    <View style={s.barTrack}>
      <Animated.View
        style={{
          height: "100%",
          borderRadius: 2,
          backgroundColor: color,
          width: v.interpolate({
            inputRange: [0, 100],
            outputRange: ["0%", "100%"],
          }),
        }}
      />
    </View>
  );
}

/* ---------- site row ---------- */
type SiteRow = {
  site: string;
  count: number;
  last: Date | null;
  score: number;
};

function SiteItem({
  r,
  max,
  index,
  onPress,
}: {
  r: SiteRow;
  max: number;
  index: number;
  onPress: () => void;
}) {
  const src = SITE_IMAGES[r.site];
  const city = SITE_CITY[r.site] ?? "Punjab";
  const col = r.score > 0 ? colorOf(r.score) : "#B8B5AE";
  const pct = max > 0 ? (r.count / max) * 100 : 0;

  return (
    <Rise i={index}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.row,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={[s.accent, { backgroundColor: col }]} />

        {src ? (
          <Image source={src} style={s.photo} resizeMode="cover" />
        ) : (
          <View style={[s.photo, s.noPhoto]}>
            <Text style={s.mono}>{siteInitials(r.site)}</Text>
          </View>
        )}

        <View style={{ flex: 1 }}>
          <Text style={s.siteName} numberOfLines={2}>
            {r.site}
          </Text>
          <View style={s.metaRow}>
            <Ionicons name="location-sharp" size={12} color={GOLD} />
            <Text style={s.meta} numberOfLines={1}>
              {city}
            </Text>
            {r.last ? (
              <>
                <Text style={s.dotSep}>•</Text>
                <Text style={s.meta}>{fmt(r.last)}</Text>
              </>
            ) : null}
          </View>
          <Bar pct={pct} color={col} delay={150 + Math.min(index, 8) * 60} />
        </View>

        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View style={s.countPill}>
            <Ionicons name="document-text" size={11} color={GOLD} />
            <Text style={s.countPillText}>{r.count}</Text>
          </View>
          {r.score > 0 ? (
            <View style={[s.scorePill, { backgroundColor: col }]}>
              <Text style={s.scorePillText}>{r.score.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
    </Rise>
  );
}

/* ---------- screen ---------- */
const SORTS = ["Recent", "Most Surveys", "Top Score"] as const;

export default function RespondentDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { email = "" } = useLocalSearchParams<{ email?: string }>();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>(getCache() ?? []);
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Recent");
  const listRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getSurveyItems(accessToken);
      setCache(data);
      setItems(data);
    } catch {}
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && !getCache()) load();
  }, [accessToken, load]);

  useEffect(() => {
    if (!accessToken) router.replace("/");
  }, [accessToken, router]);

  const scoreMap = useMemo(() => {
    const top = computeKpis(items, (i) => getField(i, FIELDS.projectSite)).top;
    return new Map<string, number>(top.map((x: any) => [x.site, x.avg]));
  }, [items]);

  const d = useMemo(() => {
    const key = email.toLowerCase();
    const counts = new Map<string, number>();
    const sites = new Map<string, { count: number; last: Date | null }>();
    let total = 0;
    let last: Date | null = null;
    let lastSite = "";
    let realEmail = email;

    for (const it of items) {
      const e = String(it?.Title ?? it?.fields?.Title ?? "").trim();
      if (!e) continue;
      const k = e.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
      total += 1;
      if (k !== key) continue;

      realEmail = e;
      const site = getField(it, FIELDS.projectSite);
      const raw = getField(it, FIELDS.submissionDate) || it?._created;
      const dt = raw ? new Date(raw) : null;
      const date = dt && !isNaN(dt.getTime()) ? dt : null;

      if (site) {
        const cur = sites.get(site) ?? { count: 0, last: null };
        cur.count += 1;
        if (date && (!cur.last || date > cur.last)) cur.last = date;
        sites.set(site, cur);
      }
      if (date && (!last || date > last)) {
        last = date;
        lastSite = site || "";
      }
    }

    const surveys = counts.get(key) ?? 0;
    const rank =
      1 + Array.from(counts.values()).filter((c) => c > surveys).length;

    return {
      email: realEmail,
      name: nameFromEmail(realEmail),
      surveys,
      total,
      rank,
      people: counts.size,
      last,
      lastSite,
      sites,
    };
  }, [items, email]);

  const list: SiteRow[] = useMemo(() => {
    const arr = Array.from(d.sites.entries()).map(([site, v]) => ({
      site,
      count: v.count,
      last: v.last,
      score: scoreMap.get(site) ?? 0,
    }));
    arr.sort((a, b) =>
      sort === "Most Surveys"
        ? b.count - a.count
        : sort === "Top Score"
          ? b.score - a.score
          : (b.last?.getTime() ?? 0) - (a.last?.getTime() ?? 0),
    );
    return arr;
  }, [d.sites, scoreMap, sort]);

  const max = list.reduce((m, r) => Math.max(m, r.count), 0);
  const share = d.total > 0 ? Math.round((d.surveys / d.total) * 100) : 0;
  const medal = d.rank <= 3 ? MEDAL[d.rank - 1] : null;
  const lastSrc = d.lastSite ? SITE_IMAGES[d.lastSite] : null;

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <ScrollView
        ref={listRef}
        onScroll={(e) => {
          const show = e.nativeEvent.contentOffset.y > 350;
          setShowTop((p) => (p === show ? p : show));
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: navSpace(insets.bottom) + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

        <View style={s.body}>
          {/* profile hero */}
          <Rise i={0}>
            <View style={s.hero}>
              <View
                style={[
                  s.ring,
                  {
                    width: 280,
                    height: 280,
                    borderRadius: 140,
                    top: -130,
                    right: -110,
                  },
                ]}
              />
              <View
                style={[
                  s.ring,
                  {
                    width: 170,
                    height: 170,
                    borderRadius: 85,
                    top: -70,
                    right: -55,
                  },
                ]}
              />
              <View style={s.glow} />

              <Pressable
                onPress={() => router.back()}
                hitSlop={10}
                style={s.back}
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>

              <View style={s.rankChip}>
                <Ionicons name="trophy" size={12} color={medal ?? GOLD} />
                <Text style={s.rankChipText}>
                  RANK {d.rank}/{d.people}
                </Text>
              </View>

              <View style={s.avatarHalo}>
                <Photo
                  email={d.email}
                  name={d.name}
                  token={accessToken ?? ""}
                  size={104}
                />
                {medal ? (
                  <View style={[s.medal, { backgroundColor: medal }]}>
                    <Text style={s.medalText}>{d.rank}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={s.eyebrow}>RESPONDENT</Text>
              <Text style={s.heroName} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={s.heroMail} numberOfLines={1}>
                {d.email}
              </Text>

              <View style={s.statsRow}>
                <View style={s.statCol}>
                  <CountUp value={d.surveys} style={s.statNum} />
                  <Text style={s.statLbl}>SURVEYS</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statCol}>
                  <CountUp value={d.sites.size} style={s.statNum} />
                  <Text style={s.statLbl}>SITES</Text>
                </View>
                <View style={s.statDiv} />
                <View style={s.statCol}>
                  <Text style={s.statNum}>{share}%</Text>
                  <Text style={s.statLbl}>OF TOTAL</Text>
                </View>
              </View>
            </View>
          </Rise>

          {/* last survey */}
          <Rise i={1}>
            <View style={s.last}>
              <View style={s.lastAccent} />
              {lastSrc ? (
                <Image
                  source={lastSrc}
                  style={s.lastPhoto}
                  resizeMode="cover"
                />
              ) : (
                <View style={[s.lastPhoto, s.lastIcon]}>
                  <Ionicons name="time" size={24} color={GOLD} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.lastEyebrow}>LAST SURVEY</Text>
                <Text style={s.lastDate}>
                  {d.last ? fmt(d.last) : "No data"}
                </Text>
                {d.lastSite ? (
                  <View style={s.lastSiteRow}>
                    <Ionicons name="location-sharp" size={12} color={GOLD} />
                    <Text style={s.lastSite} numberOfLines={2}>
                      {d.lastSite}
                    </Text>
                  </View>
                ) : null}
              </View>
              {d.last ? (
                <View style={s.agoChip}>
                  <Text style={s.agoText}>{ago(d.last)}</Text>
                </View>
              ) : null}
            </View>
          </Rise>

          {/* breakdown header */}
          <Rise i={2}>
            <View style={s.secHead}>
              <View style={s.secBar} />
              <Text style={s.secTitle}>Site-wise Breakdown</Text>
              <View style={s.secCountBox}>
                <Text style={s.secCount}>{list.length}</Text>
                <Text style={s.secCountLbl}>SITES</Text>
              </View>
            </View>

            <View style={s.sorts}>
              {SORTS.map((t) => {
                const on = t === sort;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setSort(t)}
                    style={[s.sortChip, on && s.sortChipOn]}
                  >
                    <Text style={[s.sortText, on && s.sortTextOn]}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Rise>

          {list.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="business-outline" size={34} color="#C5C2BB" />
              <Text style={s.emptyTitle}>No sites found</Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {list.map((r, i) => (
                <SiteItem
                  key={r.site}
                  r={r}
                  max={max}
                  index={i}
                  onPress={() =>
                    router.push({
                      pathname: "/site",
                      params: { site: r.site },
                    } as any)
                  }
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ScrollTopButton
        visible={showTop}
        bottom={navSpace(insets.bottom) + 14}
        onPress={() => listRef.current?.scrollTo({ y: 0, animated: true })}
      />

      <BottomNav />
      <SideDrawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        profile={profile}
        onSignOut={signOut}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 20, marginTop: -48, gap: 14 },

  /* hero */
  hero: {
    backgroundColor: C.dark,
    borderRadius: 30,
    paddingTop: 30,
    paddingBottom: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.18)",
  },
  glow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: GOLD,
    opacity: 0.08,
    bottom: -150,
    left: -80,
  },
  back: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  rankChip: {
    position: "absolute",
    top: 20,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(249,162,30,0.14)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.4)",
  },
  rankChipText: {
    color: GOLD,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  avatarHalo: {
    padding: 6,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.35)",
    backgroundColor: "rgba(249,162,30,0.08)",
    marginTop: 6,
  },
  avatar: {
    backgroundColor: "#1E1E21",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: GOLD,
  },
  avatarText: { color: GOLD, fontWeight: "800" },
  medal: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: C.dark,
  },
  medalText: { color: "#111", fontSize: 12, fontWeight: "800" },
  eyebrow: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
    marginTop: 16,
  },
  heroName: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.6,
    marginTop: 4,
  },
  heroMail: {
    color: "#8E8E93",
    fontSize: 12.5,
    fontWeight: "500",
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statCol: { flex: 1, alignItems: "center" },
  statDiv: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.1)" },
  statNum: {
    color: GOLD,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  statLbl: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 3,
  },

  /* last survey */
  last: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 14,
    paddingLeft: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    ...shadow,
  },
  lastAccent: {
    position: "absolute",
    left: 0,
    top: 16,
    bottom: 16,
    width: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  lastPhoto: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "#E9E6DF",
  },
  lastIcon: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FDF2E0",
  },
  lastEyebrow: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2.2,
  },
  lastDate: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  lastSiteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  lastSite: {
    color: "#6E6E73",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  agoChip: {
    alignSelf: "flex-start",
    backgroundColor: C.dark,
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  agoText: { color: GOLD, fontSize: 10, fontWeight: "800" },

  /* section */
  secHead: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  secBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    marginRight: 10,
    backgroundColor: C.orange,
  },
  secTitle: {
    flex: 1,
    color: C.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  secCountBox: {
    backgroundColor: C.dark,
    borderRadius: 14,
    paddingHorizontal: 11,
    paddingVertical: 5,
    alignItems: "center",
  },
  secCount: { color: GOLD, fontSize: 15, fontWeight: "800", lineHeight: 17 },
  secCountLbl: {
    color: "#8E8E93",
    fontSize: 7.5,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  sorts: { flexDirection: "row", gap: 8, marginTop: 12 },
  sortChip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EAE7E1",
  },
  sortChipOn: { backgroundColor: C.dark },
  sortText: { color: "#6E6E73", fontSize: 12, fontWeight: "700" },
  sortTextOn: { color: GOLD },

  /* site row */
  row: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 12,
    paddingLeft: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    ...shadow,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderRadius: 2,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#E9E6DF",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
  },
  mono: { color: GOLD, fontWeight: "800", fontSize: 17, letterSpacing: 1 },
  siteName: { color: C.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 17 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  meta: { color: "#8E8E93", fontSize: 11.5, fontWeight: "500", flexShrink: 1 },
  dotSep: { color: "#C8C5BE", fontSize: 8 },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EFEDE8",
    overflow: "hidden",
    marginTop: 9,
  },
  countPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.dark,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  countPillText: { color: GOLD, fontSize: 12, fontWeight: "800" },
  scorePill: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 8,
    alignItems: "center",
  },
  scorePillText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 40, gap: 6 },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 6 },
});

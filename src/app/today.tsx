import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    Animated,
    Easing,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { BottomNav, navSpace } from "@/components/bottom-nav";
import { SideDrawer } from "@/components/side-drawer";
import { FIELDS, getField } from "@/constants/fields";
import { C } from "@/constants/theme";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
import { siteDetail } from "@/lib/hse-kpis";
import { levelOf } from "@/lib/notifications";
import { getCache, getCacheVersion, subscribeCache } from "@/lib/survey-cache";

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

const LEVEL_COLOR: Record<string, string> = {
  Excellent: C.orange,
  Good: "#8FB339",
  Fair: "#FCCB7E",
  Poor: C.red,
  "Very Poor": "#8E1F24",
};

type Cat = { label: string; value: number };
type Row = {
  id: string;
  site: string;
  email: string;
  who: string;
  initials: string;
  score: number;
  level: string;
  time: Date;
  cats: Cat[];
};

/* ---------------- data ---------------- */
const siteOf = (i: any) => getField(i, FIELDS.projectSite);

const dateOf = (it: any): Date | null => {
  const raw = getField(it, FIELDS.submissionDate) || it?._created;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
};

const isToday = (d: Date) => {
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
};

const emailOf = (item: any): string => {
  const f = item?.fields ?? item ?? {};
  return String(f.Title ?? "").trim();
};

const nameFromEmail = (email: string) =>
  email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const initialsOf = (name: string) => {
  const p = name.split(" ").filter(Boolean);
  if (!p.length) return "?";
  return ((p[0][0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
};

const fmtTime = (d: Date) => {
  let h = d.getHours();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`;
};

function build(items: any[] | null | undefined): Row[] {
  const out: Row[] = [];
  for (const it of items ?? []) {
    const d = dateOf(it);
    if (!d || !isToday(d)) continue;
    const site = siteOf(it);
    if (!site) continue;

    let score = 0;
    let cats: Cat[] = [];
    try {
      const det: any = siteDetail([it], siteOf, site);
      score = det?.avg || 0;
      const raw: any = det?.categories ?? det?.cats ?? [];
      if (Array.isArray(raw)) {
        cats = raw
          .map((c: any) => ({
            label: String(c.short ?? c.label ?? c.name ?? c.title ?? "")
              .slice(0, 3)
              .toUpperCase(),
            value: Number(c.avg ?? c.score ?? c.value ?? 0) || 0,
          }))
          .filter((c: Cat) => c.label);
      }
    } catch {}

    const email = emailOf(it);
    const who = nameFromEmail(email) || "Unknown";
    out.push({
      id: String(it?.id ?? it?.ID ?? `${site}|${d.getTime()}`),
      site,
      email,
      who,
      initials: initialsOf(who),
      score,
      level: score > 0 ? levelOf(score) : "N/A",
      time: d,
      cats,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}

/* ---------------- photo (Microsoft 365) ---------------- */
const photoCache = new Map<string, string | null>();

function Avatar({
  email,
  name,
  token,
  size = 46,
}: {
  email: string;
  name: string;
  token: string;
  size?: number;
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
        // initials rahenge
      }
    })();
    return () => {
      alive = false;
    };
  }, [email, key, token]);

  return (
    <View
      style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[s.avatarTxt, { fontSize: size * 0.33 }]}>
          {initialsOf(name)}
        </Text>
      )}
    </View>
  );
}

/* ---------------- small pieces ---------------- */
function Stat({
  icon,
  value,
  label,
  last,
}: {
  icon: any;
  value: number | string;
  label: string;
  last?: boolean;
}) {
  return (
    <View style={[s.stat, !last && s.statDiv]}>
      <Text style={s.statNum}>{value}</Text>
      <View style={s.statLabelRow}>
        <Ionicons name={icon} size={16} color={C.orange} />
        <Text style={s.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MiniBars({ cats }: { cats: Cat[] }) {
  if (!cats.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.barsRow}
    >
      {cats.map((c, i) => {
        const col = c.value > 0 ? LEVEL_COLOR[levelOf(c.value)] : C.line;
        return (
          <View key={c.label + i} style={s.barCol}>
            <View style={s.barTrack}>
              <View
                style={{
                  height: `${Math.min(100, (c.value / 5) * 100)}%`,
                  backgroundColor: col,
                  borderRadius: 4,
                }}
              />
            </View>
            <Text style={s.barLabel}>{c.label}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SurveyCard({
  r,
  i,
  token,
  onPress,
}: {
  r: Row;
  i: number;
  token: string;
  onPress: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 480,
      delay: 120 + Math.min(i, 8) * 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, i]);

  const color = LEVEL_COLOR[r.level] ?? C.gray;

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
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.card,
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        <View style={[s.accent, { backgroundColor: color }]} />

        <View style={s.cardTop}>
          <View>
            <Avatar email={r.email} name={r.who} token={token} />
            {i < 3 && (
              <View style={s.rank}>
                <Text style={s.rankTxt}>{i + 1}</Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.who} numberOfLines={1}>
              {r.who}
            </Text>
            <View style={s.siteRow}>
              <Ionicons name="location" size={12} color={C.orange} />
              <Text style={s.site} numberOfLines={1}>
                {r.site}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "center" }}>
            <View
              style={[
                s.scorePill,
                { backgroundColor: color + "26", borderColor: color + "88" },
              ]}
            >
              <Text
                style={[
                  s.scoreTxt,
                  { color: r.level === "Fair" ? "#C98A00" : color },
                ]}
              >
                {r.score > 0 ? r.score.toFixed(1) : "–"}
              </Text>
            </View>
            <Text
              style={[
                s.level,
                { color: r.level === "Fair" ? "#C98A00" : color },
              ]}
            >
              {r.level}
            </Text>
          </View>
        </View>

        <MiniBars cats={r.cats} />

        <View style={s.cardBottom}>
          <View style={s.timeRow}>
            <Ionicons name="time-outline" size={13} color={C.gray} />
            <Text style={s.time}>{fmtTime(r.time)}</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detail}>View Details</Text>
            <Ionicons name="arrow-forward" size={14} color={C.orange} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ---------------- screen ---------------- */
const FILTERS = ["All", "Excellent", "Good", "Fair", "Poor"] as const;

export default function TodaySurveys() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const cacheVer = useSyncExternalStore(
    subscribeCache,
    getCacheVersion,
    getCacheVersion,
  );
  const cache = getCache();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  const all = useMemo(() => build(cache), [cache, cacheVer]);

  const stats = useMemo(
    () => ({
      surveys: all.length,
      sites: new Set(all.map((r) => r.site)).size,
      people: new Set(all.map((r) => r.email || r.who)).size,
    }),
    [all],
  );

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter(
      (r) =>
        (filter === "All" ||
          r.level === filter ||
          (filter === "Poor" && r.level === "Very Poor")) &&
        (!t ||
          r.who.toLowerCase().includes(t) ||
          r.site.toLowerCase().includes(t)),
    );
  }, [all, q, filter]);

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: navSpace(insets.bottom) + 20 }}
      >
        {/* same header as the whole app */}
        <AppHeader profile={profile} onMenuPress={openMenu} />

        {/* title panel */}
        <View style={s.panel}>
          <View style={s.titleRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={s.back}
            >
              <Ionicons name="chevron-back" size={20} color={C.ink} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Today's Surveys</Text>
              <Text style={s.sub}>Ranked by survey score</Text>
            </View>
            <View style={s.countBox}>
              <Text style={s.countNum}>{list.length}</Text>
              <Text style={s.countLabel}>FOUND</Text>
            </View>
          </View>

          <View style={s.searchInner}>
            <Ionicons name="search" size={18} color="#9A9A9A" />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search by name or project"
              placeholderTextColor="#A8A8A8"
              style={s.inputInner}
              autoCorrect={false}
            />
            {!!q && (
              <Pressable onPress={() => setQ("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color="#B5B5B5" />
              </Pressable>
            )}
          </View>
        </View>

        {/* stats */}
        <View style={s.statsRow}>
          <Stat icon="clipboard" value={stats.surveys} label="Surveys" />
          <Stat icon="business" value={stats.sites} label="Sites" />
          <Stat icon="people" value={stats.people} label="Respondents" last />
        </View>

        <View style={s.body}>
          {/* filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 14 }}
          >
            {FILTERS.map((f) => {
              const on = filter === f;
              const n =
                f === "All"
                  ? all.length
                  : all.filter(
                      (r) =>
                        r.level === f ||
                        (f === "Poor" && r.level === "Very Poor"),
                    ).length;
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[s.chip, on && s.chipOn]}
                >
                  {f !== "All" && (
                    <View
                      style={[s.chipDot, { backgroundColor: LEVEL_COLOR[f] }]}
                    />
                  )}
                  <Text style={[s.chipTxt, on && { color: "#fff" }]}>{f}</Text>
                  <Text style={[s.chipCount, on && { color: C.orange }]}>
                    {n}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={s.sectionHead}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTxt}>TODAY'S SURVEYS · RANKED BY SCORE</Text>
          </View>

          {list.length === 0 ? (
            <View style={s.empty}>
              <View style={s.emptyRing}>
                <Ionicons
                  name="document-text-outline"
                  size={28}
                  color={C.orange}
                />
              </View>
              <Text style={s.emptyTitle}>
                {all.length === 0 ? "No surveys today yet" : "No matches found"}
              </Text>
              <Text style={s.emptySub}>
                {all.length === 0
                  ? "New surveys submitted today will appear here."
                  : "Try a different search or filter."}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 14 }}>
              {list.map((r, i) => (
                <SurveyCard
                  key={r.id}
                  r={r}
                  i={i}
                  token={accessToken ?? ""}
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

      <BottomNav />
      <SideDrawer
        open={menuOpen}
        onClose={closeMenu}
        profile={profile}
        onSignOut={signOut}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  /* title panel */
  panel: {
    marginHorizontal: 20,
    marginTop: -48,
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  sub: { color: "#8E8E93", fontSize: 11.5, marginTop: 1 },
  countBox: {
    backgroundColor: C.dark,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  countNum: {
    color: C.orange,
    fontSize: 18,
    fontWeight: "800",
    lineHeight: 20,
  },
  countLabel: {
    color: "#8E8E93",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    backgroundColor: "#F6F4F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
  },
  inputInner: { flex: 1, color: C.ink, fontSize: 14, paddingVertical: 0 },

  /* stats */
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 20,
    marginTop: 14,
    paddingVertical: 14,
    backgroundColor: C.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.line,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  stat: { flex: 1, alignItems: "center" },
  statDiv: { borderRightWidth: 1, borderRightColor: C.line },
  statNum: {
    color: C.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  statLabel: {
    color: C.gray,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  body: { paddingHorizontal: 20, marginTop: 8 },

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.dark, borderColor: C.dark },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipTxt: { color: C.ink, fontSize: 12.5, fontWeight: "700" },
  chipCount: { color: C.gray, fontSize: 12, fontWeight: "800" },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  sectionBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: C.orange,
  },
  sectionTxt: {
    color: C.gray,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 2.2,
  },

  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 16,
    paddingLeft: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 5 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    backgroundColor: C.dark,
    borderWidth: 1.5,
    borderColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarTxt: { color: C.orange, fontWeight: "800" },
  rank: {
    position: "absolute",
    right: -4,
    top: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.orange,
    borderWidth: 2,
    borderColor: C.card,
    alignItems: "center",
    justifyContent: "center",
  },
  rankTxt: { color: C.dark, fontSize: 9.5, fontWeight: "900" },
  who: { color: C.ink, fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  siteRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  site: { color: C.orange, fontSize: 12.5, fontWeight: "700", flexShrink: 1 },
  scorePill: {
    minWidth: 46,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  scoreTxt: { fontSize: 16, fontWeight: "800" },
  level: { fontSize: 11, fontWeight: "800", marginTop: 4 },

  barsRow: { gap: 10, paddingTop: 16, paddingBottom: 4 },
  barCol: { alignItems: "center", width: 26 },
  barTrack: {
    width: 18,
    height: 38,
    borderRadius: 6,
    backgroundColor: C.line,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  barLabel: {
    color: C.gray,
    fontSize: 8.5,
    fontWeight: "800",
    marginTop: 5,
    letterSpacing: 0.5,
  },

  cardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  time: { color: C.gray, fontSize: 11.5, fontWeight: "600" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  detail: { color: C.orange, fontSize: 12.5, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 50, gap: 8 },
  emptyRing: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.4)",
    backgroundColor: "rgba(249,162,30,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: C.ink, fontSize: 16, fontWeight: "800" },
  emptySub: {
    color: C.gray,
    fontSize: 12.5,
    textAlign: "center",
    paddingHorizontal: 30,
  },
});

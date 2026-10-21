import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ScrollTopButton } from "@/components/scroll-top-button";
import { SideDrawer } from "@/components/side-drawer";
import { FIELDS, getField } from "@/constants/fields";
import { C, shadow } from "@/constants/theme";
import { getSurveyItems } from "@/hooks/sharepoint";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
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

/* ---------------- data ---------------- */
type Resp = {
  email: string;
  name: string;
  sites: number;
  surveys: number;
  last: Date | null;
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

function summarize(items: any[]): Resp[] {
  const map = new Map<
    string,
    { email: string; sites: Set<string>; surveys: number; last: Date | null }
  >();
  for (const it of items) {
    const email = String(it?.Title ?? it?.fields?.Title ?? "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    const site = getField(it, FIELDS.projectSite);
    const raw = getField(it, FIELDS.submissionDate) || it?._created;
    const d = raw ? new Date(raw) : null;
    const date = d && !isNaN(d.getTime()) ? d : null;

    let cur = map.get(key);
    if (!cur) {
      cur = { email, sites: new Set(), surveys: 0, last: null };
      map.set(key, cur);
    }
    cur.surveys += 1;
    if (site) cur.sites.add(site);
    if (date && (!cur.last || date > cur.last)) cur.last = date;
  }
  return Array.from(map.values())
    .map((v) => ({
      email: v.email,
      name: nameFromEmail(v.email),
      sites: v.sites.size,
      surveys: v.surveys,
      last: v.last,
    }))
    .sort((a, b) => b.surveys - a.surveys);
}

/* ---------------- photo (Microsoft 365) ---------------- */
const photoCache = new Map<string, string | null>();

function Avatar({
  email,
  name,
  token,
  size = 54,
}: {
  email: string;
  name: string;
  token: string;
  size?: number;
}) {
  const key = email.toLowerCase();
  const [uri, setUri] = useState<string | null>(photoCache.get(key) ?? null);

  useEffect(() => {
    if (!token || photoCache.has(key)) {
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
        <Text style={[s.avatarText, { fontSize: size * 0.33 }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

/* ---------------- animation ---------------- */
function FadeIn({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 440,
      delay: Math.min(index, 8) * 50,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, index]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
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

function Bar({ pct, delay = 0 }: { pct: number; delay?: number }) {
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
        style={[
          s.barFill,
          {
            width: v.interpolate({
              inputRange: [0, 100],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

/* ---------------- pieces ---------------- */
const MEDAL = ["#F5B731", "#B8BCC4", "#C98B5A"];

function RespRow({
  r,
  rank,
  max,
  token,
  index,
}: {
  r: Resp;
  rank: number;
  max: number;
  token: string;
  index: number;
}) {
  const medal = rank < 3 ? MEDAL[rank] : null;
  const pct = max > 0 ? (r.surveys / max) * 100 : 0;

  return (
    <View style={s.row}>
      <View style={[s.accent, { backgroundColor: GOLD }]} />

      <View>
        <Avatar email={r.email} name={r.name} token={token} />
        {medal ? (
          <View style={[s.medal, { backgroundColor: medal }]}>
            <Text style={s.medalText}>{rank + 1}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={1}>
          {r.name}
        </Text>
        <Text style={s.mail} numberOfLines={1}>
          {r.email}
        </Text>

        <View style={s.stats}>
          <View style={s.stat}>
            <Ionicons name="business-outline" size={12} color={GOLD} />
            <Text style={s.statNum}>{r.sites}</Text>
            <Text style={s.statLbl}>{r.sites === 1 ? "site" : "sites"}</Text>
          </View>
          <View style={s.statDot} />
          <View style={s.stat}>
            <Ionicons name="document-text-outline" size={12} color={GOLD} />
            <Text style={s.statNum}>{r.surveys}</Text>
            <Text style={s.statLbl}>
              {r.surveys === 1 ? "survey" : "surveys"}
            </Text>
          </View>
        </View>

        <Bar pct={pct} delay={150 + Math.min(index, 8) * 60} />

        {r.last ? (
          <View style={s.lastRow}>
            <Ionicons name="time-outline" size={11} color="#A0A0A0" />
            <Text style={s.lastText}>
              Last survey {fmt(r.last)} · {ago(r.last)}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/* ---------------- screen ---------------- */
export default function Respondents() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>(getCache() ?? []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const listRef = useRef<FlatList>(null);
  const [showTop, setShowTop] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const data = await getSurveyItems(accessToken);
      setCache(data);
      setItems(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && !getCache()) load();
  }, [accessToken, load]);

  useEffect(() => {
    if (!accessToken) router.replace("/");
  }, [accessToken, router]);

  const all = useMemo(() => summarize(items), [items]);
  const totalSurveys = useMemo(
    () => all.reduce((a, r) => a + r.surveys, 0),
    [all],
  );
  const max = all[0]?.surveys ?? 0;

  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    all.forEach((r, i) => m.set(r.email.toLowerCase(), i));
    return m;
  }, [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) =>
        r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [all, query]);

  const header = (
    <View>
      <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

      <View style={s.panel}>
        <View style={s.titleRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Respondents</Text>
            <Text style={s.sub}>Sites covered and surveys done</Text>
          </View>
          <View style={s.countBox}>
            <Text style={s.countNum}>{list.length}</Text>
            <Text style={s.countLabel}>FOUND</Text>
          </View>
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color="#9A9A9A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or email"
            placeholderTextColor="#A8A8A8"
            style={s.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#B5B5B5" />
            </Pressable>
          )}
        </View>
      </View>

      {/* summary hero */}
      <View style={s.hero}>
        <View
          style={[
            s.ring,
            {
              width: 220,
              height: 220,
              borderRadius: 110,
              top: -100,
              right: -80,
            },
          ]}
        />
        <View
          style={[
            s.ring,
            { width: 130, height: 130, borderRadius: 65, top: -45, right: -25 },
          ]}
        />
        <View style={s.heroCol}>
          <Text style={s.heroEyebrow}>RESPONDENTS</Text>
          <CountUp value={all.length} style={s.heroNum} />
        </View>
        <View style={s.heroDiv} />
        <View style={s.heroCol}>
          <Text style={s.heroEyebrow}>TOTAL SURVEYS</Text>
          <CountUp value={totalSurveys} style={s.heroNum} />
        </View>
        <View style={s.heroDiv} />
        <View style={s.heroCol}>
          <Text style={s.heroEyebrow}>TOP</Text>
          <Text style={s.heroTop} numberOfLines={1}>
            {all[0]?.name.split(" ")[0] ?? "-"}
          </Text>
        </View>
      </View>

      <View style={s.rankHead}>
        <View style={s.rankBar} />
        <Text style={s.rankTitle}>RANKED BY SURVEYS</Text>
      </View>
    </View>
  );

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <FlatList
        ref={listRef}
        onScroll={(e) => {
          const show = e.nativeEvent.contentOffset.y > 350;
          setShowTop((prev) => (prev === show ? prev : show));
        }}
        scrollEventThrottle={16}
        data={list}
        keyExtractor={(i) => i.email.toLowerCase()}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.orange}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="people-outline" size={34} color="#C5C2BB" />
            <Text style={s.emptyTitle}>
              {loading ? "Loading respondents..." : "No respondents found"}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <FadeIn index={index}>
              <RespRow
                r={item}
                rank={rankOf.get(item.email.toLowerCase()) ?? index}
                max={max}
                token={accessToken ?? ""}
                index={index}
              />
            </FadeIn>
          </View>
        )}
      />

      <ScrollTopButton
        visible={showTop}
        bottom={insets.bottom + 100}
        onPress={() =>
          listRef.current?.scrollToOffset({ offset: 0, animated: true })
        }
      />
      <BottomNav />

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

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  panel: {
    marginHorizontal: 20,
    marginTop: -48,
    backgroundColor: C.card,
    borderRadius: 28,
    padding: 16,
    ...shadow,
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
  title: { color: C.ink, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
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

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
    backgroundColor: "#F6F4F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 46,
  },
  input: { flex: 1, color: C.ink, fontSize: 14, paddingVertical: 0 },

  hero: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: C.dark,
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
  },
  ring: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.16)",
  },
  heroCol: { flex: 1, alignItems: "center" },
  heroDiv: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.1)" },
  heroEyebrow: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroNum: {
    color: GOLD,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 5,
  },
  heroTop: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 9,
    maxWidth: 90,
  },

  rankHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    marginTop: 22,
    marginBottom: 14,
  },
  rankBar: { width: 4, height: 14, borderRadius: 2, backgroundColor: C.orange },
  rankTitle: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },

  row: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 12,
    paddingLeft: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
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

  avatar: {
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(249,162,30,0.55)",
  },
  avatarText: { color: GOLD, fontWeight: "800" },
  medal: {
    position: "absolute",
    right: -5,
    bottom: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  medalText: { color: "#111", fontSize: 10, fontWeight: "800" },

  name: { color: C.ink, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  mail: { color: "#8E8E93", fontSize: 11.5, fontWeight: "500", marginTop: 1 },

  stats: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 9 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statNum: { color: C.ink, fontSize: 13, fontWeight: "800" },
  statLbl: { color: "#8E8E93", fontSize: 11, fontWeight: "600" },
  statDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#CFCBC3" },

  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EFEDE8",
    overflow: "hidden",
    marginTop: 9,
  },
  barFill: { height: "100%", borderRadius: 2, backgroundColor: GOLD },

  lastRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  lastText: { color: "#A0A0A0", fontSize: 10.5, fontWeight: "600" },

  empty: { alignItems: "center", paddingTop: 50, gap: 6 },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 6 },
});

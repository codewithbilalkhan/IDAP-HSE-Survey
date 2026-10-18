import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
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

const FILTERS = [
  "All",
  "Excellent",
  "Good",
  "Fair",
  "Poor",
  "Very Poor",
] as const;
type Filter = (typeof FILTERS)[number];

function levelOf(avg: number): Exclude<Filter, "All"> {
  if (avg >= 4.5) return "Excellent";
  if (avg >= 3.5) return "Good";
  if (avg >= 2.5) return "Fair";
  if (avg >= 1.5) return "Poor";
  return "Very Poor";
}

const LEVEL_COLOR: Record<string, string> = {
  Excellent: "#F8BF32",
  Good: "#7D7D7D",
  Fair: "#FF9900",
  Poor: "#E5484D",
  "Very Poor": "#8E1F24",
};

type Site = { site: string; avg: number; surveys: number };

function initials(name: string) {
  const w = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "S";
}

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
      duration: 420,
      delay: Math.min(index, 8) * 45,
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
              outputRange: [16, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function SiteRow({
  item,

  onPress,
}: {
  item: Site;

  onPress: () => void;
}) {
  const src = SITE_IMAGES[item.site];
  const color = LEVEL_COLOR[levelOf(item.avg)];
  const pct = Math.max(0, Math.min(100, (item.avg / 5) * 100));
  const city = SITE_CITY[item.site] ?? "Punjab";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        pressed && { transform: [{ scale: 0.985 }] },
      ]}
    >
      <View style={[s.accent, { backgroundColor: color }]} />

      <View style={s.photoWrap}>
        {src ? (
          <Image source={src} style={s.photo} resizeMode="cover" />
        ) : (
          <View style={[s.photo, s.noPhoto]}>
            <Text style={s.mono}>{initials(item.site)}</Text>
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.name} numberOfLines={2}>
          {item.site}
        </Text>
        <View style={s.cityRow}>
          <Ionicons name="location-sharp" size={12} color={C.orange} />
          <Text style={s.city} numberOfLines={1}>
            {city}
          </Text>
          <Text style={s.dotSep}>•</Text>
          <Text style={s.city}>{item.surveys} surveys</Text>
        </View>
        <View style={s.track}>
          <View
            style={[s.fill, { width: `${pct}%`, backgroundColor: color }]}
          />
        </View>
      </View>

      <View style={[s.score, { backgroundColor: color }]}>
        <Text style={s.scoreText}>{item.avg.toFixed(1)}</Text>
      </View>
    </Pressable>
  );
}

export default function Projects() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    performance?: string;
    site?: string;
  }>();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const initialFilter = (FILTERS as readonly string[]).includes(
    params.performance ?? "",
  )
    ? (params.performance as Filter)
    : "All";

  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState(params.site ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>(getCache() ?? []);
  const [loading, setLoading] = useState(false);

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

  const all: Site[] = useMemo(
    () => computeKpis(items, (i) => getField(i, FIELDS.projectSite)).top,
    [items],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: all.length };
    FILTERS.slice(1).forEach((f) => (c[f] = 0));
    all.forEach((x) => (c[levelOf(x.avg)] += 1));
    return c;
  }, [all]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((x) => {
      const okLevel = filter === "All" || levelOf(x.avg) === filter;
      const okText =
        !q ||
        x.site.toLowerCase().includes(q) ||
        (SITE_CITY[x.site] ?? "").toLowerCase().includes(q);
      return okLevel && okText;
    });
  }, [all, filter, query]);

  const header = (
    <View>
      <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

      <View style={s.panel}>
        <View style={s.titleRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Project Sites</Text>
            <Text style={s.sub}>Ranked by average safety score</Text>
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
            placeholder="Search by project or city"
            placeholderTextColor="#A8A8A8"
            style={s.input}
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery("")} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color="#B5B5B5" />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 4 }}
          style={{ marginTop: 14 }}
        >
          {FILTERS.map((f) => {
            const on = f === filter;
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
                <Text style={[s.chipText, on && s.chipTextOn]}>{f}</Text>
                <Text style={[s.chipCount, on && { color: C.orange }]}>
                  {counts[f]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={s.rankHead}>
        <View style={s.rankBar} />
        <Text style={s.rankTitle}>PERFORMANCE RANKING</Text>
      </View>
    </View>
  );

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <FlatList
        data={list}
        keyExtractor={(i) => i.site}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.orange}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="business-outline" size={34} color="#C5C2BB" />
            <Text style={s.emptyTitle}>
              {loading ? "Loading sites..." : "No sites found"}
            </Text>
            {!loading && (
              <Text style={s.emptySub}>Try another filter or search.</Text>
            )}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <FadeIn index={index}>
              <SiteRow
                item={item}
                onPress={() => {
                  // site detail screen agla step hai
                }}
              />
            </FadeIn>
          </View>
        )}
      />

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

  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: "#F6F4F0",
  },
  chipOn: { backgroundColor: C.dark },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { color: "#4A4A4A", fontSize: 12.5, fontWeight: "700" },
  chipTextOn: { color: "#fff" },
  chipCount: { color: "#A0A0A0", fontSize: 11.5, fontWeight: "800" },

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
  photoWrap: { width: 64, height: 64 },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#E9E6DF",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
  },
  mono: { color: C.orange, fontWeight: "800", fontSize: 18, letterSpacing: 1 },

  name: { color: C.ink, fontSize: 13.5, fontWeight: "700", lineHeight: 17 },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  city: { color: "#8E8E93", fontSize: 11.5, fontWeight: "500", flexShrink: 1 },
  dotSep: { color: "#C8C5BE", fontSize: 8 },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EFEDE8",
    overflow: "hidden",
    marginTop: 8,
  },
  fill: { height: "100%", borderRadius: 2 },

  score: {
    minWidth: 32,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 8,
    alignItems: "center",
  },
  scoreText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 50, gap: 6 },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 6 },
  emptySub: { color: "#8E8E93", fontSize: 12.5 },
});

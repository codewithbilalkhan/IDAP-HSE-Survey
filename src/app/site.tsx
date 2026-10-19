import { AttachmentsGallery } from "@/components/attachments-gallery";
import { getSharePointToken } from "@/hooks/useMicrosoftAuth";
import { fetchSitePhotos, type Photo } from "@/lib/attachments";
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
import Svg, { Circle } from "react-native-svg";

import { AppHeader } from "@/components/app-header";
import { SideDrawer } from "@/components/side-drawer";
import { FIELDS, getField } from "@/constants/fields";
import { SITE_CITY } from "@/constants/site-cities";
import { SITE_IMAGES } from "@/constants/site-images";
import { C, shadow } from "@/constants/theme";
import { getSurveyItems } from "@/hooks/sharepoint";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
import { siteDetail } from "@/lib/hse-kpis";
import { getCache, setCache } from "@/lib/survey-cache";

const LEVEL_COLOR: Record<string, string> = {
  Excellent: "#F8BF32",
  Good: "#7D7D7D",
  Fair: "#FF9900",
  Poor: "#E5484D",
  "Very Poor": "#8E1F24",
};
const colorOf = (score: number) =>
  score >= 4.5
    ? LEVEL_COLOR.Excellent
    : score >= 3.5
      ? LEVEL_COLOR.Good
      : score >= 2.5
        ? LEVEL_COLOR.Fair
        : score >= 1.5
          ? LEVEL_COLOR.Poor
          : LEVEL_COLOR["Very Poor"];

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
const fmtDate = (d: Date | null) =>
  d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "No data";

const TABS = ["Overview", "Categories", "Attachments"] as const;

/* ---------- animations ---------- */
function Rise({ i = 0, children }: { i?: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 80 + i * 90,
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
              outputRange: [30, 0],
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
          borderRadius: 3,
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

/* ---------- gauge ---------- */
const G = 196;
const GS = 14;
const GR = (G - GS) / 2;
const GC = 2 * Math.PI * GR;

function Gauge({ avg, color }: { avg: number; color: string }) {
  const prog = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = prog.addListener(({ value }) => setP(value));
    Animated.timing(prog, {
      toValue: 1,
      duration: 1600,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => prog.removeListener(id);
  }, [prog]);

  const len = GC * Math.min(1, avg / 5) * p;

  return (
    <View
      style={{
        width: G,
        height: G,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={G} height={G}>
        <Circle
          cx={G / 2}
          cy={G / 2}
          r={GR}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={GS}
          fill="none"
        />
        <Circle
          cx={G / 2}
          cy={G / 2}
          r={GR - 18}
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={1}
          fill="none"
          strokeDasharray={[3, 6]}
        />
        {len > 0 && (
          <Circle
            cx={G / 2}
            cy={G / 2}
            r={GR}
            stroke={color}
            strokeWidth={GS}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[len, GC]}
            rotation={-90}
            originX={G / 2}
            originY={G / 2}
          />
        )}
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.gaugeCenter}>
          <Text style={s.gaugeLabel}>HSE SCORE</Text>
          <Text style={[s.gaugeNum, { color }]}>{(avg * p).toFixed(1)}</Text>
          <Text style={s.gaugeOf}>out of 5</Text>
        </View>
      </View>
    </View>
  );
}

function ScoreBar({ avg, color }: { avg: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: Math.min(100, (avg / 5) * 100),
      duration: 1600,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [avg, v]);

  const width = v.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={s.sbWrap}>
      <View style={s.sbTrack}>
        <Animated.View style={[s.sbFill, { width, backgroundColor: color }]} />
        <Animated.View style={[s.sbDotWrap, { left: width }]}>
          <View style={[s.sbDot, { backgroundColor: color }]} />
        </Animated.View>
      </View>
      <View style={s.sbTicks}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <Text key={n} style={s.scaleText}>
            {n}
          </Text>
        ))}
      </View>
    </View>
  );
}
/* ---------- rows ---------- */
type Cat = { name: string; icon: string; score: number };

function CatRow({ c, i, na }: { c: Cat; i: number; na?: boolean }) {
  const col = na ? "#B8B5AE" : colorOf(c.score);
  return (
    <Rise i={i}>
      <View style={s.catRow}>
        <View style={[s.catIcon, { backgroundColor: col + "22" }]}>
          <Ionicons name={c.icon as any} size={17} color={col} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.catName} numberOfLines={1}>
            {c.name}
          </Text>
          {!na && (
            <Bar pct={(c.score / 5) * 100} color={col} delay={200 + i * 80} />
          )}
        </View>
        <View style={[s.pill, { backgroundColor: col }]}>
          <Text style={s.pillText}>{na ? "N/A" : c.score.toFixed(1)}</Text>
        </View>
      </View>
    </Rise>
  );
}

function Section({
  title,
  color,
  count,
  children,
}: {
  title: string;
  color: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <View style={s.section}>
      <View style={s.secHead}>
        <View style={[s.secBar, { backgroundColor: color }]} />
        <Text style={s.secTitle}>{title}</Text>
        <Text style={s.secCount}>{count}</Text>
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

/* ---------- screen ---------- */
export default function SiteDetail() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { site = "" } = useLocalSearchParams<{ site?: string }>();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>(getCache() ?? []);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [tabW, setTabW] = useState(0);
  const slide = useRef(new Animated.Value(0)).current;

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [spToken, setSpToken] = useState("");
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photosFor, setPhotosFor] = useState("");

  useEffect(() => {
    if (tab !== "Attachments" || photosFor === site || items.length === 0)
      return;
    let alive = true;
    (async () => {
      setPhotoLoading(true);
      setPhotoError("");
      try {
        const tk = await getSharePointToken();
        const list = await fetchSitePhotos(tk, items, site);
        if (!alive) return;
        setSpToken(tk);
        setPhotos(list);
        setPhotosFor(site);
      } catch (e: any) {
        if (alive) setPhotoError(e.message ?? "Something went wrong");
      } finally {
        if (alive) setPhotoLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, site, items, photosFor]);

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
    Animated.spring(slide, {
      toValue: TABS.indexOf(tab),
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  }, [tab, slide]);

  const d = useMemo(
    () => siteDetail(items, (i) => getField(i, FIELDS.projectSite), site),
    [items, site],
  );

  const color = colorOf(d.avg);
  const city = SITE_CITY[site] ?? "Punjab";
  const src = SITE_IMAGES[site];

  const top = d.categories
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const weak = d.categories
    .filter((c) => c.score > 0 && c.score < 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const na = d.categories.filter((c) => c.score === 0);
  const all = [...d.categories]
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return (
    <View style={s.screen}>
      <StatusBar style="light" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 50 }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

        <View style={s.body}>
          {/* banner */}
          <Rise i={0}>
            <View style={s.banner}>
              {src ? (
                <Image
                  source={src}
                  style={{
                    width: "100%",
                    height: "100%",
                  }}
                  resizeMode="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, s.noPhoto]} />
              )}
              <View style={s.shade} />

              <Pressable
                onPress={() => router.back()}
                hitSlop={10}
                style={s.back}
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </Pressable>

              <View style={[s.levelChip, { backgroundColor: color }]}>
                <Text style={s.levelText}>{d.level.toUpperCase()}</Text>
              </View>

              <View style={s.bannerBottom}>
                <Text style={s.siteName} numberOfLines={3}>
                  {site}
                </Text>
                <View style={s.cityRow}>
                  <Ionicons name="location-sharp" size={13} color={C.orange} />
                  <Text style={s.cityText}>{city}</Text>
                </View>
              </View>
            </View>
          </Rise>

          {/* stat tiles */}
          <Rise i={1}>
            <View style={s.tiles}>
              {/* Surveys */}
              <View style={s.tile}>
                <View style={s.tileIcon}>
                  <Ionicons
                    name="clipboard-outline"
                    size={17}
                    color="#EC991B"
                  />
                </View>

                <View style={s.tileValueSlot}>
                  <CountUp value={d.surveys} style={s.tileNum} />
                </View>

                <Text style={s.tileLabel} numberOfLines={1}>
                  Surveys
                </Text>
              </View>

              {/* Status */}
              <View style={s.tile}>
                <View style={s.tileIcon}>
                  <Ionicons name="pulse-outline" size={17} color="#EC991B" />
                </View>

                <View style={s.tileValueSlot}>
                  <Text
                    style={[s.tileNum, { color, fontSize: 17 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {d.level}
                  </Text>
                </View>

                <Text style={s.tileLabel} numberOfLines={1}>
                  Status
                </Text>
              </View>

              {/* Last Survey */}
              <View style={s.tile}>
                <View style={s.tileIcon}>
                  <Ionicons name="calendar-outline" size={17} color="#EC991B" />
                </View>

                <View style={s.tileValueSlot}>
                  <Text
                    style={[s.tileNum, { fontSize: 12.5 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {fmtDate(d.last)}
                  </Text>
                </View>

                <Text style={s.tileLabel} numberOfLines={1}>
                  Last survey
                </Text>
              </View>
            </View>
          </Rise>

          {/* tabs */}
          <Rise i={2}>
            <View
              style={s.tabs}
              onLayout={(e) =>
                setTabW((e.nativeEvent.layout.width - 8) / TABS.length)
              }
            >
              {tabW > 0 && (
                <Animated.View
                  style={[
                    s.tabPill,
                    {
                      width: tabW,
                      transform: [
                        {
                          translateX: slide.interpolate({
                            inputRange: [0, TABS.length - 1],
                            outputRange: [0, tabW * (TABS.length - 1)],
                          }),
                        },
                      ],
                    },
                  ]}
                />
              )}
              {TABS.map((t) => (
                <Pressable key={t} onPress={() => setTab(t)} style={s.tabBtn}>
                  <Text style={[s.tabText, tab === t && s.tabTextOn]}>{t}</Text>
                </Pressable>
              ))}
            </View>
          </Rise>

          {/* content */}
          {tab === "Overview" ? (
            <View key="ov">
              <Rise i={0}>
                <View style={s.hero}>
                  <View
                    style={[
                      s.ring,
                      {
                        width: 280,
                        height: 280,
                        borderRadius: 140,
                        top: -120,
                        right: -110,
                      },
                    ]}
                  />
                  <View
                    style={[
                      s.ring,
                      {
                        width: 180,
                        height: 180,
                        borderRadius: 90,
                        top: -70,
                        right: -60,
                      },
                    ]}
                  />
                  <View style={[s.glow, { backgroundColor: color }]} />

                  <Text style={s.heroTitle}>OVERALL HSE SCORE</Text>
                  <Gauge avg={d.avg} color={color} />
                  <View
                    style={[
                      s.heroLevel,
                      {
                        borderColor: color + "88",
                        backgroundColor: color + "22",
                      },
                    ]}
                  >
                    <View style={[s.heroDot, { backgroundColor: color }]} />
                    <Text style={[s.heroLevelText, { color }]}>{d.level}</Text>
                  </View>

                  <ScoreBar avg={d.avg} color={color} />
                </View>
              </Rise>

              <Section
                title="Top Rated Categories"
                color={C.orange}
                count={top.length}
              >
                {top.map((c, i) => (
                  <CatRow key={c.name} c={c} i={i} />
                ))}
              </Section>

              <Section
                title="Low Rated Categories"
                color="#E5484D"
                count={weak.length}
              >
                {weak.map((c, i) => (
                  <CatRow key={c.name} c={c} i={i} />
                ))}
              </Section>

              <Section title="Not Applicable" color="#B8B5AE" count={na.length}>
                {na.map((c, i) => (
                  <CatRow key={c.name} c={c} i={i} na />
                ))}
              </Section>
            </View>
          ) : tab === "Categories" ? (
            <View key="cat">
              <Section
                title="All Categories"
                color={C.orange}
                count={all.length}
              >
                {all.map((c, i) => (
                  <CatRow key={c.name} c={c} i={Math.min(i, 10)} />
                ))}
              </Section>
            </View>
          ) : (
            <View key="att">
              <AttachmentsGallery
                photos={photos}
                loading={photoLoading}
                error={photoError}
                token={spToken}
                site={site}
              />
            </View>
          )}
        </View>
      </ScrollView>

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

  banner: {
    width: "100%",
    height: 210,
    borderRadius: 30,
    overflow: "hidden",
    backgroundColor: "#141416",
    ...shadow,
  },
  noPhoto: { backgroundColor: "#141416" },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  back: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(10,10,10,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  levelChip: {
    position: "absolute",
    top: 18,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  levelText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
  },
  bannerBottom: { position: "absolute", left: 18, right: 18, bottom: 18 },
  siteName: {
    color: "#fff",
    fontSize: 21,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  cityRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  cityText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12.5,
    fontWeight: "600",
  },

  tiles: { flexDirection: "row", gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...shadow,
  },
  tileIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },

  tileValueSlot: {
    height: 30,
    marginTop: 8,
    justifyContent: "flex-end",
    alignItems: "flex-start",
    width: "100%",
  },

  tileNum: {
    color: C.ink,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
    lineHeight: 28,
    includeFontPadding: false,
  },

  tileLabel: {
    color: C.gray,
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 3,
    lineHeight: 16,
    includeFontPadding: false,
  },

  tabs: {
    flexDirection: "row",
    backgroundColor: "#EAE7E1",
    borderRadius: 18,
    padding: 4,
  },
  tabPill: {
    position: "absolute",
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: 14,
    backgroundColor: C.dark,
  },
  tabBtn: { flex: 1, paddingVertical: 11, alignItems: "center" },
  tabText: { color: "#6E6E73", fontSize: 13.5, fontWeight: "700" },
  tabTextOn: { color: C.orange },

  hero: {
    backgroundColor: C.dark,
    borderRadius: 30,
    paddingVertical: 24,
    paddingHorizontal: 22,
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
    opacity: 0.1,
    bottom: -140,
    left: -70,
  },
  heroTitle: {
    color: "#8E8E93",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 14,
  },
  gaugeCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  gaugeLabel: {
    color: "#6E6E73",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2.5,
  },
  gaugeNum: {
    fontSize: 58,
    fontWeight: "800",
    letterSpacing: -2,
    lineHeight: 64,
  },

  sbWrap: { width: "100%", marginTop: 18 },
  sbTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
  },
  sbFill: { height: "100%", borderRadius: 4 },
  sbDotWrap: {
    position: "absolute",
    top: -3,
    width: 0,
    alignItems: "center",
  },
  sbDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: "#111",
  },
  sbTicks: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  gaugeOf: { color: "#6E6E73", fontSize: 11, fontWeight: "600" },
  heroLevel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroDot: { width: 7, height: 7, borderRadius: 4 },
  heroLevelText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  scale: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
  },
  scaleText: { color: "#555", fontSize: 11, fontWeight: "700" },

  section: { marginTop: 8 },
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  secBar: { width: 4, height: 16, borderRadius: 2, marginRight: 10 },
  secTitle: {
    flex: 1,
    color: C.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  secCount: { color: "#A0A0A0", fontSize: 12, fontWeight: "800" },

  catRow: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow,
  },
  catIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { color: C.ink, fontSize: 13.5, fontWeight: "700", marginBottom: 7 },
  barTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: "#EFEDE8",
    overflow: "hidden",
  },
  pill: {
    minWidth: 34,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 9,
    alignItems: "center",
  },
  pillText: { color: "#fff", fontSize: 11.5, fontWeight: "800" },
});

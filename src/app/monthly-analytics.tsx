import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

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
import { computeKpis, siteDetail } from "@/lib/hse-kpis";
import { getCache, setCache } from "@/lib/survey-cache";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/* ---------------- constants & helpers ---------------- */
const GOLD = "#EC991B";
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
const MONTHS_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const LEVELS = ["Excellent", "Good", "Fair", "Poor", "Very Poor"] as const;
const LEVEL_COLOR: Record<string, string> = {
  Excellent: "#F8BF32",
  Good: "#7D7D7D",
  Fair: "#FF9900",
  Poor: "#E5484D",
  "Very Poor": "#8E1F24",
};
const levelOf = (n: number) =>
  n >= 4.5
    ? "Excellent"
    : n >= 3.5
      ? "Good"
      : n >= 2.5
        ? "Fair"
        : n >= 1.5
          ? "Poor"
          : "Very Poor";
const colorOf = (n: number) => LEVEL_COLOR[levelOf(n)];

type Site = { site: string; avg: number; surveys: number };
type Cat = { name: string; icon: string; score: number };

const siteOf = (i: any) => getField(i, FIELDS.projectSite);

const SHORT_NAMES: Record<string, string> = {
  "200 Beds Accident & Emergency Center at PIMS, Islamabad": "PIMS",
  "Civil Secreteriat Multan": "Civil Multan",
  "GOR Multan": "GOR Multan",
  "GOR-1 Lahore": "GOR-1 Lhr",
  "HHH SC Sheikh Zaid II RYK": "SZ-II RYK",
  LKPC: "LKPC",
  "MCCH Bahawalnagar": "MCCH BWN",
  "MCCH Layyah": "MCCH Layyah",
  "MCH Attock": "MCH Attock",
  "MCH Mianwali": "MCH MWD",
  "Nishtar II, Multan": "Nishtar-II",
  PAFDA: "PAFDA",
  "Pilot Program for HUB & Spoke Model at Zahir Pir": "H&S ZP",
  "PKLI C": "PKLI-C",
  "SFMKB, DG Khan": "SFMKB DGK",
  "UAEET Sambrial": "UAEET",
  "Establishment of University of Child Health Science Lahore": "UCHSL",
  "DHQ/THQ Package 5": "DHQ/THQ-5",
  "Establishment of Emergency and Trauma Centre at Jinnah hospital Lahore":
    "E&T Jinnah",
  "Staff accommodation & student hostel at MCH Mianwali": "MCH Hostel",
  "Reconstruction of P&D Building Lahore": "P&D Recon",
  "Establishment of FGPC (PGMI)-II G-11/3 Islamabad": "FGPC",
  "Circuit House Rawalpindi": "CH RWP",
  "Green Building, Lahore": "Green Lhr",
  "New GOR Near DHA Phase 09, Lahore": "New GOR",
  "Establishment of Climate Observatory in Punjab": "Climate Obser",
  "NSIC Sargodha": "NSIC SGD",
  "Lady Willingdon Hospital": "LWH",
  "NSIC-R Sargodha": "NSIC-R",
  "NSICTR-LHR-A": "NSIC-A",
  "NSICTR-LHR-B": "NSIC-B",
  "NSICTR-LHR-C": "NSIC-C",
  "NSICTR-LHR-D": "NSIC-D",
  "Net Zero Energy Building": "NZEB",
  "Cinema at Safari Zoo": "Safari Zoo",
  "Punjab Revenue Authority's Building, Lahore": "PRA Lhr",
  "Auditorium at UCHS LHR": "UCHS Aud",
  "Tower A Old P&D": "Tower-A P&D",
  "IDAP Office Building": "IDAP",
};
const shortOf = (n: string) =>
  SHORT_NAMES[n] ?? (n.length > 12 ? n.slice(0, 11) + "…" : n);

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

const initials = (name: string) => {
  const w = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "S";
};

const smooth = () =>
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

/* ---------------- animations ---------------- */
function Rise({ i = 0, children }: { i?: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 60 + i * 80,
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
              outputRange: [28, 0],
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
      duration: 900,
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
  track = "#EFEDE8",
}: {
  pct: number;
  color: string;
  delay?: number;
  track?: string;
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
    <View style={[s.barTrack, { backgroundColor: track }]}>
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

/* ---------------- score ring ---------------- */
function Ring({
  value,
  size,
  stroke,
  color,
  track,
  animated,
  children,
}: {
  value: number;
  size: number;
  stroke: number;
  color: string;
  track: string;
  animated?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const [p, setP] = useState(animated ? 0 : 1);

  useEffect(() => {
    if (!animated) return;
    const id = prog.addListener(({ value: v }) => setP(v));
    Animated.timing(prog, {
      toValue: 1,
      duration: 1400,
      delay: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => prog.removeListener(id);
  }, [animated, prog]);

  const len = circ * Math.min(1, value / 5) * p;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        {len > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={[len, circ]}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.center]} pointerEvents="none">
        {children}
      </View>
    </View>
  );
}

/* ---------------- year picker ---------------- */
function YearPicker({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: number;
  onChange: (y: number) => void;
}) {
  const ref = useRef<ScrollView>(null);
  const xs = useRef<Record<number, number>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      ref.current?.scrollTo({
        x: Math.max(0, (xs.current[value] ?? 0) - 24),
        animated: true,
      });
    }, 120);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingRight: 8 }}
    >
      {years.map((y) => {
        const on = y === value;
        return (
          <Pressable
            key={y}
            onPress={() => onChange(y)}
            onLayout={(e) => {
              xs.current[y] = e.nativeEvent.layout.x;
            }}
            style={({ pressed }) => [
              s.yearItem,
              on && s.yearItemOn,
              pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={[s.yearText, on && s.yearTextOn]}>{y}</Text>
            {on && <View style={s.yearDot} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ---------------- month grid (sliding glow) ---------------- */
const GAP = 8;
const TILE_H = 54;
function MonthGrid({
  month,
  counts,
  maxMonth,
  onChange,
}: {
  month: number;
  counts: number[];
  maxMonth: number;
  onChange: (m: number) => void;
}) {
  const [w, setW] = useState(0);
  const tileW = w > 0 ? Math.floor((w - GAP * 3) / 4) : 0;
  const hx = useRef(new Animated.Value(0)).current;
  const hy = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);

  const posOf = (i: number) => ({
    x: (i % 4) * (tileW + GAP),
    y: Math.floor(i / 4) * (TILE_H + GAP),
  });

  useEffect(() => {
    if (!tileW) return;
    const { x, y } = posOf(month - 1);
    if (!placed.current) {
      hx.setValue(x);
      hy.setValue(y);
      placed.current = true;
      return;
    }
    Animated.parallel([
      Animated.spring(hx, {
        toValue: x,
        useNativeDriver: true,
        friction: 8,
        tension: 110,
      }),
      Animated.spring(hy, {
        toValue: y,
        useNativeDriver: true,
        friction: 8,
        tension: 110,
      }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, tileW, hx, hy]);

  const cell = { width: tileW, height: TILE_H };

  return (
    <View
      style={{ height: TILE_H * 3 + GAP * 2 }}
      onLayout={(e) => setW(Math.floor(e.nativeEvent.layout.width))}
    >
      {tileW > 0 && (
        <>
          {/* layer 1: glass tiles */}
          {MONTHS.map((m, i) => {
            const { x, y } = posOf(i);
            return (
              <View
                key={m}
                style={[
                  s.glassTile,
                  cell,
                  { position: "absolute", left: x, top: y },
                ]}
              />
            );
          })}

          {/* layer 2: sliding highlight */}
          <Animated.View
            pointerEvents="none"
            style={[
              s.highlight,
              cell,
              { transform: [{ translateX: hx }, { translateY: hy }] },
            ]}
          />

          {/* layer 3: labels + touch */}
          {MONTHS.map((m, i) => {
            const idx = i + 1;
            const on = idx === month;
            const off = idx > maxMonth;
            const n = counts[i] ?? 0;
            const { x, y } = posOf(i);
            return (
              <Pressable
                key={m}
                disabled={off}
                onPress={() => onChange(idx)}
                style={[
                  cell,
                  s.center,
                  { position: "absolute", left: x, top: y },
                  off && { opacity: 0.28 },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[s.monthText, on && s.monthTextOn]}
                >
                  {m}
                </Text>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[s.monthCount, on && s.monthCountOn]}
                >
                  {n > 0 ? `${n} ${n === 1 ? "survey" : "surveys"}` : "—"}
                </Text>
              </Pressable>
            );
          })}
        </>
      )}
    </View>
  );
}

/* ---------------- small pieces ---------------- */
function SecHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={s.secHead}>
      <View style={s.secBar} />
      <Text style={s.secTitle}>{title}</Text>
      {right}
    </View>
  );
}

function CatLine({ c, i, dark }: { c: Cat; i: number; dark?: boolean }) {
  const col = colorOf(c.score);
  return (
    <View style={s.catRow}>
      <View style={[s.catIcon, { backgroundColor: col + "22" }]}>
        <Ionicons name={c.icon as any} size={15} color={col} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.catName, dark && { color: "#fff" }]} numberOfLines={1}>
          {c.name}
        </Text>
        <Bar
          pct={(c.score / 5) * 100}
          color={col}
          delay={80 + i * 50}
          track={dark ? "rgba(255,255,255,0.09)" : undefined}
        />
      </View>
      <Text style={[s.catScore, { color: col }]}>{c.score.toFixed(1)}</Text>
    </View>
  );
}

/* ---------------- animated site chart ---------------- */
const CH = 200; // plot height
const LH = 66; // x-label area height
const YW = 24; // y-axis label column
const TOPPAD = 20; // room for value labels above tallest bar

function Pop({ children }: { children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 120,
    }).start();
  }, [v]);
  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 1],
            }),
          },
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function ChartBar({
  x,
  idx,
  colW,
  bw,
  on,
  onPress,
}: {
  x: Site;
  idx: number;
  colW: number;
  bw: number;
  on: boolean;
  onPress: () => void;
}) {
  const color = colorOf(x.avg);
  const h = Math.max(6, (x.avg / 5) * CH);
  const g = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(g, {
      toValue: 1,
      duration: 850,
      delay: 180 + Math.min(idx, 24) * 45,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [g, idx]);

  const gid = `bar${idx}`;

  return (
    <Pressable onPress={onPress} style={{ width: colW }}>
      <View style={[s.col, { height: CH + TOPPAD }, on && s.colOn]}>
        <Animated.Text
          style={[
            s.barVal,
            { opacity: g, color: on ? "#fff" : "rgba(255,255,255,0.75)" },
          ]}
        >
          {x.avg.toFixed(1)}
        </Animated.Text>
        <Animated.View
          style={{
            width: bw,
            height: g.interpolate({ inputRange: [0, 1], outputRange: [0, h] }),
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            overflow: "hidden",
            opacity: on ? 1 : 0.72,
          }}
        >
          <Svg
            width={bw}
            height={h}
            style={{ position: "absolute", bottom: 0 }}
          >
            <Defs>
              <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="1" />
                <Stop offset="1" stopColor={color} stopOpacity="0.4" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={bw} height={h} fill={`url(#${gid})`} />
          </Svg>
          <View style={s.sheen} />
          <View style={s.cap} />
        </Animated.View>
      </View>

      <View style={{ height: LH, width: colW }}>
        <Text
          numberOfLines={1}
          style={[
            s.xLab,
            {
              width: LH - 6,
              left: (colW - (LH - 6)) / 2,
              top: (LH - 14) / 2,
              color: on ? "#fff" : "#8E8E93",
            },
          ]}
        >
          {shortOf(x.site)}
        </Text>
      </View>
    </Pressable>
  );
}

function SiteChart({ sites, overall }: { sites: Site[]; overall: number }) {
  const [sel, setSel] = useState(0);
  const [w, setW] = useState(0);
  const n = sites.length;
  const colW = w > 0 ? Math.max(46, w / n) : 46;
  const bw = Math.min(40, colW - 14);
  const content = Math.max(w, colW * n);
  const cur = sites[Math.min(sel, n - 1)];
  const curColor = colorOf(cur.avg);
  const curImg = SITE_IMAGES[cur.site];
  const scrolls = w > 0 && content > w + 4;

  return (
    <View>
      {/* selected site info */}
      <Pop key={cur.site}>
        <View style={s.infoCard}>
          <View style={[s.infoAccent, { backgroundColor: curColor }]} />
          {curImg ? (
            <Image source={curImg} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={[s.thumb, s.center]}>
              <Text style={s.mono}>{initials(cur.site)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.infoName} numberOfLines={2}>
              {cur.site}
            </Text>
            <Text style={s.infoSub}>
              {cur.surveys} {cur.surveys === 1 ? "Survey" : "Surveys"} ·{" "}
              {levelOf(cur.avg)}
            </Text>
          </View>
          <Text style={[s.infoScore, { color: curColor }]}>
            {cur.avg.toFixed(1)}
          </Text>
        </View>
      </Pop>

      {/* chart */}
      <View style={{ flexDirection: "row", marginTop: 18 }}>
        <View style={{ width: YW, height: CH + TOPPAD }}>
          {[1, 2, 3, 4, 5].map((v) => (
            <Text
              key={v}
              style={[
                s.yLab,
                { position: "absolute", right: 6, bottom: (v / 5) * CH - 7 },
              ]}
            >
              {v}
            </Text>
          ))}
        </View>

        <View
          style={{ flex: 1 }}
          onLayout={(e) => setW(e.nativeEvent.layout.width)}
        >
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: content }}>
              {/* grid + average line */}
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { height: CH + TOPPAD }]}
              >
                {[0, 1, 2, 3, 4, 5].map((v) => (
                  <View
                    key={v}
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: (v / 5) * CH,
                      height: 1,
                      backgroundColor:
                        v === 0
                          ? "rgba(255,255,255,0.22)"
                          : "rgba(255,255,255,0.07)",
                    }}
                  />
                ))}
                <Svg
                  width={content}
                  height={2}
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: (overall / 5) * CH - 1,
                  }}
                >
                  <Line
                    x1={0}
                    y1={1}
                    x2={content}
                    y2={1}
                    stroke={GOLD}
                    strokeWidth={1.5}
                    strokeDasharray="6 5"
                  />
                </Svg>
              </View>

              {/* bars */}
              <View style={{ flexDirection: "row" }}>
                {sites.map((x, i) => (
                  <ChartBar
                    key={x.site}
                    x={x}
                    idx={i}
                    colW={colW}
                    bw={bw}
                    on={i === sel}
                    onPress={() => setSel(i)}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      <View style={s.avgRow}>
        <Text style={{ color: GOLD, fontWeight: "800", letterSpacing: 1 }}>
          - -
        </Text>
        <Text style={s.legendTxt}>Average {overall.toFixed(1)}</Text>
        {scrolls && <Text style={s.hint}>swipe for more ›</Text>}
      </View>
    </View>
  );
}

function AnalyticsCard({
  sites,
  overall,
  cats,
  period,
}: {
  sites: Site[];
  overall: number;
  cats: Cat[];
  period: string;
}) {
  const [tab, setTab] = useState<"sites" | "cats">("sites");
  const present = LEVELS.filter((l) => sites.some((x) => levelOf(x.avg) === l));

  return (
    <View style={s.anaCard}>
      <View
        style={[
          s.deco,
          {
            width: 220,
            height: 220,
            borderRadius: 110,
            top: -100,
            right: -80,
          },
        ]}
      />

      <View style={s.anaHead}>
        <View style={s.anaHeadIcon}>
          <Ionicons name="stats-chart" size={18} color={GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.anaHeadTitle}>HSE Monthly Site Analytics</Text>
          <Text style={s.anaHeadSub}>{period}</Text>
        </View>
      </View>

      <View style={s.seg}>
        {(
          [
            ["sites", "Sites"],
            ["cats", "Categories"],
          ] as const
        ).map(([k, label]) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[s.segBtn, tab === k && s.segOn]}
          >
            <Text style={[s.segTxt, tab === k && s.segTxtOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "sites" && (
        <View style={s.legend}>
          {present.map((l) => (
            <View key={l} style={s.legendItem}>
              <View style={[s.levelDot, { backgroundColor: LEVEL_COLOR[l] }]} />
              <Text style={s.legendTxt}>{l}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ marginTop: tab === "sites" ? 4 : 18 }}>
        {tab === "sites" ? (
          <SiteChart sites={sites} overall={overall} />
        ) : (
          <View style={{ gap: 14 }}>
            {cats.map((c, i) => (
              <CatLine key={c.name} c={c} i={Math.min(i, 12)} dark />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

/* ---------------- site card ---------------- */
function SiteCard({
  item,
  rank,
  items,
  expanded,
  onToggle,
  onOpen,
}: {
  item: Site;
  rank: number;
  items: any[];
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const src = SITE_IMAGES[item.site];
  const color = colorOf(item.avg);
  const level = levelOf(item.avg);
  const city = SITE_CITY[item.site] ?? "Punjab";

  const detail = useMemo(
    () => (expanded ? siteDetail(items, siteOf, item.site) : null),
    [expanded, items, item.site],
  );
  const cats: Cat[] = detail
    ? (detail.categories as Cat[])
        .filter((c) => c.score > 0)
        .sort((a, b) => b.score - a.score)
    : [];
  const naCount = detail
    ? (detail.categories as Cat[]).filter((c) => c.score === 0).length
    : 0;

  return (
    <View style={s.card}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          s.cardTop,
          pressed && { transform: [{ scale: 0.99 }] },
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
          <View style={[s.rank, rank <= 3 && s.rankTop]}>
            <Text style={[s.rankText, rank <= 3 && { color: C.dark }]}>
              #{rank}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.siteName} numberOfLines={2}>
            {item.site}
          </Text>
          <View style={s.metaRow}>
            <Ionicons name="location-sharp" size={12} color={C.orange} />
            <Text style={s.meta} numberOfLines={1}>
              {city}
            </Text>
            <Text style={s.sep}>•</Text>
            <Text style={s.meta}>
              {item.surveys} {item.surveys === 1 ? "Survey" : "Surveys"}
            </Text>
          </View>
          <View style={s.levelRow}>
            <View style={[s.levelDot, { backgroundColor: color }]} />
            <Text style={[s.levelTxt, { color }]}>{level}</Text>
          </View>
        </View>

        <Ring
          value={item.avg}
          size={52}
          stroke={5}
          color={color}
          track="#EFEDE8"
        >
          <Text style={s.ringNum}>{item.avg.toFixed(1)}</Text>
        </Ring>

        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color="#B8B5AE"
        />
      </Pressable>

      {expanded && (
        <View style={s.expand}>
          <View style={s.expandLine} />
          {cats.length === 0 ? (
            <Text style={s.meta}>No category scores for this month.</Text>
          ) : (
            <View style={{ gap: 12 }}>
              {cats.map((c, i) => (
                <CatLine key={c.name} c={c} i={Math.min(i, 10)} />
              ))}
            </View>
          )}
          {naCount > 0 && (
            <Text style={[s.meta, { marginTop: 12 }]}>
              {naCount} {naCount === 1 ? "category" : "categories"} not
              applicable
            </Text>
          )}
          <Pressable
            onPress={onOpen}
            style={({ pressed }) => [s.openBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={s.openTxt}>OPEN SITE DETAILS</Text>
            <Ionicons name="arrow-forward" size={14} color={C.orange} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

/* ---------------- screen ---------------- */
export default function MonthlyAnalytics() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const today = useMemo(() => new Date(), []);
  const nowY = today.getFullYear();
  const nowM = today.getMonth() + 1;

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>(getCache() ?? []);
  const [loading, setLoading] = useState(false);
  const [year, setYear] = useState(nowY);
  const [month, setMonth] = useState(nowM);
  const [open, setOpen] = useState("");
  const [showCats, setShowCats] = useState(false);
  const listRef = useRef<ScrollView>(null);
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

  /* ---- data ---- */
  const dated = useMemo(
    () =>
      items
        .map((it) => ({ it, d: dateOf(it) }))
        .filter((x): x is { it: any; d: Date } => !!x.d),
    [items],
  );

  const years = useMemo(() => {
    const min = dated.reduce((m, x) => Math.min(m, x.d.getFullYear()), nowY);
    const out: number[] = [];
    for (let y = min; y <= nowY; y++) out.push(y);
    return out;
  }, [dated, nowY]);

  const monthCounts = useMemo(() => {
    const c = new Array(12).fill(0);
    dated.forEach((x) => {
      if (x.d.getFullYear() === year) c[x.d.getMonth()] += 1;
    });
    return c as number[];
  }, [dated, year]);

  const filtered = useMemo(
    () =>
      dated
        .filter(
          (x) => x.d.getFullYear() === year && x.d.getMonth() + 1 === month,
        )
        .map((x) => x.it),
    [dated, year, month],
  );

  const sites: Site[] = useMemo(
    () =>
      filtered.length
        ? [...(computeKpis(filtered, siteOf).top as Site[])].sort(
            (a, b) => b.avg - a.avg,
          )
        : [],
    [filtered],
  );

  const surveysDone = sites.reduce((a, x) => a + x.surveys, 0);
  const respondents = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach((it) => {
      const r = respondentOf(it).toLowerCase();
      if (r) set.add(r);
    });
    return set.size;
  }, [filtered]);

  const overall = sites.length
    ? sites.reduce((a, x) => a + x.avg, 0) / sites.length
    : 0;
  const overallColor = colorOf(overall);

  const dist = LEVELS.map((l) => ({
    l,
    n: sites.filter((x) => levelOf(x.avg) === l).length,
  }));

  const catAvg: Cat[] = useMemo(() => {
    if (!showCats || !sites.length) return [];
    const acc = new Map<string, { icon: string; sum: number; n: number }>();
    sites.forEach((st) => {
      (siteDetail(filtered, siteOf, st.site).categories as Cat[]).forEach(
        (c) => {
          if (c.score > 0) {
            const a = acc.get(c.name) ?? { icon: c.icon, sum: 0, n: 0 };
            a.sum += c.score;
            a.n += 1;
            acc.set(c.name, a);
          }
        },
      );
    });
    return [...acc.entries()]
      .map(([name, a]) => ({ name, icon: a.icon, score: a.sum / a.n }))
      .sort((a, b) => b.score - a.score);
  }, [showCats, sites, filtered]);

  /* ---- handlers ---- */
  const pickYear = (y: number) => {
    setYear(y);
    setMonth((m) => (y === nowY && m > nowM ? nowM : m));
    setOpen("");
  };
  const pickMonth = (m: number) => {
    setMonth(m);
    setOpen("");
  };

  const maxMonth = year === nowY ? nowM : 12;
  const periodKey = `${year}-${month}`;
  const period = `${MONTHS_FULL[month - 1]} ${year}`;

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
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.orange}
          />
        }
        contentContainerStyle={{ paddingBottom: navSpace(insets.bottom) + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

        <View style={s.body}>
          {/* ===== PERIOD CONTROL ===== */}
          <Rise i={0}>
            <View style={s.panel}>
              <View
                style={[
                  s.deco,
                  {
                    width: 260,
                    height: 260,
                    borderRadius: 130,
                    top: -110,
                    right: -100,
                  },
                ]}
              />
              <View
                style={[
                  s.deco,
                  {
                    width: 150,
                    height: 150,
                    borderRadius: 75,
                    top: -55,
                    right: -45,
                  },
                ]}
              />
              <View style={s.panelGlow} />

              <View style={s.panelTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.eyebrow}>SELECT PERIOD</Text>
                  <Text style={s.panelTitle}>Monthly Analytics</Text>
                </View>
                <View style={s.panelBadge}>
                  <Ionicons name="calendar" size={20} color={GOLD} />
                </View>
              </View>

              <Text style={[s.eyebrow, { marginTop: 20, marginBottom: 10 }]}>
                YEAR
              </Text>
              <YearPicker years={years} value={year} onChange={pickYear} />

              <Text style={[s.eyebrow, { marginTop: 20, marginBottom: 10 }]}>
                MONTH
              </Text>
              <MonthGrid
                month={month}
                counts={monthCounts}
                maxMonth={maxMonth}
                onChange={pickMonth}
              />

              <View style={s.selPill}>
                <View style={s.selDot} />
                <Text style={s.selText}>{period}</Text>
              </View>
            </View>
          </Rise>

          {/* ===== RESULTS (remount per period => fresh animations) ===== */}
          <View key={periodKey} style={{ gap: 14 }}>
            <Rise i={0}>
              <View style={s.tiles}>
                <View style={s.tile}>
                  <View style={s.tileIcon}>
                    <Ionicons name="business-outline" size={17} color={GOLD} />
                  </View>
                  <View style={s.tileValueSlot}>
                    <CountUp value={sites.length} style={s.tileNum} />
                  </View>
                  <Text style={s.tileLabel} numberOfLines={1}>
                    Total Sites
                  </Text>
                </View>
                <View style={s.tile}>
                  <View style={s.tileIcon}>
                    <Ionicons name="clipboard-outline" size={17} color={GOLD} />
                  </View>
                  <View style={s.tileValueSlot}>
                    <CountUp value={surveysDone} style={s.tileNum} />
                  </View>
                  <Text style={s.tileLabel} numberOfLines={1}>
                    Surveys Done
                  </Text>
                </View>
                <View style={s.tile}>
                  <View style={s.tileIcon}>
                    <Ionicons name="people-outline" size={17} color={GOLD} />
                  </View>
                  <View style={s.tileValueSlot}>
                    <CountUp value={respondents} style={s.tileNum} />
                  </View>
                  <Text style={s.tileLabel} numberOfLines={1}>
                    Respondents
                  </Text>
                </View>
              </View>
            </Rise>

            {sites.length === 0 ? (
              <Rise i={1}>
                <View style={[s.whiteCard, s.empty]}>
                  <View style={s.emptyIcon}>
                    <Ionicons
                      name="calendar-clear-outline"
                      size={26}
                      color={GOLD}
                    />
                  </View>
                  <Text style={s.emptyTitle}>
                    {loading ? "Loading surveys..." : `No surveys in ${period}`}
                  </Text>
                  {!loading && (
                    <Text style={s.emptySub}>
                      Try another month or year from the selector above.
                    </Text>
                  )}
                </View>
              </Rise>
            ) : (
              <>
                {/* overall + distribution */}
                <Rise i={1}>
                  <View style={s.hero}>
                    <View
                      style={[
                        s.deco,
                        {
                          width: 240,
                          height: 240,
                          borderRadius: 120,
                          bottom: -130,
                          left: -80,
                        },
                      ]}
                    />
                    <View style={s.heroRow}>
                      <Ring
                        value={overall}
                        size={124}
                        stroke={11}
                        color={overallColor}
                        track="rgba(255,255,255,0.08)"
                        animated
                      >
                        <Text style={[s.heroNum, { color: overallColor }]}>
                          {overall.toFixed(1)}
                        </Text>
                        <Text style={s.heroOf}>out of 5</Text>
                      </Ring>

                      <View style={{ flex: 1 }}>
                        <Text style={s.eyebrow}>AVERAGE HSE SCORE</Text>
                        <Text style={s.heroPeriod}>{period}</Text>
                        <View
                          style={[
                            s.heroLevel,
                            {
                              borderColor: overallColor + "88",
                              backgroundColor: overallColor + "22",
                            },
                          ]}
                        >
                          <View
                            style={[
                              s.levelDot,
                              { backgroundColor: overallColor },
                            ]}
                          />
                          <Text
                            style={[s.heroLevelTxt, { color: overallColor }]}
                          >
                            {levelOf(overall)}
                          </Text>
                        </View>
                        <Text style={s.heroSub}>
                          across {sites.length}{" "}
                          {sites.length === 1 ? "site" : "sites"}
                        </Text>
                      </View>
                    </View>

                    <View style={s.distBar}>
                      {dist
                        .filter((x) => x.n > 0)
                        .map((x) => (
                          <View
                            key={x.l}
                            style={{
                              flex: x.n,
                              backgroundColor: LEVEL_COLOR[x.l],
                            }}
                          />
                        ))}
                    </View>
                    <View style={s.legend}>
                      {dist.map((x) => (
                        <View key={x.l} style={s.legendItem}>
                          <View
                            style={[
                              s.levelDot,
                              { backgroundColor: LEVEL_COLOR[x.l] },
                            ]}
                          />
                          <Text style={s.legendTxt}>{x.l}</Text>
                          <Text style={s.legendNum}>{x.n}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </Rise>

                {/* category analytics (View Analytics) */}
                <Rise i={2}>
                  <View>
                    <Pressable
                      onPress={() => {
                        smooth();
                        setShowCats((v) => !v);
                      }}
                      style={({ pressed }) => [
                        s.anaBtn,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View style={s.anaIcon}>
                        <Ionicons name="bar-chart" size={18} color={C.dark} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.anaTitle}>View Analytics</Text>
                        <Text style={s.anaSub}>
                          Site scores & category averages
                        </Text>
                      </View>
                      <Ionicons
                        name={showCats ? "chevron-up" : "chevron-down"}
                        size={18}
                        color={GOLD}
                      />
                    </Pressable>

                    {showCats && (
                      <View style={{ marginTop: 10 }}>
                        <AnalyticsCard
                          sites={sites}
                          overall={overall}
                          cats={catAvg}
                          period={period}
                        />
                      </View>
                    )}
                  </View>
                </Rise>

                {/* ranking */}
                <View style={{ marginTop: 6 }}>
                  <SecHead
                    title="Site Ranking"
                    right={<Text style={s.secCount}>{sites.length}</Text>}
                  />
                  <View style={{ gap: 12 }}>
                    {sites.map((x, idx) => (
                      <Rise key={x.site} i={Math.min(idx, 6) + 2}>
                        <SiteCard
                          item={x}
                          rank={idx + 1}
                          items={filtered}
                          expanded={open === x.site}
                          onToggle={() => {
                            smooth();
                            setOpen((o) => (o === x.site ? "" : x.site));
                          }}
                          onOpen={() =>
                            router.push({
                              pathname: "/site",
                              params: { site: x.site },
                            } as any)
                          }
                        />
                      </Rise>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <ScrollTopButton
        visible={showTop}
        bottom={insets.bottom + 100}
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

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 20, marginTop: -48, gap: 14 },
  center: { alignItems: "center", justifyContent: "center" },

  /* control panel */
  panel: {
    backgroundColor: C.dark,
    borderRadius: 30,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
    ...shadow,
  },
  deco: {
    position: "absolute",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.18)",
  },
  panelGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: C.orange,
    opacity: 0.07,
    bottom: -130,
    left: -70,
  },
  panelTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.6,
  },
  panelTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  panelBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(249,162,30,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },

  yearItem: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
  },
  yearItemOn: {
    backgroundColor: "rgba(249,162,30,0.16)",
    borderColor: "rgba(249,162,30,0.7)",
    shadowColor: C.orange,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  yearText: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  yearTextOn: { color: "#fff" },
  yearDot: {
    width: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: C.orange,
    marginTop: 4,
  },

  gridRow: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  glassTile: {
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  highlight: {
    position: "absolute",
    top: 0,
    left: 0,
    borderRadius: 16,
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  monthText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  monthTextOn: { color: C.dark },
  monthCount: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 2,
  },
  monthCountOn: { color: "rgba(22,21,19,0.65)" },

  selPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(249,162,30,0.14)",
  },
  selDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
  },
  selText: { color: C.orange, fontSize: 12, fontWeight: "700" },

  /* tiles */
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
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 30,
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

  /* hero */
  hero: {
    backgroundColor: C.dark,
    borderRadius: 30,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 18 },
  heroNum: {
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1.2,
    lineHeight: 38,
  },
  heroOf: { color: "#6E6E73", fontSize: 10, fontWeight: "600" },
  heroPeriod: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginTop: 6,
  },
  heroLevel: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  heroLevelTxt: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
  heroSub: {
    color: "#8E8E93",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 8,
  },
  distBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    gap: 2,
    marginTop: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendTxt: { color: "#A1A1A6", fontSize: 11, fontWeight: "600" },
  legendNum: { color: "#fff", fontSize: 11, fontWeight: "800" },
  levelDot: { width: 7, height: 7, borderRadius: 4 },

  /* analytics toggle */
  anaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.dark,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.35)",
  },
  anaIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  anaTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  anaSub: { color: "#8E8E93", fontSize: 11.5, marginTop: 1 },
  whiteCard: {
    backgroundColor: C.card,
    borderRadius: 22,
    padding: 16,
    ...shadow,
  },

  /* category line */
  catRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  catIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  catName: { color: C.ink, fontSize: 12.5, fontWeight: "700", marginBottom: 6 },
  catScore: {
    fontSize: 13,
    fontWeight: "800",
    minWidth: 28,
    textAlign: "right",
  },
  barTrack: { height: 4, borderRadius: 2, overflow: "hidden" },

  /* section */
  secHead: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
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
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  secCount: { color: "#A0A0A0", fontSize: 12, fontWeight: "800" },

  /* site card */
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    overflow: "hidden",
    ...shadow,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 16,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 4,
    borderRadius: 2,
  },
  photoWrap: { width: 70, height: 70 },
  photo: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "#E9E6DF",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
  },
  mono: { color: C.orange, fontWeight: "800", fontSize: 18, letterSpacing: 1 },
  rank: {
    position: "absolute",
    left: -6,
    bottom: -6,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 9,
    backgroundColor: C.dark,
    borderWidth: 1.5,
    borderColor: C.card,
  },
  rankTop: { backgroundColor: C.orange },
  rankText: { color: "#fff", fontSize: 10.5, fontWeight: "800" },
  siteName: { color: C.ink, fontSize: 13.5, fontWeight: "800", lineHeight: 17 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  meta: { color: "#8E8E93", fontSize: 11.5, fontWeight: "500", flexShrink: 1 },
  sep: { color: "#C8C5BE", fontSize: 8 },
  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 7,
  },
  levelTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  ringNum: { color: C.ink, fontSize: 13, fontWeight: "800" },

  expand: { paddingHorizontal: 16, paddingBottom: 16 },
  expandLine: { height: 1, backgroundColor: C.line, marginBottom: 14 },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: C.dark,
  },
  openTxt: {
    color: C.orange,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },

  /* analytics card + chart */
  anaCard: {
    backgroundColor: C.dark,
    borderRadius: 28,
    padding: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.35)",
    ...shadow,
  },
  anaHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  anaHeadIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: "rgba(249,162,30,0.14)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  anaHeadTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  anaHeadSub: {
    color: C.orange,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
  seg: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 3,
    marginTop: 16,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
  },
  segOn: { backgroundColor: C.orange },
  segTxt: {
    color: "#8E8E93",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  segTxtOn: { color: C.dark },

  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  infoAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: "#2A2826",
  },
  infoName: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
    lineHeight: 17,
  },
  infoSub: {
    color: "#8E8E93",
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 3,
  },
  infoScore: { fontSize: 28, fontWeight: "800", letterSpacing: -1 },

  col: { justifyContent: "flex-end", alignItems: "center", borderRadius: 12 },
  colOn: { backgroundColor: "rgba(255,255,255,0.06)" },
  barVal: { fontSize: 10.5, fontWeight: "800", marginBottom: 4 },
  cap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  sheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: "30%",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  xLab: {
    position: "absolute",
    height: 14,
    textAlign: "right",
    fontSize: 10.5,
    fontWeight: "700",
    transform: [{ rotate: "-90deg" }],
  },
  yLab: { color: "#6E6E73", fontSize: 10, fontWeight: "700" },
  avgRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  hint: {
    flex: 1,
    textAlign: "right",
    color: "#6E6E73",
    fontSize: 10.5,
    fontWeight: "600",
  },

  /* empty */
  empty: { alignItems: "center", paddingVertical: 34, gap: 8 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: "800", marginTop: 4 },
  emptySub: { color: "#8E8E93", fontSize: 12.5, textAlign: "center" },
});

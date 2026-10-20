// components/project-info-tab.tsx
import { FIELDS, getField } from "@/constants/fields";
import { C, shadow } from "@/constants/theme";
import { getSharePointToken } from "@/hooks/useMicrosoftAuth";
import { fetchProjectInfo, type ProjectInfo } from "@/lib/project-info";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
const fmt = (d: Date | null) =>
  d
    ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : "Not set";

const DAY = 86400000;

/* ---------------- helpers ---------------- */
const respondentOf = (item: any): string => {
  const f = item?.fields ?? item ?? {};
  // "Respondent" column ka internal name Title hai
  const t = String(f.Title ?? "").trim();
  if (t) return t;

  const k = Object.keys(f).find((x) => /^respondent$/i.test(x));
  const r = k ? f[k] : undefined;
  if (typeof r === "string") return r.trim();
  return "";
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
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => a.removeListener(id);
  }, [value, a]);
  return <Text style={style}>{n}</Text>;
}

function Pulse({ style }: { style: any }) {
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 0.8,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[style, { opacity: v }]} />;
}

function TimelineBar({ pct, color }: { pct: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: pct,
      duration: 1500,
      delay: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct, v]);
  const width = v.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });
  return (
    <View style={s.tlTrack}>
      <Animated.View style={[s.tlFill, { width, backgroundColor: color }]} />
      <Animated.View style={[s.tlDotWrap, { left: width }]}>
        <View style={[s.tlDot, { backgroundColor: color }]} />
      </Animated.View>
    </View>
  );
}

/* ---------------- pieces ---------------- */
function SecHead({ title, count }: { title: string; count?: number }) {
  return (
    <View style={s.secHead}>
      <View style={[s.secBar, { backgroundColor: C.orange }]} />
      <Text style={s.secTitle}>{title}</Text>
      {count !== undefined && <Text style={s.secCount}>{count}</Text>}
    </View>
  );
}

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
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/photo/$value`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        console.log("PHOTO", email, res.status);
        if (!res.ok) return;
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (alive) setUri(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.log("PHOTO ERR", email, e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [email, token]);

  return (
    <View
      style={[
        s.avatar,
        { width: size, height: size, borderRadius: size * 0.32 },
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

function TeamCard({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[s.card, s.teamCard]}>
      <View style={[s.iconTile, { marginBottom: 10 }]}>
        <Ionicons name={icon as any} size={17} color={GOLD} />
      </View>
      <Text style={s.cardLabel}>{label}</Text>
      <Text style={s.teamValue} numberOfLines={4}>
        {value || "N/A"}
      </Text>
    </View>
  );
}

/* ---------------- main ---------------- */
export function ProjectInfoTab({
  site,
  city,
  items,
  accessToken,
}: {
  site: string;
  city: string;
  items: any[];
  accessToken?: string | null;
}) {
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedFor, setLoadedFor] = useState("");

  const load = useCallback(
    async (force = false) => {
      setLoading(true);
      setError("");
      try {
        const tk = await getSharePointToken();
        const data = await fetchProjectInfo(tk, site, force);
        setInfo(data);
        setLoadedFor(site);
      } catch (e: any) {
        setError(e?.message ?? "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [site],
  );

  useEffect(() => {
    if (loadedFor !== site) load();
  }, [site, loadedFor, load]);

  // surveyors = distinct respondents of this site
  const surveyors = useMemo(() => {
    const seen = new Set<string>();
    const out: { email: string; name: string }[] = [];
    items.forEach((it) => {
      if (getField(it, FIELDS.projectSite) !== site) return;
      const email = respondentOf(it);
      const key = email.toLowerCase();
      if (!email || seen.has(key)) return;
      seen.add(key);
      out.push({ email, name: nameFromEmail(email) });
    });
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [items, site]);

  // timeline maths
  const tl = useMemo(() => {
    if (!info?.start || !info?.end) return null;
    const now = Date.now();
    const a = info.start.getTime();
    const b = info.end.getTime();
    const total = Math.max(1, Math.round((b - a) / DAY));
    const pct = Math.max(0, Math.min(100, ((now - a) / (b - a)) * 100));
    const left = Math.round((b - now) / DAY);
    const status = now < a ? "Upcoming" : now > b ? "Completed" : "In Progress";
    const color =
      status === "Completed"
        ? "#7D7D7D"
        : status === "Upcoming"
          ? "#FF9900"
          : GOLD;
    return { total, pct, left, status, color };
  }, [info]);

  /* ---- loading ---- */
  if (loading && !info) {
    return (
      <View style={{ gap: 14 }}>
        <Pulse style={[s.skel, { height: 150, borderRadius: 28 }]} />
        <Pulse style={[s.skel, { height: 130, borderRadius: 28 }]} />
        <Pulse style={[s.skel, { height: 90, borderRadius: 22 }]} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pulse style={[s.skel, { height: 120, borderRadius: 22, flex: 1 }]} />
          <Pulse style={[s.skel, { height: 120, borderRadius: 22, flex: 1 }]} />
        </View>
      </View>
    );
  }

  /* ---- error ---- */
  if (error && !info) {
    return (
      <View style={[s.card, s.stateBox]}>
        <Ionicons name="cloud-offline-outline" size={30} color={GOLD} />
        <Text style={s.stateTitle}>Project info load nahi hui</Text>
        <Text style={s.stateSub}>{error}</Text>
        <Pressable onPress={() => load(true)} style={s.retry}>
          <Text style={s.retryText}>RETRY</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: 6 }}>
      {/* ===== IDENTITY ===== */}
      <SecHead title="Project Identity" />
      <Rise i={0}>
        <View style={s.hero}>
          <View
            style={[
              s.ring,
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
              s.ring,
              {
                width: 160,
                height: 160,
                borderRadius: 80,
                top: -60,
                right: -50,
              },
            ]}
          />
          <View style={s.glow} />

          <Text style={s.eyebrow}>PROJECT SITE</Text>
          <Text style={s.heroName} numberOfLines={3}>
            {site}
          </Text>
          <View style={s.goldLine} />

          <View style={s.chipRow}>
            <View style={s.chip}>
              <Ionicons name="location-sharp" size={13} color={GOLD} />
              <Text style={s.chipText}>{city}</Text>
            </View>
            <View style={s.chip}>
              <Ionicons name="people" size={13} color={GOLD} />
              <Text style={s.chipText}>Total Surveyors</Text>
              <CountUp value={surveyors.length} style={s.chipNum} />
            </View>
          </View>
        </View>
      </Rise>

      {/* ===== TIMELINE ===== */}
      <View style={{ height: 8 }} />
      <SecHead title="Project Timeline" />
      <Rise i={1}>
        <View style={[s.hero, !tl && s.heroCompact]}>
          <View
            style={[
              s.ring,
              {
                width: 200,
                height: 200,
                borderRadius: 100,
                bottom: -110,
                left: -70,
              },
            ]}
          />

          <View style={s.dateRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>START DATE</Text>
              <Text style={s.dateText}>{fmt(info?.start ?? null)}</Text>
            </View>
            <View style={s.arrow}>
              <Ionicons name="arrow-forward" size={15} color={GOLD} />
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={s.eyebrow}>COMPLETION</Text>
              <Text style={s.dateText}>{fmt(info?.end ?? null)}</Text>
            </View>
          </View>

          {tl ? (
            <>
              <TimelineBar pct={tl.pct} color={tl.color} />
              <View style={s.tlStats}>
                <View style={s.tlStat}>
                  <Text style={s.tlStatNum}>{tl.total}</Text>
                  <Text style={s.tlStatLbl}>TOTAL DAYS</Text>
                </View>
                <View style={s.tlDiv} />
                <View style={s.tlStat}>
                  <Text style={s.tlStatNum}>{Math.round(tl.pct)}%</Text>
                  <Text style={s.tlStatLbl}>ELAPSED</Text>
                </View>
                <View style={s.tlDiv} />
                <View style={s.tlStat}>
                  <Text style={s.tlStatNum}>
                    {tl.left >= 0 ? tl.left : Math.abs(tl.left)}
                  </Text>
                  <Text style={s.tlStatLbl}>
                    {tl.left >= 0 ? "DAYS LEFT" : "DAYS AGO"}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.statusPill,
                  {
                    borderColor: tl.color + "88",
                    backgroundColor: tl.color + "22",
                  },
                ]}
              >
                <View style={[s.statusDot, { backgroundColor: tl.color }]} />
                <Text style={[s.statusText, { color: tl.color }]}>
                  {tl.status.toUpperCase()}
                </Text>
              </View>
            </>
          ) : null}
        </View>
      </Rise>

      {/* ===== TEAM ===== */}
      <View style={{ height: 8 }} />
      <SecHead title="Project Team" />
      <Rise i={2}>
        <View style={[s.card, s.directorCard]}>
          <View style={s.directorAvatar}>
            <Text style={s.directorInit}>
              {initials(info?.director || "N A")}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardLabel}>PROJECT DIRECTOR</Text>
            <Text style={s.directorName} numberOfLines={2}>
              {info?.director || "N/A"}
            </Text>
          </View>
          <View style={s.iconTile}>
            <Ionicons name="ribbon-outline" size={18} color={GOLD} />
          </View>
        </View>
      </Rise>

      <View style={{ height: 4 }} />
      <Rise i={3}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <TeamCard
            icon="business-outline"
            label="CONSULTANT"
            value={info?.consultant ?? ""}
          />
          <TeamCard
            icon="construct-outline"
            label="CONTRACTOR"
            value={info?.contractor ?? ""}
          />
        </View>
      </Rise>

      {/* ===== SURVEYORS ===== */}
      <View style={{ height: 8 }} />
      <SecHead title="Project Surveyors" count={surveyors.length} />
      {surveyors.length === 0 ? (
        <View style={[s.card, s.stateBox]}>
          <Ionicons name="people-outline" size={26} color="#B8B5AE" />
          <Text style={s.stateSub}>Abhi tak is site pe koi surveyor nahi</Text>
          {/* DIAGNOSTIC: kaam hone ke baad hata dein */}
          <Text style={[s.stateSub, { fontSize: 10 }]}>
            {`Items: ${items.length}\nKeys: ${Object.keys(items[0]?.fields ?? items[0] ?? {}).join(", ")}`}
          </Text>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {surveyors.map((p, i) => (
            <Rise key={p.email} i={Math.min(i, 8) + 4}>
              <View style={[s.card, s.surRow]}>
                <View style={s.surAccent} />
                <Avatar
                  email={p.email}
                  name={p.name}
                  token={accessToken ?? ""}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.surName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={s.surMail} numberOfLines={1}>
                    {p.email}
                  </Text>
                </View>
                <View style={s.mailBtn}>
                  <Ionicons name="mail-outline" size={15} color={GOLD} />
                </View>
              </View>
            </Rise>
          ))}
        </View>
      )}
    </View>
  );
}

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  secHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  secBar: { width: 4, height: 16, borderRadius: 2, marginRight: 10 },
  secTitle: {
    flex: 1,
    color: C.ink,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  secCount: { color: "#A0A0A0", fontSize: 12, fontWeight: "800" },

  card: { backgroundColor: C.card, borderRadius: 22, ...shadow },

  hero: {
    backgroundColor: C.dark,
    borderRadius: 28,
    padding: 22,
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
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: GOLD,
    opacity: 0.08,
    bottom: -120,
    left: -60,
  },
  eyebrow: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2.4,
  },
  heroName: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.6,
    lineHeight: 30,
    marginTop: 8,
    paddingRight: 40,
  },
  goldLine: {
    height: 2,
    width: 64,
    borderRadius: 1,
    backgroundColor: GOLD,
    marginTop: 14,
    marginBottom: 16,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.25)",
  },
  chipText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "600",
  },
  chipNum: { color: GOLD, fontSize: 14, fontWeight: "800", marginLeft: 2 },

  dateRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dateText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 6,
  },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(249,162,30,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.3)",
  },

  tlTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    marginTop: 22,
  },
  tlFill: { height: "100%", borderRadius: 4 },
  tlDotWrap: { position: "absolute", top: -3, width: 0, alignItems: "center" },
  tlDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: "#111",
  },
  tlStats: { flexDirection: "row", alignItems: "center", marginTop: 20 },
  tlStat: { flex: 1, alignItems: "center" },
  tlStatNum: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tlStatLbl: {
    color: "#6E6E73",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 4,
  },
  tlDiv: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)" },
  statusPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "800", letterSpacing: 1.5 },
  noDates: {
    color: "#8E8E93",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 18,
    textAlign: "center",
  },

  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },
  cardLabel: {
    color: C.gray,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  heroCompact: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 24,
  },

  directorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  directorAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: GOLD,
  },
  directorInit: { color: GOLD, fontSize: 17, fontWeight: "800" },
  directorName: {
    color: C.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 4,
  },

  teamCard: { flex: 1, padding: 14, minHeight: 0 },
  teamValue: {
    color: C.ink,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    marginTop: 4,
  },

  surRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    paddingLeft: 16,
    overflow: "hidden",
  },
  surAccent: {
    position: "absolute",
    left: 0,
    top: 10,
    bottom: 10,
    width: 4,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  surName: { color: C.ink, fontSize: 14.5, fontWeight: "800" },
  surMail: { color: C.gray, fontSize: 12, fontWeight: "500", marginTop: 2 },
  mailBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(249,162,30,0.5)",
  },
  avatarText: { color: GOLD, fontWeight: "800" },

  skel: { backgroundColor: "#E4E0D8" },
  stateBox: { alignItems: "center", padding: 26, gap: 8 },
  stateTitle: { color: C.ink, fontSize: 15, fontWeight: "800" },
  stateSub: {
    color: C.gray,
    fontSize: 12.5,
    fontWeight: "600",
    textAlign: "center",
  },
  retry: {
    marginTop: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: C.dark,
  },
  retryText: { color: GOLD, fontSize: 12, fontWeight: "800", letterSpacing: 2 },
});

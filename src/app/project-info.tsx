import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    FlatList,
    Image,
    Linking,
    Modal,
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
import { SITE_CITY } from "@/constants/site-cities";
import { SITE_IMAGES } from "@/constants/site-images";
import { C, shadow } from "@/constants/theme";
import { getSharePointToken, useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";

const GOLD = "#EC991B";
const SITE_URL = "https://idappk.sharepoint.com/sites/DummyProjects";
const LIST_TITLE = "HSE Project Dates";
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

/* ---------------- contacts (from Power Apps) ---------------- */
const PHONES: Record<string, string> = {
  "Wajid Mehmood": "03202816956",
  "Qasim Ghafoor": "03232545005",
  "Attiq ur Rehman": "03000642376",
  "Ali Zeeshan": "03268185815",
  "Aamir Saeed": "03214067097",
  "Waqas Javaid": "03334221913",
  "Yasser Hammad": "03268460739",
  "Ali Usman": "03234162340",
  "Mahmood Mukhtar": "03008058629",
  "Bilal Raza": "03000641235",
  "Rehan Ali": "03000643597",
};
const EMAILS: Record<string, string> = {
  "Wajid Mehmood": "wajid.mehmood@idap.pk",
  "Qasim Ghafoor": "qasim.ghafoor@idap.pk",
  "Attiq ur Rehman": "atiq.urrehman@idap.pk",
  "Ali Zeeshan": "ali.zeeshan@idap.pk",
  "Aamir Saeed": "aamir.saeed@idap.pk",
  "Waqas Javaid": "waqas.javaid@idap.pk",
  "Yasser Hammad": "yasser.hammad@idap.pk",
  "Ali Usman": "ali.usman@idap.pk",
  "Mahmood Mukhtar": "mahmood.mukhtar@idap.pk",
  "Bilal Raza": "bilal.raza@idap.pk",
  "Rehan Ali": "rehan.ali@idap.pk",
};

/* ---------------- data ---------------- */
type Row = {
  id: string;
  site: string;
  short: string;
  city: string;
  start: Date | null;
  end: Date | null;
  director: string;
  consultant: string;
  contractor: string;
};

const norm = (s: string) =>
  String(s ?? "")
    .replace(/_x0020_/gi, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const txt = (v: any): string => {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
  if (typeof v === "object")
    return txt(v.Value ?? v.LookupValue ?? v.Title ?? v.Name ?? v.Email ?? "");
  return String(v);
};

const toDate = (v: any): Date | null => {
  if (!v) return null;
  const d = new Date(v);
  // 1900 / invalid dates = "not set"
  if (isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d;
};

// known site names, so the site column can be found and images/cities match
const KNOWN: Record<string, string> = {};
[...Object.keys(SITE_CITY), ...Object.keys(SITE_IMAGES)].forEach((k) => {
  KNOWN[norm(k)] = k;
});

async function fetchRows(spToken: string): Promise<Row[]> {
  const url =
    `${SITE_URL}/_api/web/lists/getbytitle('${encodeURIComponent(LIST_TITLE)}')` +
    `/items?$top=5000`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${spToken}`,
      Accept: "application/json;odata=nometadata",
    },
  });
  if (!res.ok) throw new Error(`Project info load nahi hui (${res.status})`);
  const json = await res.json();

  const out: Row[] = [];
  (json.value ?? []).forEach((r: any, idx: number) => {
    const fkeys = Object.keys(r)
      .filter((k) => /^field_\d+$/.test(k))
      .sort((a, b) => Number(a.slice(6)) - Number(b.slice(6)));

    // site column: pehla field jo kisi known site se match kare,
    // warna pehla non-empty text field
    let siteKey = fkeys.find(
      (k) => typeof r[k] === "string" && KNOWN[norm(r[k])],
    );
    if (!siteKey)
      siteKey = fkeys.find((k) => typeof r[k] === "string" && r[k].trim());
    if (!siteKey) return;

    const n = Number(siteKey.slice(6));
    const at = (o: number) => r[`field_${n + o}`];

    const raw = txt(r[siteKey]);
    const site = KNOWN[norm(raw)] ?? raw;

    // List ki order: Site, Short, Start, Completion, Director, Consultant, Contractor
    out.push({
      id: String(r.Id ?? r.ID ?? idx),
      site,
      short: txt(at(1)),
      city: SITE_CITY[site] ?? "Punjab",
      start: toDate(at(2)),
      end: toDate(at(3)),
      director: txt(at(4)),
      consultant: txt(at(5)),
      contractor: txt(at(6)),
    });
  });

  return out.sort((a, b) => a.site.localeCompare(b.site));
}

/* ---------------- helpers ---------------- */
const fmt = (d: Date | null) =>
  d
    ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
    : "Not set";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

type Status = "In Progress" | "Completed" | "Upcoming" | "Not set";
const STATUS_COLOR: Record<Status, string> = {
  "In Progress": GOLD,
  Completed: "#7D7D7D",
  Upcoming: "#3B82F6",
  "Not set": "#B8B5AE",
};

function timeline(r: Row) {
  if (!r.start || !r.end)
    return { status: "Not set" as Status, pct: 0, left: 0, total: 0 };
  const now = Date.now();
  const a = r.start.getTime();
  const b = r.end.getTime();
  const status: Status =
    now < a ? "Upcoming" : now > b ? "Completed" : "In Progress";
  const pct = Math.max(
    0,
    Math.min(100, ((now - a) / Math.max(1, b - a)) * 100),
  );
  return {
    status,
    pct,
    left: Math.ceil((b - now) / DAY),
    total: Math.max(1, Math.round((b - a) / DAY)),
  };
}

const FILTERS = ["All", "In Progress", "Completed", "Upcoming"] as const;
type Filter = (typeof FILTERS)[number];

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
      duration: 460,
      delay: Math.min(index, 8) * 55,
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
              outputRange: [22, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function Field({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={s.field}>
      <View style={s.fieldIcon}>
        <Ionicons name={icon as any} size={14} color={GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.fieldLabel}>{label}</Text>
        <Text style={s.fieldValue}>{value || "N/A"}</Text>
      </View>
    </View>
  );
}

/* ---------------- card ---------------- */
function ProjectCard({ r, onContact }: { r: Row; onContact: () => void }) {
  const t = timeline(r);
  const color = STATUS_COLOR[t.status];
  const src = SITE_IMAGES[r.site];

  return (
    <View style={s.card}>
      <View style={[s.accent, { backgroundColor: GOLD }]} />

      {/* top */}
      <View style={s.topRow}>
        <View style={s.thumbWrap}>
          {src ? (
            <Image source={src} style={s.thumb} resizeMode="cover" />
          ) : (
            <View style={[s.thumb, s.thumbEmpty]}>
              <Text style={s.thumbText}>{initials(r.short || r.site)}</Text>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.site} numberOfLines={2}>
            {r.site}
          </Text>
          <View style={s.metaRow}>
            <Ionicons name="location-sharp" size={12} color={GOLD} />
            <Text style={s.meta} numberOfLines={1}>
              {r.city}
            </Text>
            {!!r.short && (
              <>
                <Text style={s.sep}>•</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {r.short}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* status + timeline */}
      {/* timeline */}

      <View style={s.dates}>
        <View style={{ flex: 1 }}>
          <Text style={s.dLabel}>START</Text>
          <Text style={s.dValue}>{fmt(r.start)}</Text>
        </View>
        <View style={s.dArrow}>
          <Ionicons name="arrow-forward" size={13} color={GOLD} />
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={s.dLabel}>COMPLETION</Text>
          <Text style={s.dValue}>{fmt(r.end)}</Text>
        </View>
      </View>

      {/* consultant / contractor */}
      <View style={s.grid}>
        <Field
          icon="business-outline"
          label="CONSULTANT"
          value={r.consultant}
        />
        <Field
          icon="construct-outline"
          label="CONTRACTOR"
          value={r.contractor}
        />
      </View>

      {/* director footer */}
      <View style={s.footer}>
        <View style={s.dirAvatar}>
          <Text style={s.dirInit}>{initials(r.director || "N A")}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.dirLabel}>PROJECT DIRECTOR</Text>
          <Text style={s.dirName} numberOfLines={1}>
            {r.director || "N/A"}
          </Text>
        </View>
        <Pressable
          onPress={onContact}
          style={({ pressed }) => [
            s.contactBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
        >
          <Ionicons name="call" size={13} color="#111" />
          <Text style={s.contactText}>Contact</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- contact sheet ---------------- */
function ContactRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value: string;
  onPress: () => void;
}) {
  const ok = !!value;
  return (
    <Pressable
      disabled={!ok}
      onPress={onPress}
      style={({ pressed }) => [s.cRow, pressed && { opacity: 0.8 }]}
    >
      <View style={s.cIcon}>
        <Ionicons name={icon as any} size={18} color={GOLD} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.cLabel}>{label}</Text>
        <Text style={[s.cValue, !ok && { color: "#6E6E73" }]} numberOfLines={1}>
          {ok ? value : "Not available"}
        </Text>
      </View>
      {ok && <Ionicons name="chevron-forward" size={16} color="#6E6E73" />}
    </Pressable>
  );
}

function ContactSheet({ r, onClose }: { r: Row | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const phone = r ? (PHONES[r.director] ?? "") : "";
  const email = r ? (EMAILS[r.director] ?? "") : "";
  return (
    <Modal
      visible={!!r}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={s.mBackdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 22 }]}>
          <View style={s.sheetGlow} />
          <View style={s.grabber} />

          <View style={s.sHead}>
            <View style={s.sAvatar}>
              <Text style={s.sInit}>{initials(r?.director || "N A")}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sEyebrow}>PROJECT DIRECTOR</Text>
              <Text style={s.sName} numberOfLines={2}>
                {r?.director || "N/A"}
              </Text>
              <Text style={s.sSite} numberOfLines={1}>
                {r?.site}
              </Text>
            </View>
          </View>

          <View style={{ gap: 10, marginTop: 20 }}>
            <ContactRow
              icon="call-outline"
              label="PHONE"
              value={phone}
              onPress={() => Linking.openURL(`tel:${phone}`)}
            />
            <ContactRow
              icon="mail-outline"
              label="EMAIL"
              value={email}
              onPress={() => Linking.openURL(`mailto:${email}`)}
            />
          </View>

          <View style={s.sActions}>
            <Pressable
              disabled={!phone}
              onPress={() => Linking.openURL(`tel:${phone}`)}
              style={({ pressed }) => [
                s.actPrimary,
                !phone && { opacity: 0.4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="call" size={16} color="#111" />
              <Text style={s.actPrimaryText}>Call now</Text>
            </Pressable>
            <Pressable
              disabled={!email}
              onPress={() => Linking.openURL(`mailto:${email}`)}
              style={({ pressed }) => [
                s.actGhost,
                !email && { opacity: 0.4 },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="mail" size={16} color={GOLD} />
              <Text style={s.actGhostText}>Send email</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ---------------- screen ---------------- */
export default function ProjectInfo() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signOut } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [sel, setSel] = useState<Row | null>(null);
  const listRef = useRef<FlatList>(null);
  const [showTop, setShowTop] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const tk = await getSharePointToken();
      setRows(await fetchRows(tk));
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!accessToken) router.replace("/");
  }, [accessToken, router]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      All: rows.length,
      "In Progress": 0,
      Completed: 0,
      Upcoming: 0,
    };
    rows.forEach((r) => {
      const st = timeline(r).status;
      if (st in c) c[st] += 1;
    });
    return c;
  }, [rows]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const okF = filter === "All" || timeline(r).status === filter;
      const okQ =
        !q ||
        r.site.toLowerCase().includes(q) ||
        r.short.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q) ||
        r.director.toLowerCase().includes(q);
      return okF && okQ;
    });
  }, [rows, filter, query]);

  const header = (
    <View>
      <AppHeader profile={profile} onMenuPress={() => setMenuOpen(true)} />

      <View style={s.panel}>
        <View style={s.titleRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={s.back}>
            <Ionicons name="chevron-back" size={20} color={C.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Project Information</Text>
            <Text style={s.sub}>Timeline, team and contacts</Text>
          </View>
          <View style={s.countBox}>
            <Text style={s.countNum}>{list.length}</Text>
            <Text style={s.countLabel}>RECORDS</Text>
          </View>
        </View>

        <View style={s.search}>
          <Ionicons name="search" size={18} color="#9A9A9A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search project, city or director"
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
      </View>

      <View style={s.rankHead}>
        <View style={s.rankBar} />
        <Text style={s.rankTitle}>PROJECT LISTINGS</Text>
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
          setShowTop((p) => (p === show ? p : show));
        }}
        scrollEventThrottle={16}
        data={list}
        keyExtractor={(i) => i.id}
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
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons
              name={
                error ? "cloud-offline-outline" : "information-circle-outline"
              }
              size={34}
              color="#C5C2BB"
            />
            <Text style={s.emptyTitle}>
              {loading
                ? "Loading projects..."
                : error
                  ? "Could not load projects"
                  : "No projects found"}
            </Text>
            {!!error && <Text style={s.emptySub}>{error}</Text>}
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <FadeIn index={index}>
              <ProjectCard r={item} onContact={() => setSel(item)} />
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
      <ContactSheet r={sel} onClose={() => setSel(null)} />
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
  title: { color: C.ink, fontSize: 19, fontWeight: "800", letterSpacing: -0.5 },
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

  /* card */
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    padding: 16,
    paddingLeft: 20,
    overflow: "hidden",
    ...shadow,
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 18,
    bottom: 18,
    width: 4,
    borderRadius: 2,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumbWrap: { width: 56, height: 56 },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#E9E6DF",
  },
  thumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
  },
  thumbText: {
    color: C.orange,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1,
  },
  site: {
    color: C.ink,
    fontSize: 14.5,
    fontWeight: "800",
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  meta: { color: "#8E8E93", fontSize: 11.5, fontWeight: "600", flexShrink: 1 },
  sep: { color: "#C8C5BE", fontSize: 8 },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  leftText: { color: "#8E8E93", fontSize: 11.5, fontWeight: "700" },

  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#EFEDE8",
    overflow: "hidden",
    marginTop: 10,
  },
  fill: { height: "100%", borderRadius: 3 },

  dates: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    backgroundColor: "#F8F6F2",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  dLabel: {
    color: "#A0A0A0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  dValue: {
    color: C.ink,
    fontSize: 13.5,
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: -0.2,
  },
  dArrow: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },

  grid: { flexDirection: "column", gap: 12, marginTop: 14 },
  field: { flex: 1, flexDirection: "row", gap: 9 },
  fieldIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: "#FDF2E0",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldLabel: {
    color: "#A0A0A0",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  fieldValue: {
    color: C.ink,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 16,
    marginTop: 3,
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    backgroundColor: C.dark,
    borderRadius: 20,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.25)",
  },
  dirAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(249,162,30,0.14)",
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  dirInit: { color: GOLD, fontSize: 14, fontWeight: "800" },
  dirLabel: {
    color: "#8E8E93",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  dirName: { color: "#fff", fontSize: 14, fontWeight: "800", marginTop: 2 },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  contactText: { color: "#111", fontSize: 12.5, fontWeight: "800" },

  empty: {
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 30,
    gap: 6,
  },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: "700", marginTop: 6 },
  emptySub: { color: "#8E8E93", fontSize: 12, textAlign: "center" },

  /* sheet */
  mBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#141416",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    padding: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
  },
  sheetGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: GOLD,
    opacity: 0.12,
    top: -120,
    right: -90,
  },
  grabber: {
    alignSelf: "center",
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 18,
  },
  sHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  sAvatar: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "rgba(249,162,30,0.14)",
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: "center",
    justifyContent: "center",
  },
  sInit: { color: GOLD, fontSize: 21, fontWeight: "800" },
  sEyebrow: {
    color: "#8E8E93",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 2,
  },
  sName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 3,
    letterSpacing: -0.4,
  },
  sSite: { color: "#A1A1A6", fontSize: 12, marginTop: 3 },

  cRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: "rgba(249,162,30,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  cLabel: {
    color: "#8E8E93",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
  },
  cValue: { color: "#fff", fontSize: 15, fontWeight: "700", marginTop: 3 },

  sActions: { flexDirection: "row", gap: 10, marginTop: 20 },
  actPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 15,
  },
  actPrimaryText: { color: "#111", fontSize: 14.5, fontWeight: "800" },
  actGhost: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.5)",
    backgroundColor: "rgba(249,162,30,0.1)",
  },
  actGhostText: { color: GOLD, fontSize: 14.5, fontWeight: "800" },
});

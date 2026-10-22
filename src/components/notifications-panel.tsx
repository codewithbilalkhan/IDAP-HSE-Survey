// components/notifications-panel.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/theme";
import {
    isUnread,
    markAllRead,
    markRead,
    type Notif,
} from "@/lib/notifications";

const WIDTH = Math.min(Dimensions.get("window").width * 0.88, 390);
const DAY = 86400000;
const GOLD = "#EC991B";
const RED = "#E5484D";
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
  Excellent: "#F8BF32",
  Good: "#9A9A9E",
  Fair: "#FF9900",
  Poor: "#E5484D",
  "Very Poor": "#B8343A",
};

type Filter = "all" | "unread";
const GROUPS = ["TODAY", "YESTERDAY", "EARLIER"] as const;

/* ---------------- helpers ---------------- */
const dayStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const groupOf = (d: Date): (typeof GROUPS)[number] => {
  const diff = Math.round((dayStart(new Date()) - dayStart(d)) / DAY);
  return diff <= 0 ? "TODAY" : diff === 1 ? "YESTERDAY" : "EARLIER";
};

const timeLabel = (d: Date) => {
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  let hr = d.getHours();
  const ap = hr >= 12 ? "PM" : "AM";
  hr = hr % 12 || 12;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${hr}:${String(
    d.getMinutes(),
  ).padStart(2, "0")} ${ap}`;
};

/* ---------------- card ---------------- */
function NotifCard({
  n,
  i,
  unread,
  onPress,
}: {
  n: Notif;
  i: number;
  unread: boolean;
  onPress: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 460,
      delay: 160 + Math.min(i, 8) * 60,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, i]);

  const alert = n.kind === "alert";
  const tone = alert ? RED : GOLD;
  const scoreColor = n.score > 0 ? (LEVEL_COLOR[n.level] ?? GOLD) : GOLD;

  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateX: v.interpolate({
              inputRange: [0, 1],
              outputRange: [28, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          s.card,
          unread && s.cardUnread,
          alert && unread && { borderColor: "rgba(229,72,77,0.45)" },
          pressed && { transform: [{ scale: 0.985 }] },
        ]}
      >
        {unread && <View style={[s.accent, { backgroundColor: tone }]} />}

        <View style={[s.iconTile, { backgroundColor: tone + "22" }]}>
          <Ionicons
            name={alert ? "warning" : "clipboard"}
            size={19}
            color={tone}
          />
        </View>

        <View style={{ flex: 1 }}>
          <View style={s.titleRow}>
            <Text
              style={[
                s.cardTitle,
                !unread && { color: "rgba(255,255,255,0.7)" },
              ]}
              numberOfLines={1}
            >
              {n.title}
            </Text>
            {unread && (
              <View
                style={[s.dot, { backgroundColor: tone, shadowColor: tone }]}
              />
            )}
          </View>

          <Text style={s.cardBody} numberOfLines={3}>
            {n.body}
          </Text>

          <View style={s.metaRow}>
            <Ionicons name="time-outline" size={12} color="#6E6E73" />
            <Text style={s.meta}>{timeLabel(n.time)}</Text>
            {!alert && (
              <>
                <Text style={s.sep}>•</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {n.who}
                </Text>
              </>
            )}
            {n.score > 0 && (
              <View
                style={[
                  s.scorePill,
                  {
                    backgroundColor: scoreColor + "26",
                    borderColor: scoreColor + "66",
                  },
                ]}
              >
                <Text style={[s.scoreTxt, { color: scoreColor }]}>
                  {n.score.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

/* ---------------- panel ---------------- */
export function NotificationsPanel({
  visible,
  onClose,
  notifications,
}: {
  visible: boolean;
  onClose: () => void;
  notifications: Notif[];
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mounted, setMounted] = useState(visible);
  const [filter, setFilter] = useState<Filter>("all");
  const [openKey, setOpenKey] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setFilter("all");
      setOpenKey((k) => k + 1);
      Animated.timing(anim, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, anim]);

  if (!mounted) return null;

  const unreadList = notifications.filter(isUnread);
  const unreadCount = unreadList.length;
  const list = filter === "unread" ? unreadList : notifications;
  const groups = GROUPS.map((g) => ({
    g,
    items: list.filter((n) => groupOf(n.time) === g),
  })).filter((x) => x.items.length > 0);

  const open = (n: Notif) => {
    markRead(n.id);
    onClose();
    setTimeout(() => {
      router.push({ pathname: "/site", params: { site: n.site } } as any);
    }, 220);
  };

  let idx = 0;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[s.backdrop, { opacity: anim }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.panel,
            {
              width: WIDTH,
              paddingTop: insets.top + 16,
              transform: [
                {
                  translateX: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [WIDTH, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* decoration */}
          <View style={s.glow} />
          <View style={s.ringA} />
          <View style={s.ringB} />

          {/* header */}
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Text style={s.eyebrow}>INBOX</Text>
              <Text style={s.title}>Notifications</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [s.close, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* summary + mark all */}
          <View style={s.summary}>
            <View style={s.newPill}>
              <View
                style={[
                  s.newDot,
                  unreadCount === 0 && { backgroundColor: "#5C5C60" },
                ]}
              />
              <Text style={s.newTxt}>
                {unreadCount > 0 ? `${unreadCount} new` : "All caught up"}
              </Text>
            </View>

            {unreadCount > 0 && (
              <Pressable
                onPress={markAllRead}
                hitSlop={8}
                style={({ pressed }) => [
                  s.markAll,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="checkmark-done" size={16} color={GOLD} />
                <Text style={s.markTxt}>Mark all read</Text>
              </Pressable>
            )}
          </View>

          {/* tabs */}
          <View style={s.seg}>
            {(
              [
                ["all", "All", notifications.length],
                ["unread", "Unread", unreadCount],
              ] as const
            ).map(([k, label, count]) => (
              <Pressable
                key={k}
                onPress={() => setFilter(k)}
                style={[s.segBtn, filter === k && s.segOn]}
              >
                <Text style={[s.segTxt, filter === k && s.segTxtOn]}>
                  {label}
                </Text>
                <View style={[s.segCount, filter === k && s.segCountOn]}>
                  <Text
                    style={[s.segCountTxt, filter === k && { color: C.dark }]}
                  >
                    {count}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* list */}
          <ScrollView
            key={`${openKey}-${filter}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: 6,
              paddingBottom: insets.bottom + 28,
            }}
          >
            {groups.length === 0 ? (
              <View style={s.empty}>
                <View style={s.emptyRing}>
                  <Ionicons
                    name="notifications-off-outline"
                    size={30}
                    color={GOLD}
                  />
                </View>
                <Text style={s.emptyTitle}>
                  {filter === "unread" ? "You're all caught up" : "Nothing yet"}
                </Text>
                <Text style={s.emptySub}>
                  {filter === "unread"
                    ? "No unread notifications right now."
                    : "New surveys and low score alerts will show up here."}
                </Text>
              </View>
            ) : (
              groups.map(({ g, items }) => (
                <View key={g}>
                  <View style={s.groupHead}>
                    <View style={s.groupBar} />
                    <Text style={s.groupTxt}>{g}</Text>
                    <Text style={s.groupCount}>{items.length}</Text>
                  </View>
                  <View style={{ gap: 10, marginBottom: 14 }}>
                    {items.map((n) => (
                      <NotifCard
                        key={n.id}
                        n={n}
                        i={idx++}
                        unread={isUnread(n)}
                        onPress={() => open(n)}
                      />
                    ))}
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

/* ---------------- styles ---------------- */
const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: C.dark,
    borderTopLeftRadius: 36,
    borderBottomLeftRadius: 36,
    borderLeftWidth: 1,
    borderColor: "rgba(249,162,30,0.3)",
    overflow: "hidden",
    elevation: 30,
  },
  glow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: C.orange,
    opacity: 0.13,
    top: -130,
    left: -110,
  },
  ringA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.14)",
    top: -100,
    left: -90,
  },
  ringB: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.14)",
    top: -45,
    left: -40,
  },

  head: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
  },
  eyebrow: {
    color: "#8E8E93",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
    marginTop: 3,
  },
  close: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    marginTop: 18,
  },
  newPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "rgba(249,162,30,0.14)",
  },
  newDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.orange,
  },
  newTxt: { color: C.orange, fontSize: 12, fontWeight: "800" },
  markAll: { flexDirection: "row", alignItems: "center", gap: 6 },
  markTxt: { color: GOLD, fontSize: 12.5, fontWeight: "800" },

  seg: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 3,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
  },
  segBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 13,
  },
  segOn: { backgroundColor: C.orange },
  segTxt: { color: "#8E8E93", fontSize: 12.5, fontWeight: "800" },
  segTxtOn: { color: C.dark },
  segCount: {
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  segCountOn: { backgroundColor: "rgba(22,21,19,0.15)" },
  segCountTxt: { color: "#B8B5AE", fontSize: 10.5, fontWeight: "800" },

  groupHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 10,
  },
  groupBar: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: C.orange,
  },
  groupTxt: {
    flex: 1,
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 2.6,
  },
  groupCount: { color: "#6E6E73", fontSize: 11, fontWeight: "800" },

  card: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderColor: "rgba(249,162,30,0.3)",
  },
  accent: {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  iconTile: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: {
    flex: 1,
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cardBody: {
    color: "#A1A1A6",
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: "500",
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 9,
  },
  meta: { color: "#6E6E73", fontSize: 11, fontWeight: "600", flexShrink: 1 },
  sep: { color: "#4A4A4E", fontSize: 8 },
  scorePill: {
    marginLeft: "auto",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  scoreTxt: { fontSize: 11, fontWeight: "800" },

  empty: { alignItems: "center", paddingTop: 70, gap: 8 },
  emptyRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.4)",
    backgroundColor: "rgba(249,162,30,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emptyTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  emptySub: {
    color: "#8E8E93",
    fontSize: 12.5,
    textAlign: "center",
    paddingHorizontal: 30,
    lineHeight: 18,
  },
});

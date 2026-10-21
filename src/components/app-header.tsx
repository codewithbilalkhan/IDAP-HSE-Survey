import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FIELDS, getField } from "@/constants/fields";
import { C } from "@/constants/theme";
import type { Profile } from "@/hooks/useProfile";
import { useLastSurvey } from "@/lib/last-survey";
import { getCache } from "@/lib/survey-cache";

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
const DAY = 86400000;

// Last known profile, shared by every header instance so screens
// don't flash "Welcome" while the profile reloads.
let cachedProfile: Profile | null = null;

// Call this on sign out so the next user doesn't see the old name.
export function clearHeaderProfile() {
  cachedProfile = null;
}

const fmtDate = (d: Date) =>
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

const latestFrom = (items: any[] | null | undefined): Date | null => {
  let best: Date | null = null;
  for (const it of items ?? []) {
    const raw = getField(it, FIELDS.submissionDate) || it?._created;
    const d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime()) && (!best || d > best)) best = d;
  }
  return best;
};

export function AppHeader({
  profile: profileProp,
  onMenuPress,
  lastSurvey: lastSurveyProp = null,
}: {
  profile: Profile | null;
  onMenuPress: () => void;
  lastSurvey?: Date | null;
}) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());

  // remember the latest real profile, fall back to it while a new screen loads
  if (profileProp) cachedProfile = profileProp;
  const profile = profileProp ?? cachedProfile;

  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1800,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

  const shared = useLastSurvey();
  const lastSurvey = lastSurveyProp ?? shared ?? latestFrom(getCache());
  const name = profile?.name || "Welcome";
  const h = now.getHours();
  const greet =
    h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const date = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View style={[s.wrap, { paddingTop: insets.top + 12 }]}>
      <View style={s.glowA} />
      <View style={s.glowB} />

      <View style={s.row}>
        <Pressable onPress={onMenuPress} hitSlop={12} style={s.menu}>
          <View style={s.bar} />
          <View style={[s.bar, { width: 11, backgroundColor: C.orange }]} />
        </Pressable>

        <View style={s.logoBox}>
          <Image
            source={require("@/assets/images/idap_building_only_logo.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </View>

        <View style={s.brandWrap}>
          <View style={s.brandDot} />
          <Text style={s.brand}>HSE</Text>
        </View>

        <View style={s.ring}>
          {profile?.photo ? (
            <Image source={{ uri: profile.photo }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.fallback]}>
              <Text style={s.fallbackText}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.textBlock}>
        <Text style={s.greet}>{greet}</Text>

        <View style={[s.nameRow, !!lastSurvey && { paddingRight: 140 }]}>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <View style={s.datePill}>
          <Text style={s.date}>{date}</Text>
        </View>

        {lastSurvey && (
          <View style={[s.chip, s.chipAbs]}>
            <View style={s.chipTop}>
              <View style={s.liveWrap}>
                <Animated.View
                  style={[
                    s.liveHalo,
                    {
                      opacity: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.55, 0],
                      }),
                      transform: [
                        {
                          scale: pulse.interpolate({
                            inputRange: [0, 1],
                            outputRange: [1, 2.8],
                          }),
                        },
                      ],
                    },
                  ]}
                />
                <View style={s.liveDot} />
              </View>
              <Text style={s.chipEyebrow}>LAST SURVEY</Text>
            </View>
            <Text style={s.chipDate}>{fmtDate(lastSurvey)}</Text>
            <Text style={s.chipAgo}>{ago(lastSurvey)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: C.dark,
    paddingHorizontal: 24,
    paddingBottom: 72,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  glowA: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: C.orange,
    opacity: 0.16,
    top: -170,
    right: -110,
  },
  glowB: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: C.gray,
    opacity: 0.12,
    bottom: -120,
    left: -70,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menu: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    paddingLeft: 12,
    gap: 5,
  },
  bar: { width: 18, height: 2, borderRadius: 1, backgroundColor: "#fff" },
  brandWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange },
  brand: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 6,
  },
  ring: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: C.orange,
    padding: 2,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 19 },
  fallback: {
    backgroundColor: C.darkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { color: C.orange, fontWeight: "800", fontSize: 16 },

  textBlock: { marginTop: 30 },
  greet: { color: C.grayLight, fontSize: 14 },

  nameRow: {
    marginTop: 0,
  },
  name: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.7,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: "rgba(249,162,30,0.10)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.35)",
    alignItems: "flex-end",
  },
  chipAbs: {
    position: "absolute",
    right: 0,
    top: 0,
  },
  chipTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  liveWrap: {
    width: 8,
    height: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  liveHalo: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.orange,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange },
  chipEyebrow: {
    color: C.grayLight,
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.8,
  },
  chipDate: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginTop: 5,
  },
  chipAgo: {
    color: C.orange,
    fontSize: 10.5,
    fontWeight: "700",
    marginTop: 1,
  },

  datePill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(249,162,30,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 12,
  },
  date: { color: C.orange, fontSize: 12, fontWeight: "600" },

  logoBox: {
    position: "absolute",
    left: 52,
    top: 0,
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 35, height: 35 },
});

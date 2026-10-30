import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationBell } from "@/components/notification-bell";
import { NotificationsPanel } from "@/components/notifications-panel";
import { ProfileSheet } from "@/components/profile-sheet";
// ⚠️ apni side drawer file ka sahi path/naam likhein
import { clearDrawerProfile } from "@/components/side-drawer";
import { FIELDS, getField } from "@/constants/fields";
import { C } from "@/constants/theme";
import { signOut } from "@/hooks/useMicrosoftAuth";
import type { Profile } from "@/hooks/useProfile";
import { useLastSurvey } from "@/lib/last-survey";
import { useNotifications } from "@/lib/notifications";
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

// Health Safety Environment: pehla harf gold + glow, baqi halka
const BRAND = [
  { init: "H", rest: "EALTH" },
  { init: "S", rest: "AFETY" },
  { init: "E", rest: "NVIRONMENT" },
];

// Last known profile, shared by every header instance so screens
// don't flash "Welcome" while the profile reloads.
let cachedProfile: Profile | null = null;

// Brand reveal animation sirf app ke pehle header par chalti hai,
// har screen par dobara nahi.
let introPlayed = false;

// Call this on sign out so the next user doesn't see the old name.
export function clearHeaderProfile() {
  cachedProfile = null;
}

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

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
  items = null,
}: {
  profile: Profile | null;
  onMenuPress: () => void;
  lastSurvey?: Date | null;
  items?: any[] | null;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [now, setNow] = useState(new Date());
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { list: notifs, unread } = useNotifications(items);

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

  // brand lines: staggered slide-in (sirf pehli baar)
  const played = useRef(introPlayed);
  const reveal = useRef(
    BRAND.map(() => new Animated.Value(played.current ? 1 : 0)),
  ).current;
  useEffect(() => {
    if (played.current) return;
    introPlayed = true;
    Animated.stagger(
      130,
      reveal.map((v) =>
        Animated.timing(v, {
          toValue: 1,
          duration: 560,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [reveal]);

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
        <View style={s.left}>
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

          {/* brand par tap karne se home (index) page khulta hai */}
          <Pressable
            onPress={() => router.navigate("/" as any)}
            hitSlop={8}
            style={({ pressed }) => [s.brandWrap, pressed && { opacity: 0.7 }]}
          >
            <View style={s.brandDivider} />
            <View>
              {BRAND.map((b, i) => (
                <Animated.View
                  key={b.init}
                  style={[
                    s.brandLine,
                    {
                      opacity: reveal[i],
                      transform: [
                        {
                          translateX: reveal[i].interpolate({
                            inputRange: [0, 1],
                            outputRange: [-14, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={s.brandInit}>{b.init}</Text>
                  <Text style={s.brandRest}>{b.rest}</Text>
                </Animated.View>
              ))}
            </View>
          </Pressable>
        </View>

        <View style={s.right}>
          <NotificationBell count={unread} onPress={() => setNotifOpen(true)} />

          <Pressable
            onPress={() => setProfileOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [
              s.ring,
              pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
            ]}
          >
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.fallback]}>
                <Text style={s.fallbackText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={s.onlineDot} />
          </Pressable>
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
          </View>
        )}
      </View>

      <NotificationsPanel
        visible={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifs}
      />

      <ProfileSheet
        visible={profileOpen}
        onClose={() => setProfileOpen(false)}
        profile={profile}
        onSignOut={() => {
          clearHeaderProfile();
          clearDrawerProfile();
          signOut();
        }}
      />
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
  left: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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

  brandWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginLeft: 4,
  },
  brandDivider: {
    width: 2,
    height: 34,
    borderRadius: 1,
    backgroundColor: C.orange,
    opacity: 0.85,
  },
  brandLine: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  brandInit: {
    color: C.orange,
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 14,
    letterSpacing: 0.5,
    textShadowColor: "rgba(249,162,30,0.75)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  brandRest: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 9,
    fontWeight: "700",
    lineHeight: 14,
    letterSpacing: 2,
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
  onlineDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2ecc71",
    borderWidth: 2,
    borderColor: C.dark,
  },
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

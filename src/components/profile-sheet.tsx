import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/theme";
import type { Profile } from "@/hooks/useProfile";

const SCREEN_H = Dimensions.get("window").height;

type Row = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  route?: string;
};

// Apne routes yahan change kar lein
const ROWS: Row[] = [
  {
    key: "profile",
    icon: "person-outline",
    label: "My Profile",
    sub: "View & edit your details",
    route: "/profile",
  },
  {
    key: "settings",
    icon: "settings-outline",
    label: "Settings",
    sub: "Preferences & security",
    route: "/settings",
  },
  {
    key: "help",
    icon: "help-circle-outline",
    label: "Help & Support",
    sub: "FAQs and contact",
    route: "/help",
  },
];

export function ProfileSheet({
  visible,
  onClose,
  profile,
  stats,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  /** optional quick stats, e.g. [{ label: "Surveys", value: 28 }] */
  stats?: { label: string; value: string | number }[];
  onSignOut?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [mounted, setMounted] = useState(visible);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // open / close animation
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // drag down to dismiss
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) {
            translateY.setValue(g.dy);
            backdrop.setValue(Math.max(0, 1 - g.dy / 400));
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            closeRef.current();
          } else {
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                damping: 20,
                stiffness: 220,
                useNativeDriver: true,
              }),
              Animated.timing(backdrop, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [translateY, backdrop],
  );

  const name = profile?.name || "Welcome";
  const email = (profile as any)?.email as string | undefined;
  const role = (profile as any)?.role as string | undefined;

  const go = (route?: string) => {
    if (!route) return;
    onClose();
    setTimeout(() => router.push(route as any), 260);
  };

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            {
              paddingBottom: insets.bottom + 18,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={s.glow} />

          {/* drag area */}
          <View {...pan.panHandlers} style={s.dragArea}>
            <View style={s.handle} />
          </View>

          {/* identity */}
          <View style={s.identity}>
            <View style={s.ring}>
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
            </View>

            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
            {!!email && (
              <Text style={s.email} numberOfLines={1}>
                {email}
              </Text>
            )}
            {!!role && (
              <View style={s.roleChip}>
                <Text style={s.roleText}>{role}</Text>
              </View>
            )}
          </View>

          {/* stats */}
          {!!stats?.length && (
            <View style={s.statsRow}>
              {stats.map((st) => (
                <View key={st.label} style={s.stat}>
                  <Text style={s.statValue}>{st.value}</Text>
                  <Text style={s.statLabel}>{st.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* menu */}
          <View style={s.card}>
            {ROWS.map((r, i) => (
              <Pressable
                key={r.key}
                onPress={() => go(r.route)}
                android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                style={({ pressed }) => [
                  s.row,
                  i > 0 && s.rowBorder,
                  pressed && { backgroundColor: "rgba(255,255,255,0.05)" },
                ]}
              >
                <View style={s.iconBox}>
                  <Ionicons name={r.icon} size={19} color={C.orange} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowLabel}>{r.label}</Text>
                  {!!r.sub && <Text style={s.rowSub}>{r.sub}</Text>}
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="rgba(255,255,255,0.35)"
                />
              </Pressable>
            ))}
          </View>

          {/* sign out */}
          {!!onSignOut && (
            <Pressable
              onPress={() => {
                onClose();
                setTimeout(onSignOut, 260);
              }}
              style={({ pressed }) => [s.signOut, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="log-out-outline" size={19} color="#ff6b6b" />
              <Text style={s.signOutText}>Sign out</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: C.dark,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.orange,
    opacity: 0.13,
    top: -170,
    alignSelf: "center",
  },
  dragArea: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },

  identity: { alignItems: "center", marginBottom: 20 },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: C.orange,
    padding: 3,
    shadowColor: C.orange,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 45 },
  fallback: {
    backgroundColor: C.darkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { color: C.orange, fontWeight: "800", fontSize: 36 },
  onlineDot: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2ecc71",
    borderWidth: 3,
    borderColor: C.dark,
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginTop: 14,
  },
  email: { color: C.grayLight, fontSize: 13, marginTop: 3 },
  roleChip: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(249,162,30,0.14)",
  },
  roleText: { color: C.orange, fontSize: 12, fontWeight: "700" },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  stat: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  statValue: { color: "#fff", fontSize: 20, fontWeight: "800" },
  statLabel: { color: C.grayLight, fontSize: 11, marginTop: 2 },

  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(249,162,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  rowSub: { color: C.grayLight, fontSize: 12, marginTop: 1 },

  signOut: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.28)",
  },
  signOutText: { color: "#ff6b6b", fontSize: 15, fontWeight: "700" },
});

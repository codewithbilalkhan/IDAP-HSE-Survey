import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Profile } from "@/hooks/useProfile";

const ORANGE = "#F9A31F";
const INK = "#111111";
const WIDTH = Math.min(Dimensions.get("window").width * 0.8, 320);

type Item = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const ITEMS: Item[] = [
  { key: "home", label: "Dashboard", icon: "grid-outline" },
  { key: "new", label: "Project Sites", icon: "business-outline" },
  { key: "mine", label: "Information", icon: "information-circle-outline" },
  { key: "settings", label: "Monthly Analytics", icon: "stats-chart-outline" },
];
export function SideDrawer({
  open,
  onClose,
  profile,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const go = (key: string) => {
    onClose();
    if (key === "home") router.replace("/");
    if (key === "new") router.push("/projects" as any);
  };
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 260 : 200,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const name = profile?.name || "User";

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={open ? "box-none" : "none"}
    >
      <Animated.View style={[s.backdrop, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          s.panel,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 20,
            // hides the panel completely while closed (no edge shadow)
            opacity: anim.interpolate({
              inputRange: [0, 0.01, 1],
              outputRange: [0, 1, 1],
            }),
            transform: [
              {
                translateX: anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-WIDTH, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.glow} />

        <View style={s.profile}>
          <View style={s.ring}>
            {profile?.photo ? (
              <Image source={{ uri: profile.photo }} style={s.photo} />
            ) : (
              <View style={[s.photo, s.fallback]}>
                <Text style={s.fallbackText}>
                  {name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
          {!!profile?.email && (
            <Text style={s.email} numberOfLines={1}>
              {profile.email}
            </Text>
          )}
        </View>

        <View style={s.menu}>
          {ITEMS.map((it, i) => (
            <Pressable
              key={it.key}
              onPress={() => go(it.key)}
              style={({ pressed }) => [
                s.item,
                i === 0 && s.itemActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={s.iconBox}>
                <Ionicons
                  name={it.icon}
                  size={20}
                  color={i === 0 ? ORANGE : "#8E8E93"}
                />
              </View>
              <Text style={[s.label, i === 0 && { color: "#fff" }]}>
                {it.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => {
            onClose();
            onSignOut();
          }}
          style={({ pressed }) => [s.signOut, pressed && { opacity: 0.8 }]}
        >
          <Text style={s.signOutText}>Sign out</Text>
        </Pressable>
        <Text style={s.version}>IDAP HSE Survey v1.0.0</Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: WIDTH,
    backgroundColor: INK,
    borderTopRightRadius: 36,
    borderBottomRightRadius: 36,
    paddingHorizontal: 22,
    overflow: "hidden",
    elevation: 30,
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: ORANGE,
    opacity: 0.14,
    top: -100,
    right: -100,
  },
  profile: { marginBottom: 28 },
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: ORANGE,
    padding: 3,
    marginBottom: 14,
  },
  photo: { width: "100%", height: "100%", borderRadius: 34 },
  fallback: {
    backgroundColor: "rgba(249,163,31,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: { width: 24, alignItems: "center" },
  fallbackText: { color: ORANGE, fontSize: 28, fontWeight: "800" },
  name: { color: "#fff", fontSize: 22, fontWeight: "800" },
  email: { color: "#8E8E93", fontSize: 13, marginTop: 3 },

  menu: { gap: 6 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  itemActive: { backgroundColor: "rgba(249,163,31,0.14)" },
  icon: { color: "#8E8E93", fontSize: 18, width: 24, textAlign: "center" },
  label: { color: "#A1A1A6", fontSize: 16, fontWeight: "600" },

  signOut: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  signOutText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  version: { color: "#555", fontSize: 11, textAlign: "center", marginTop: 14 },
});

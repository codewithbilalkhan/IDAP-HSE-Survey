import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/theme";
import type { Profile } from "@/hooks/useProfile";

export function AppHeader({
  profile,
  onMenuPress,
}: {
  profile: Profile | null;
  onMenuPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 20000);
    return () => clearInterval(id);
  }, []);

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
        <Text style={s.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={s.datePill}>
          <Text style={s.date}>{date}</Text>
        </View>
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
  name: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: 2,
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

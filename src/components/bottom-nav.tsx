import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/theme";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";

const TABS = [
  { label: "Dashboard", path: "/", on: "home", off: "grid-outline" },
  {
    label: "Projects",
    path: "/projects",
    on: "business",
    off: "business-outline",
  },
  {
    label: "Projects Info",
    path: "/project-info",
    on: "information-circle",
    off: "information-circle-outline",
  },
] as const;

// /site ek project ka detail hai, isliye Projects highlight rahe
const indexFor = (p: string) =>
  p.startsWith("/project-info")
    ? 2
    : p.startsWith("/projects") || p.startsWith("/site")
      ? 1
      : 0;

export const NAV_HEIGHT = 66;
// total space the floating nav takes from the bottom of the screen
export const navSpace = (bottomInset: number) =>
  Math.max(bottomInset, 10) + 6 + NAV_HEIGHT;

export function BottomNav() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken } = useMicrosoftAuth();

  const active = indexFor(pathname);
  const [barW, setBarW] = useState(0);
  const slide = useRef(new Animated.Value(active)).current;
  const scales = useRef(
    TABS.map((_, i) => new Animated.Value(i === active ? 1 : 0)),
  ).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: active,
      useNativeDriver: true,
      friction: 9,
      tension: 90,
    }).start();
    scales.forEach((v, i) =>
      Animated.spring(v, {
        toValue: i === active ? 1 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 120,
      }).start(),
    );
  }, [active, slide, scales]);

  if (!accessToken || pathname.startsWith("/auth")) return null;

  const PAD = 6;
  const tabW = barW > 0 ? (barW - PAD * 2) / TABS.length : 0;

  return (
    <>
      <View
        pointerEvents="none"
        style={[s.strip, { height: navSpace(insets.bottom) - NAV_HEIGHT / 2 }]}
      />
      <View
        pointerEvents="box-none"
        style={[s.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}
      >
        <View
          style={s.bar}
          onLayout={(e) => setBarW(e.nativeEvent.layout.width)}
        >
          <View style={s.glow} />

          {tabW > 0 && (
            <Animated.View
              style={[
                s.indicator,
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
            >
              <View style={s.indicatorLine} />
            </Animated.View>
          )}

          {TABS.map((t, i) => {
            const on = i === active;
            return (
              <Pressable
                key={t.path}
                onPress={() => {
                  if (!on || pathname !== t.path)
                    router.navigate(t.path as any);
                }}
                style={s.tab}
                hitSlop={6}
              >
                <Animated.View
                  style={{
                    alignItems: "center",
                    transform: [
                      {
                        translateY: scales[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -1],
                        }),
                      },
                      {
                        scale: scales[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.12],
                        }),
                      },
                    ],
                  }}
                >
                  <Ionicons
                    name={(on ? t.on : t.off) as any}
                    size={22}
                    color={on ? C.orange : "#8E8E93"}
                  />
                </Animated.View>
                <Text style={[s.label, on && s.labelOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  strip: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: C.bg,
  },
  wrap: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  bar: {
    height: NAV_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    borderRadius: 28,
    backgroundColor: "rgba(20,20,22,0.96)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.28)",
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
  },
  glow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.orange,
    opacity: 0.07,
    top: -110,
    right: -30,
  },
  indicator: {
    position: "absolute",
    top: 6,
    bottom: 6,
    left: 6,
    borderRadius: 22,
    backgroundColor: "rgba(249,162,30,0.14)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.35)",
    alignItems: "center",
  },
  indicatorLine: {
    width: 22,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: C.orange,
  },
  tab: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  label: {
    color: "#8E8E93",
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  labelOn: { color: C.orange, fontWeight: "800" },
});

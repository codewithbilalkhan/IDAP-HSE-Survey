// components/notification-bell.tsx
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { C } from "@/constants/theme";

export function NotificationBell({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const has = count > 0;
  const wiggle = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(has ? 1 : 0)).current;

  // badge pop-in / pop-out
  useEffect(() => {
    Animated.spring(pop, {
      toValue: has ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
      tension: 140,
    }).start();
  }, [has, pop]);

  // bell ring + badge pulse (sirf jab unread ho)
  useEffect(() => {
    if (!has) return;
    const ring = Animated.loop(
      Animated.sequence([
        Animated.delay(3200),
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: -1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(wiggle, {
          toValue: 0,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
    );
    const pulse = Animated.loop(
      Animated.timing(halo, {
        toValue: 1,
        duration: 1800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    ring.start();
    pulse.start();
    return () => {
      ring.stop();
      pulse.stop();
      wiggle.setValue(0);
      halo.setValue(0);
    };
  }, [has, wiggle, halo]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        s.btn,
        has && s.btnOn,
        pressed && { transform: [{ scale: 0.93 }] },
      ]}
    >
      {has && <View style={s.glow} />}

      <Animated.View
        style={{
          transform: [
            {
              rotate: wiggle.interpolate({
                inputRange: [-1, 1],
                outputRange: ["-18deg", "18deg"],
              }),
            },
          ],
        }}
      >
        <Ionicons
          name={has ? "notifications" : "notifications-outline"}
          size={20}
          color={has ? C.orange : "#fff"}
        />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[s.badgeWrap, { opacity: pop, transform: [{ scale: pop }] }]}
      >
        <Animated.View
          style={[
            s.badgeHalo,
            {
              opacity: halo.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 0],
              }),
              transform: [
                {
                  scale: halo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.2],
                  }),
                },
              ],
            },
          ]}
        />
        <View style={s.badge}>
          <Text style={s.badgeText}>{count > 9 ? "9+" : count}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  btnOn: {
    backgroundColor: "rgba(249,162,30,0.14)",
    borderColor: "rgba(249,162,30,0.5)",
  },
  glow: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.orange,
    opacity: 0.22,
  },
  badgeWrap: {
    position: "absolute",
    top: -6,
    right: -6,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeHalo: {
    position: "absolute",
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: C.orange,
  },
  badge: {
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: C.orange,
    borderWidth: 2,
    borderColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: C.dark,
    fontSize: 9.5,
    fontWeight: "900",
    lineHeight: 12,
    includeFontPadding: false,
  },
});

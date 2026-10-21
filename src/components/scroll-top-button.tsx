import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

const GOLD = "#F9A21E";

export function ScrollTopButton({
  visible,
  onPress,
  bottom = 110,
}: {
  visible: boolean;
  onPress: () => void;
  bottom?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(v, {
      toValue: visible ? 1 : 0,
      duration: visible ? 260 : 180,
      easing: visible ? Easing.out(Easing.back(1.6)) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, v]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        s.wrap,
        {
          bottom,
          opacity: v,
          transform: [
            {
              translateY: v.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        hitSlop={10}
        style={({ pressed }) => [
          s.btn,
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
      >
        <Ionicons name="chevron-up" size={22} color={GOLD} />
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", right: 18 },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#111",
    borderWidth: 1.5,
    borderColor: "rgba(249,162,30,0.75)",
    alignItems: "center",
    justifyContent: "center",
    elevation: 10,
    shadowColor: GOLD,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});

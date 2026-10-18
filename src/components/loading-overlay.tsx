import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const ORANGE = "#F9A21E";
const GRAY = "#D0D0D0";

export function LoadingOverlay({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const p = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const b = Animated.loop(
      Animated.timing(bar, {
        toValue: 1,
        duration: 1300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    p.start();
    b.start();
    return () => {
      p.stop();
      b.stop();
    };
  }, [pulse, bar]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(fade, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fade, {
        toValue: 0,
        duration: 450,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, fade]);

  if (!mounted) return null;

  return (
    <Animated.View style={[s.wrap, { opacity: fade }]} pointerEvents="auto">
      <View style={s.circleA} />
      <View style={s.circleB} />

      <Animated.View
        style={{
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.75, 1],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1.03],
              }),
            },
          ],
        }}
      >
        <Image
          source={require("../../assets/images/idaplogo.png")}
          style={s.logo}
          resizeMode="contain"
        />
      </Animated.View>

      <View style={s.track}>
        <Animated.View
          style={[
            s.fill,
            {
              transform: [
                {
                  translateX: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-60, 120],
                  }),
                },
              ],
            },
          ]}
        />
      </View>

      <Text style={s.title}>Loading your dashboard</Text>
      <Text style={s.sub}>Fetching latest survey data</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#F5F3EF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 50,
  },
  circleA: {
    position: "absolute",
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: ORANGE,
    opacity: 0.1,
    top: -150,
    right: -130,
  },
  circleB: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: GRAY,
    opacity: 0.25,
    bottom: -120,
    left: -110,
  },
  logo: { width: 150, height: 180 },
  track: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    marginTop: 26,
  },
  fill: {
    width: 60,
    height: "100%",
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  title: {
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 20,
    letterSpacing: -0.2,
  },
  sub: { color: "#8E8E93", fontSize: 12, marginTop: 4 },
});

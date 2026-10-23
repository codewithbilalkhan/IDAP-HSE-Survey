import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const ORANGE = "#F9A31F";
const GRAY = "#D0D0D0";

export function AnimatedSplash({ children }: { children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  const logo = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const overlay = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});

    Animated.sequence([
      Animated.parallel([
        Animated.timing(logo, {
          toValue: 1,
          duration: 800,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(text, {
          toValue: 1,
          duration: 900,
          delay: 250,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bar, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ]),
      Animated.delay(150),
      Animated.timing(overlay, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start(() => setDone(true));
  }, [logo, text, bar, overlay]);

  return (
    <View style={{ flex: 1 }}>
      {children}

      {!done && (
        <Animated.View style={[styles.splash, { opacity: overlay }]}>
          <Image
            source={require("@/assets/images/splash-bg.png")}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />

          <Animated.View
            style={{
              opacity: logo,
              transform: [
                {
                  scale: logo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
                {
                  translateY: logo.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            }}
          >
            <Image
              source={require("@/assets/images/idaplogo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View
            style={{
              opacity: text,
              alignItems: "center",
              marginTop: 8,
              transform: [
                {
                  translateY: text.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            <Text style={styles.title}>HSE SURVEY</Text>
            <Text style={styles.subtitle}>HEALTH / SAFETY / ENVIRONMENT</Text>
          </Animated.View>

          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFF9EF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  circleA: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: ORANGE,
    opacity: 0.1,
    top: -150,
    right: -140,
  },
  circleB: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: GRAY,
    opacity: 0.3,
    bottom: -140,
    left: -120,
  },
  logo: { width: 190, height: 230 },
  title: {
    color: "#1A1A1A",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 6,
  },
  subtitle: {
    color: "#9A9A9A",
    fontSize: 10,
    marginTop: 8,
    letterSpacing: 2.5,
  },
  track: {
    position: "absolute",
    bottom: 80,
    width: 120,
    height: 3,
    borderRadius: 2,
    backgroundColor: GRAY,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: ORANGE, borderRadius: 2 },
});

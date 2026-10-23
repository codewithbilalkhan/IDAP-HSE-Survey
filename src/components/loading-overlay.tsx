import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

const ORANGE = "#F9A21E";

// Health Safety Environment
const PILLARS = [
  { k: "H", label: "HEALTH" },
  { k: "S", label: "SAFETY" },
  { k: "E", label: "ENVIRONMENT" },
];

export function LoadingOverlay({ visible }: { visible: boolean }) {
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const eyebrow = useRef(new Animated.Value(0)).current;
  const reveal = useRef(PILLARS.map(() => new Animated.Value(0))).current;

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

      // H / S / E tiles: ek ek karke pop-in
      eyebrow.setValue(0);
      reveal.forEach((v) => v.setValue(0));
      Animated.parallel([
        Animated.timing(eyebrow, {
          toValue: 1,
          duration: 600,
          delay: 150,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.stagger(
          160,
          reveal.map((v) =>
            Animated.timing(v, {
              toValue: 1,
              duration: 650,
              delay: 250,
              easing: Easing.out(Easing.back(1.6)),
              useNativeDriver: true,
            }),
          ),
        ),
      ]).start();
    } else {
      Animated.timing(fade, {
        toValue: 0,
        duration: 450,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [visible, fade, eyebrow, reveal]);

  if (!mounted) return null;

  return (
    <Animated.View style={[s.wrap, { opacity: fade }]} pointerEvents="auto">
      {/* same background as the splash screen */}
      <Image
        source={require("@/assets/images/splash-bg.png")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />

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

      {/* HSE brand block */}
      <Animated.View style={[s.eyebrowRow, { opacity: eyebrow }]}>
        <View style={s.eyebrowLine} />
        <Text style={s.eyebrow}>HSE SURVEY</Text>
        <View style={s.eyebrowLine} />
      </Animated.View>

      <View style={s.pillars}>
        {PILLARS.map((p, i) => (
          <Animated.View
            key={p.k}
            style={[
              s.pillar,
              {
                opacity: reveal[i],
                transform: [
                  {
                    translateY: reveal[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [24, 0],
                    }),
                  },
                  {
                    scale: reveal[i].interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={s.tileWrap}>
              <Animated.View
                style={[
                  s.halo,
                  {
                    opacity: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.12, 0.45],
                    }),
                    transform: [
                      {
                        scale: pulse.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.22],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <View style={s.tile}>
                <View style={s.tileShine} />
                <Text style={s.tileLetter}>{p.k}</Text>
              </View>
            </View>
            <Text style={s.pillarLabel}>{p.label}</Text>
          </Animated.View>
        ))}
      </View>

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
    backgroundColor: "#FFF9EF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 50,
  },
  logo: { width: 150, height: 180 },

  /* HSE */
  eyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  eyebrowLine: {
    width: 28,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: ORANGE,
    opacity: 0.8,
  },
  eyebrow: {
    color: "#1A1A1A",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 4,
  },
  pillars: { flexDirection: "row", gap: 6, marginTop: 16 },
  pillar: { width: 92, alignItems: "center" },
  tileWrap: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: ORANGE,
  },
  tile: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#141416",
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    elevation: 8,
    shadowColor: ORANGE,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  tileShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  tileLetter: {
    color: ORANGE,
    fontSize: 30,
    fontWeight: "900",
    textShadowColor: "rgba(249,162,30,0.8)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  pillarLabel: {
    marginTop: 9,
    color: "#2A2A2C",
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 1.6,
  },

  track: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    marginTop: 28,
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

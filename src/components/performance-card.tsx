import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";

import { C, shadow } from "@/constants/theme";

type Item = { status: string; count: number };

const COLORS: Record<string, string> = {
  Excellent: C.orange,
  Good: C.gray,
  Fair: "#FCCB7E",
  Poor: C.red,
  "Very Poor": "#8E1F24",
};

const SIZE = 144;
const STROKE = 18;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP = 3;
const HUB = 76;

function statusAt(x: number, y: number, data: Item[]): string | null {
  const dx = x - SIZE / 2;
  const dy = y - SIZE / 2;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // sirf ring ke upar tap hone par (hub ya bahar nahi)
  if (dist < R - STROKE / 2 - 6 || dist > R + STROKE / 2 + 8) return null;

  // 12 baje se clockwise angle, 0..100
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  if (deg < 0) deg += 360;
  const pct = (deg / 360) * 100;

  let acc = 0;
  for (const d of data) {
    if (d.count <= 0) continue;
    acc += d.count;
    if (pct <= acc) return d.status;
  }
  return null;
}

export function PerformanceCard({
  data,
  total,
  onSelect,
}: {
  data: Item[];
  total: number;
  onSelect: (status: string) => void;
}) {
  const enter = useRef(new Animated.Value(0)).current;
  const prog = useRef(new Animated.Value(0)).current;
  const [p, setP] = useState(0);

  useEffect(() => {
    const id = prog.addListener(({ value }) => setP(value));
    Animated.timing(enter, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    return () => prog.removeListener(id);
  }, [enter, prog]);

  // data aane par (ya badalne par) chart dobara animate hota hai
  const sig = data.map((d) => d.count).join(",");
  useEffect(() => {
    prog.setValue(0);
    Animated.timing(prog, {
      toValue: 1,
      duration: 1100,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [sig, prog]);

  let acc = 0;
  const segs = data.map((d) => {
    const len = (d.count / 100) * CIRC;
    const seg = { ...d, len, start: acc };
    acc += len;
    return seg;
  });

  return (
    <Animated.View
      style={[
        s.card,
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={s.head}>
        <View style={s.headBar} />
        <Text style={s.title}>Overall Performances</Text>
        <Text style={s.hint}>Tap to filter</Text>
      </View>

      <View style={s.body}>
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={C.line}
              strokeWidth={STROKE}
              fill="none"
            />
            {segs.map((g) => {
              const shown = g.len * p - GAP;
              if (g.len <= 0 || shown <= 0) return null;
              return (
                <Circle
                  key={g.status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  stroke={COLORS[g.status] ?? C.gray}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={[shown, CIRC]}
                  rotation={-90 + (g.start / CIRC) * 360}
                  originX={SIZE / 2}
                  originY={SIZE / 2}
                />
              );
            })}
          </Svg>

          <View style={s.hub} pointerEvents="none">
            <Text style={s.hubNum}>{total}</Text>
            <Text style={s.hubLabel}>SITES</Text>
          </View>

          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              const st = statusAt(locationX, locationY, data);
              if (st) onSelect(st);
            }}
          />
        </View>

        <View style={s.legend}>
          {data.map((d) => {
            const color = COLORS[d.status] ?? C.gray;
            return (
              <Pressable
                key={d.status}
                onPress={() => onSelect(d.status)}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <View style={s.rowTop}>
                  <View style={s.rowLeft}>
                    <View style={[s.dot, { backgroundColor: color }]} />
                    <Text style={s.rowLabel}>{d.status}</Text>
                  </View>
                  <Text style={s.rowPct}>{Number(d.count.toFixed(1))}%</Text>
                </View>
                <View style={s.track}>
                  <View
                    style={{
                      width: `${Math.min(100, d.count * p)}%`,
                      height: "100%",
                      borderRadius: 3,
                      backgroundColor: color,
                    }}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    marginTop: 18,
    backgroundColor: C.card,
    borderRadius: 26,
    padding: 18,
    ...shadow,
  },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  headBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: C.orange,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: C.ink,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  hint: { color: C.grayLight, fontSize: 11, fontWeight: "600" },

  body: { flexDirection: "row", alignItems: "center", gap: 16 },
  hub: {
    position: "absolute",
    top: (SIZE - HUB) / 2,
    left: (SIZE - HUB) / 2,
    width: HUB,
    height: HUB,
    borderRadius: HUB / 2,
    backgroundColor: C.dark,
    alignItems: "center",
    justifyContent: "center",
  },
  hubNum: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  hubLabel: {
    color: C.orange,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 1,
  },

  legend: { flex: 1, gap: 10 },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  rowLabel: { color: C.ink, fontSize: 12, fontWeight: "600" },
  rowPct: { color: C.gray, fontSize: 12, fontWeight: "600" },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: C.line,
    overflow: "hidden",
  },
});

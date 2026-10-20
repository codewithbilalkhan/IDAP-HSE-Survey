import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { C, shadow } from "@/constants/theme";
const ICON = "#EC991B";
const ICON_BG = "#FDF2E0";

function CountUp({ value, style }: { value: number; style: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);
  const safe = Number.isFinite(value) ? value : 0;

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    Animated.timing(anim, {
      toValue: safe,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [safe, anim]);

  return <Text style={style}>{shown}</Text>;
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];

function Tile({
  label,
  value,
  icon,

  onPress,
}: {
  label: string;
  value: number;
  icon: IconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
    >
      <View style={[s.iconBox, { backgroundColor: ICON_BG }]}>
        <Ionicons name={icon} size={17} color={ICON} />
      </View>
      <CountUp value={value} style={s.num} />
      <Text style={s.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  sites: number;
  respondents: number;
  today: number;
  poor: number;
  onSites: () => void;
  onRespondents: () => void;
  onToday: () => void;
  onPoor: () => void;
};

export function KpiGrid(p: Props) {
  return (
    <View style={s.row}>
      <Tile
        label="Total Sites"
        value={p.sites}
        icon="business-outline"
        onPress={p.onSites}
      />
      <Tile
        label="Surveyors"
        value={p.respondents}
        icon="people"
        onPress={p.onRespondents}
      />
      <Tile
        label="Today"
        value={p.today}
        icon="calendar-outline"
        onPress={p.onToday}
      />
      <Tile
        label="Poor Sites"
        value={p.poor}
        icon="alert-circle"
        onPress={p.onPoor}
      />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: C.card,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    ...shadow,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  num: {
    color: C.ink,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  label: { color: C.gray, fontSize: 10, fontWeight: "600", marginTop: 1 },
});

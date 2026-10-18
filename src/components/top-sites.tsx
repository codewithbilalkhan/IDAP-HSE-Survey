import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { SITE_IMAGES } from "@/constants/site-images";
import { C, shadow } from "@/constants/theme";

export type TopSite = { site: string; avg: number; surveys: number };

const ORANGE = "#F9A21E";

function initials(name: string) {
  const w = name
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return ((w[0]?.[0] ?? "") + (w[1]?.[0] ?? "")).toUpperCase() || "S";
}

function Row({
  item,
  onPress,
  last,
}: {
  item: TopSite;
  onPress: () => void;
  last: boolean;
}) {
  const src = SITE_IMAGES[item.site];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        !last && s.rowLine,
        pressed && { opacity: 0.6 },
      ]}
    >
      {src ? (
        <Image source={src} style={s.photo} resizeMode="cover" />
      ) : (
        <View style={[s.photo, s.noPhoto]}>
          <Text style={s.mono}>{initials(item.site)}</Text>
        </View>
      )}

      <Text style={s.name} numberOfLines={2}>
        {item.site}
      </Text>

      <View style={s.pill}>
        <Text style={s.pillText}>{item.avg.toFixed(1)}</Text>
      </View>
      <Text style={s.chev}>›</Text>
    </Pressable>
  );
}

export function TopSites({
  data,
  onSelect,
  onViewAll,
}: {
  data: TopSite[];
  onSelect: (site: string) => void;
  onViewAll: () => void;
}) {
  if (data.length === 0) return null;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={s.headBar} />
        <Text style={s.title}>Top Performing Sites</Text>
        <Pressable onPress={onViewAll} hitSlop={10} style={s.viewAll}>
          <Text style={s.viewAllText}>View all</Text>
          <Text style={s.viewAllChev}>›</Text>
        </Pressable>
      </View>

      {data.map((it, i) => (
        <Row
          key={it.site}
          item={it}
          last={i === data.length - 1}
          onPress={() => onSelect(it.site)}
        />
      ))}
    </View>
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
  head: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  headBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: ORANGE,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: C.ink,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 3 },
  viewAllText: { color: ORANGE, fontSize: 12, fontWeight: "700" },
  viewAllChev: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: "700",
    marginTop: -2,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  rowLine: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  photo: {
    width: 56,
    height: 40,
    borderRadius: 9,
    backgroundColor: "#E9E6DF",
  },
  noPhoto: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#141416",
  },
  mono: { color: ORANGE, fontWeight: "800", fontSize: 14, letterSpacing: 1 },
  name: {
    flex: 1,
    color: C.ink,
    fontSize: 12.5,
    fontWeight: "700",
    lineHeight: 16,
  },
  pill: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 4,
    minWidth: 40,
    alignItems: "center",
  },
  pillText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  chev: { color: "#C8C5BE", fontSize: 22, marginLeft: -2 },
});

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const GOLD = "#F9A21E";

export function AccessDenied({
  email,
  onSignOut,
  onRetry,
}: {
  email?: string;
  onSignOut: () => void;
  onRetry: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        s.wrap,
        { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 30 },
      ]}
    >
      <View style={s.glow} />
      <View style={s.iconRing}>
        <Ionicons name="lock-closed" size={34} color={GOLD} />
      </View>
      <Text style={s.title}>Access restricted</Text>
      <Text style={s.sub}>
        Your account {email ? `(${email}) ` : ""}doesn't have permission to view
        the HSE Survey data.
      </Text>
      <Text style={s.hint}>
        Please contact your IT administrator to request access to the HSE Survey
        list on SharePoint.
      </Text>

      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [s.primary, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="refresh" size={16} color="#111" />
        <Text style={s.primaryText}>Try again</Text>
      </Pressable>
      <Pressable
        onPress={onSignOut}
        style={({ pressed }) => [s.ghost, pressed && { opacity: 0.8 }]}
      >
        <Text style={s.ghostText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    paddingHorizontal: 30,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: GOLD,
    opacity: 0.1,
    top: -170,
    right: -120,
  },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: "rgba(249,162,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 70,
  },
  title: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 26,
    letterSpacing: -0.5,
  },
  sub: {
    color: "#A1A1A6",
    fontSize: 14.5,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 12,
  },
  hint: {
    color: "#6E6E73",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 14,
  },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingHorizontal: 26,
    paddingVertical: 14,
    marginTop: 34,
  },
  primaryText: { color: "#111", fontSize: 14.5, fontWeight: "800" },
  ghost: { marginTop: 14, paddingVertical: 12 },
  ghostText: { color: "#8E8E93", fontSize: 14, fontWeight: "700" },
});

import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function Projects() {
  const { performance } = useLocalSearchParams<{ performance?: string }>();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F5F7",
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "Projects" }} />
      <Text style={{ fontSize: 16, color: "#6B6B6B" }}>
        Filter: {performance ?? "All"}
      </Text>
    </View>
  );
}

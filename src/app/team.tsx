import { Stack } from "expo-router";
import { Text, View } from "react-native";

export default function Team() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F5F5F7",
      }}
    >
      <Stack.Screen options={{ headerShown: true, title: "Team Info" }} />
      <Text style={{ fontSize: 16, color: "#6B6B6B" }}>Team Info screen</Text>
    </View>
  );
}

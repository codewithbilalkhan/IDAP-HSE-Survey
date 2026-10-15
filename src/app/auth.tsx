import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { completeSignIn } from "@/hooks/useMicrosoftAuth";

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        if (code) await completeSignIn(code);
      } catch (e) {
        console.error("Token exchange failed", e);
      } finally {
        WebBrowser.dismissBrowser();
        router.replace("/");
      }
    })();
  }, [code, router]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
      }}
    >
      <ActivityIndicator size="large" color="#F9A31F" />
    </View>
  );
}

import { AppHeader } from "@/components/app-header";
import { KpiGrid } from "@/components/kpi-grid";
import { LoadingOverlay } from "@/components/loading-overlay";
import { PerformanceCard } from "@/components/performance-card";
import { SideDrawer } from "@/components/side-drawer";
import { StaggerIn } from "@/components/stagger-in";
import { TopSites } from "@/components/top-sites";
import { FIELDS, getField } from "@/constants/fields";
import { C } from "@/constants/theme";
import { getSurveyItems } from "@/hooks/sharepoint";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
import { computeKpis } from "@/lib/hse-kpis";
import { getCache, setCache } from "@/lib/survey-cache";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function MicrosoftLogo() {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 2,
      }}
    >
      {["#F25022", "#7FBA00", "#00A4EF", "#FFB900"].map((c) => (
        <View key={c} style={{ width: 9, height: 9, backgroundColor: c }} />
      ))}
    </View>
  );
}

function isToday(value: any) {
  if (!value) return false;
  const d = new Date(value);
  if (isNaN(d.getTime())) return false;
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signIn, signOut, ready } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [firstLoaded, setFirstLoaded] = useState(false);

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 800,
      delay: 2300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  useEffect(() => {
    if (items[0]) {
      const f = { ...items[0], ...(items[0].fields ?? {}) };
      console.log("KEYS:", JSON.stringify(Object.keys(f)));
      console.log("SAMPLE:", JSON.stringify(f).slice(0, 1200));
    }
  }, [items]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      const data = await getSurveyItems(accessToken);
      setCache(data);
      setItems(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setFirstLoaded(true);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const cached = getCache();
    if (cached) {
      setItems(cached);
      setFirstLoaded(true);
    } else {
      load();
    }
  }, [accessToken, load]);

  const { sites, respondents, today, poor, breakdown, top } = useMemo(
    () => computeKpis(items, (i) => getField(i, FIELDS.projectSite)),
    [items],
  );

  if (!accessToken) {
    return (
      <View style={s.screen}>
        <StatusBar style="dark" />
        <View style={s.circleA} />
        <View style={s.circleB} />
        <Animated.View
          style={[
            s.top,
            {
              paddingTop: insets.top + 24,
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Image
            source={require("../../assets/images/idaplogo.png")}
            style={s.logo}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            {
              paddingBottom: insets.bottom + 28,
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [80, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={s.pill}>
            <View style={s.dot} />
            <Text style={s.pillText}>SECURE SIGN-IN</Text>
          </View>
          <Text style={s.heading}>Welcome{"\n"}back</Text>
          <Text style={s.sub}>
            Continue with your IDAP Microsoft account to view and submit HSE
            surveys.
          </Text>
          <Pressable
            onPress={() => signIn()}
            disabled={!ready}
            style={({ pressed }) => [
              s.cta,
              {
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: ready ? 1 : 0.6,
              },
            ]}
          >
            <View style={s.msIcon}>
              <MicrosoftLogo />
            </View>
            <Text style={s.ctaText}>Continue with Microsoft</Text>
          </Pressable>
          <Text style={s.footer}>Only idap.pk accounts are supported</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={s.home}>
      <StatusBar style="light" />

      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.orange}
          />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader profile={profile} onMenuPress={openMenu} />

        <View style={s.body}>
          <StaggerIn index={0} play={firstLoaded}>
            <KpiGrid
              sites={sites}
              respondents={respondents}
              today={today}
              poor={poor}
              onSites={() => router.push("/projects" as any)}
              onRespondents={() => router.push("/team" as any)}
              onToday={() =>
                router.push({
                  pathname: "/projects",
                  params: { filter: "today" },
                } as any)
              }
              onPoor={() =>
                router.push({
                  pathname: "/projects",
                  params: { performance: "Poor" },
                } as any)
              }
            />
          </StaggerIn>

          {!!error && <Text style={s.error}>{error}</Text>}

          <StaggerIn index={1} play={firstLoaded}>
            <PerformanceCard
              data={breakdown}
              total={sites}
              onSelect={(status) =>
                router.push({
                  pathname: "/projects",
                  params: { performance: status },
                } as any)
              }
            />
          </StaggerIn>

          <StaggerIn index={2} play={firstLoaded}>
            <TopSites
              data={top.slice(0, 5)}
              onViewAll={() => router.push("/projects" as any)}
              onSelect={(site) =>
                router.push({ pathname: "/site", params: { site } } as any)
              }
            />
          </StaggerIn>
        </View>
      </ScrollView>

      <SideDrawer
        open={menuOpen}
        onClose={closeMenu}
        profile={profile}
        onSignOut={signOut}
      />
      <LoadingOverlay visible={!firstLoaded} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, overflow: "hidden" },
  circleA: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: C.orange,
    opacity: 0.14,
    top: -150,
    right: -140,
  },
  circleB: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.gray,
    opacity: 0.1,
    top: 160,
    left: -140,
  },
  top: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 200, height: 240 },
  sheet: {
    backgroundColor: C.dark,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingHorizontal: 28,
    paddingTop: 32,
    elevation: 24,
  },
  pill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.5)",
    backgroundColor: "rgba(249,162,30,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.orange },
  pillText: {
    color: C.orange,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
  },
  heading: {
    color: "#FFFFFF",
    fontSize: 40,
    fontWeight: "800",
    lineHeight: 44,
    marginTop: 18,
    letterSpacing: -0.5,
  },
  sub: {
    color: C.grayLight,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    marginBottom: 28,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: C.orange,
    borderRadius: 18,
    paddingVertical: 17,
  },
  msIcon: { backgroundColor: "#fff", padding: 6, borderRadius: 8 },
  ctaText: { color: C.ink, fontSize: 16, fontWeight: "800" },
  footer: {
    textAlign: "center",
    color: C.gray,
    fontSize: 12,
    marginTop: 20,
  },

  home: { flex: 1, backgroundColor: C.bg },
  body: { paddingHorizontal: 20, marginTop: -48 },
  error: { color: C.red, paddingTop: 14 },
});

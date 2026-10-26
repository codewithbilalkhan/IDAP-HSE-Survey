import { AccessDenied } from "@/components/access-denied";
import { AppHeader } from "@/components/app-header";
import { BottomNav, navSpace } from "@/components/bottom-nav";
import { KpiGrid } from "@/components/kpi-grid";
import { LoadingOverlay } from "@/components/loading-overlay";
import { PerformanceCard } from "@/components/performance-card";
import { ScrollTopButton } from "@/components/scroll-top-button";
import { SideDrawer } from "@/components/side-drawer";
import { StaggerIn } from "@/components/stagger-in";
import { TopSites } from "@/components/top-sites";
import { FIELDS, getField } from "@/constants/fields";
import { C } from "@/constants/theme";
import { getSurveyItems } from "@/hooks/sharepoint";
import { useMicrosoftAuth } from "@/hooks/useMicrosoftAuth";
import { useProfile } from "@/hooks/useProfile";
import { computeKpis } from "@/lib/hse-kpis";
import { setLastSurvey } from "@/lib/last-survey";
import { getCache, setCache } from "@/lib/survey-cache";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  AppState,
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

// data ka signature: sirf tab update karo jab kuch badla ho
const sigOf = (d: any[]) =>
  d.length +
  "|" +
  d.map((x) => x?.["@odata.etag"] ?? x?.id ?? x?.fields?.id).join(",");

export default function Index() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { accessToken, signIn, signOut, ready, restoring } = useMicrosoftAuth();
  const profile = useProfile(accessToken);

  const [menuOpen, setMenuOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);
  const [firstLoaded, setFirstLoaded] = useState(false);

  const listRef = useRef<ScrollView>(null);
  const [showTop, setShowTop] = useState(false);
  const lastSig = useRef("");

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

  // pull-to-refresh aur pehli load (spinner ke saath)
  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError("");
    try {
      setDenied(false);
      const data = await getSurveyItems(accessToken);
      lastSig.current = sigOf(data);
      setCache(data);
      setItems(data);
    } catch (e: any) {
      if (e?.status === 403 || e?.status === 401 || e?.status === 404)
        setDenied(true);
      else setError(e.message);
    } finally {
      setLoading(false);
      setFirstLoaded(true);
    }
  }, [accessToken]);

  // silent auto-sync (spinner nahi, sirf naya data aaye to update)
  const sync = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await getSurveyItems(accessToken);
      const sig = sigOf(data);
      if (sig === lastSig.current) return;
      lastSig.current = sig;
      setCache(data);
      setItems(data);
    } catch {}
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      setItems([]);
      setDenied(false);
      setFirstLoaded(false);
      lastSig.current = "";
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const cached = getCache();
    if (cached) {
      setItems(cached);
      setFirstLoaded(true);
      lastSig.current = sigOf(cached);
      sync(); // cache dikha do, aur peeche se taaza data le aao
    } else {
      load();
    }
  }, [accessToken, load, sync]);

  useEffect(() => {
    if (!accessToken) return;
    const id = setInterval(sync, 60000); // har 60 second
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") sync(); // app wapas khulte hi
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [accessToken, sync]);

  const { sites, respondents, today, poor, breakdown, top } = useMemo(
    () => computeKpis(items, (i) => getField(i, FIELDS.projectSite)),
    [items],
  );

  const lastSurvey = useMemo(() => {
    let best: Date | null = null;
    for (const it of items) {
      const raw = getField(it, FIELDS.submissionDate) || it?._created;
      const d = raw ? new Date(raw) : null;
      if (d && !isNaN(d.getTime()) && (!best || d > best)) best = d;
    }
    return best;
  }, [items]);

  useEffect(() => {
    if (lastSurvey) setLastSurvey(lastSurvey);
  }, [lastSurvey]);

  if (restoring && !accessToken) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

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

  if (denied) {
    return (
      <AccessDenied email={profile?.email} onSignOut={signOut} onRetry={load} />
    );
  }

  return (
    <View style={s.home}>
      <StatusBar style="light" />

      <ScrollView
        ref={listRef}
        onScroll={(e) => {
          const show = e.nativeEvent.contentOffset.y > 150;
          setShowTop((p) => (p === show ? p : show));
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={load}
            tintColor={C.orange}
          />
        }
        contentContainerStyle={{ paddingBottom: navSpace(insets.bottom) + 20 }}
        showsVerticalScrollIndicator={false}
      >
        <AppHeader
          profile={profile}
          onMenuPress={openMenu}
          lastSurvey={lastSurvey}
          items={items}
        />

        <View style={s.body}>
          <StaggerIn index={0} play={firstLoaded}>
            <KpiGrid
              sites={sites}
              respondents={respondents}
              today={today}
              poor={poor}
              onSites={() => router.push("/projects" as any)}
              onRespondents={() => router.push("/team" as any)}
              onToday={() => router.push("/today" as any)}
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

      <ScrollTopButton
        visible={showTop}
        bottom={insets.bottom + 100}
        onPress={() => listRef.current?.scrollTo({ y: 0, animated: true })}
      />
      <BottomNav />
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

import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Easing,
    Image,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { Photo } from "@/lib/attachments";

const memo: Record<string, string> = {};

function useSecureImage(uri: string, token: string) {
  const [src, setSrc] = useState<string | null>(memo[uri] ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uri) return;
    if (memo[uri]) {
      setSrc(memo[uri]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await fetch(uri, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const data: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result as string);
          r.onerror = reject;
          r.readAsDataURL(blob);
        });
        memo[uri] = data;
        if (alive) setSrc(data);
      } catch (e) {
        console.log("IMG FAIL", uri, String(e));
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [uri, token]);

  return { src, failed };
}

const GOLD = "#F9A21E";
const W = Dimensions.get("window").width;
const GAP = 14;
const TILE = (W - 40 - GAP) / 2;

function Tile({
  p,
  i,
  token,
  onOpen,
}: {
  p: Photo;
  i: number;
  token: string;
  onOpen: () => void;
}) {
  const v = useRef(new Animated.Value(0)).current;
  const { src, failed } = useSecureImage(p.uri, token);
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 560,
      delay: 100 + i * 110,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, i]);

  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [34, 0],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.94, 1],
            }),
          },
        ],
      }}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [
          s.tile,
          pressed && { transform: [{ scale: 0.97 }] },
        ]}
      >
        {src ? (
          <Image source={{ uri: src }} style={s.tileImg} resizeMode="cover" />
        ) : (
          <View
            style={[
              s.tileImg,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            {failed ? (
              <Ionicons name="image-outline" size={26} color="#555" />
            ) : (
              <ActivityIndicator color={GOLD} />
            )}
          </View>
        )}
        <View style={s.tileShade} />
        <View style={s.expand}>
          <Ionicons name="expand-outline" size={14} color="#fff" />
        </View>
        <View style={s.datePill}>
          <View style={s.dot} />
          <Text style={s.dateText}>{p.date}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Viewer({
  photos,
  index,
  token,
  site,
  onChange,
  onClose,
}: {
  photos: Photo[];
  index: number | null;
  token: string;
  site: string;
  onChange: (i: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const v = useRef(new Animated.Value(0)).current;
  const dx = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState(0);

  const idx = index ?? last;
  const photo = photos[idx];
  const full = useSecureImage(photo?.uri ?? "", token);

  // agli aur pichli photo pehle se download
  useSecureImage(photos[idx + 1]?.uri ?? "", token);
  useSecureImage(photos[idx - 1]?.uri ?? "", token);

  useEffect(() => {
    if (index !== null) {
      setLast(index);
      setOpen(true);
      Animated.spring(v, {
        toValue: 1,
        friction: 8,
        tension: 70,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(v, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setOpen(false));
    }
  }, [index, v]);

  const stateRef = useRef({ idx, len: photos.length });
  stateRef.current = { idx, len: photos.length };

  const go = (dir: 1 | -1) => {
    const { idx: i, len } = stateRef.current;
    const n = i + dir;
    if (n < 0 || n >= len) {
      Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
      return;
    }
    Animated.timing(dx, {
      toValue: -dir * W,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      onChange(n);
      dx.setValue(dir * W);
      Animated.spring(dx, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }).start();
    });
  };

  const goRef = useRef(go);
  goRef.current = go;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => dx.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50 || g.vx < -0.5) goRef.current(1);
        else if (g.dx > 50 || g.vx > 0.5) goRef.current(-1);
        else Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dx, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!open || !photo) return null;

  const hasPrev = idx > 0;
  const hasNext = idx < photos.length - 1;

  return (
    <Modal
      transparent
      visible
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View {...pan.panHandlers} style={[s.backdrop, { opacity: v }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <Animated.View
          style={[
            s.frame,
            {
              transform: [
                { translateX: dx },
                {
                  scale: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.82, 1],
                  }),
                },
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {full.src ? (
            <Image
              source={{ uri: full.src }}
              style={s.full}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                s.full,
                { alignItems: "center", justifyContent: "center" },
              ]}
            >
              {full.failed ? (
                <Ionicons name="image-outline" size={30} color="#555" />
              ) : (
                <ActivityIndicator color={GOLD} />
              )}
            </View>
          )}
        </Animated.View>

        {hasPrev && (
          <Pressable
            onPress={() => go(-1)}
            hitSlop={10}
            style={[s.arrow, s.arrowL]}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </Pressable>
        )}
        {hasNext && (
          <Pressable
            onPress={() => go(1)}
            hitSlop={10}
            style={[s.arrow, s.arrowR]}
          >
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </Pressable>
        )}

        <View
          style={[s.counter, { top: insets.top + 22 }]}
          pointerEvents="none"
        >
          <Text style={s.counterText}>
            {idx + 1}{" "}
            <Text style={{ color: "#8E8E93" }}>/ {photos.length}</Text>
          </Text>
        </View>

        <Animated.View
          style={[
            s.caption,
            {
              bottom: insets.bottom + 34,
              opacity: v,
              transform: [
                {
                  translateY: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          <View style={s.capLine} />
          <Text style={s.capDate}>{photo.date}</Text>
          <Text style={s.capSite} numberOfLines={2}>
            {site}
          </Text>
        </Animated.View>

        <Pressable
          onPress={onClose}
          hitSlop={14}
          style={[s.close, { top: insets.top + 14 }]}
        >
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

export function AttachmentsGallery({
  photos,
  loading,
  error,
  token,
  site,
}: {
  photos: Photo[];
  loading: boolean;
  error: string;
  token: string;
  site: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [shown, setShown] = useState(8);

  if (loading) {
    return (
      <View style={s.state}>
        <ActivityIndicator color={GOLD} />
        <Text style={s.stateText}>Loading site photos...</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={s.state}>
        <Ionicons name="lock-closed-outline" size={28} color="#C5C2BB" />
        <Text style={s.stateTitle}>Could not load photos</Text>
        <Text style={s.stateText}>{error}</Text>
      </View>
    );
  }
  if (photos.length === 0) {
    return (
      <View style={s.state}>
        <Ionicons name="images-outline" size={30} color="#C5C2BB" />
        <Text style={s.stateTitle}>No attachments yet</Text>
        <Text style={s.stateText}>
          Photos from recent surveys will appear here.
        </Text>
      </View>
    );
  }

  return (
    <View>
      <View style={s.head}>
        <View style={s.headBar} />
        <Text style={s.title}>Site Gallery</Text>
        <Text style={s.count}>{photos.length} photos</Text>
      </View>

      <View style={s.grid}>
        {photos.slice(0, shown).map((p, i) => (
          <Tile
            key={p.uri}
            p={p}
            i={i % 8}
            token={token}
            onOpen={() => setOpen(i)}
          />
        ))}
      </View>

      {shown < photos.length && (
        <Pressable onPress={() => setShown((n) => n + 8)} style={s.more}>
          <Text style={s.moreText}>
            Load more ({photos.length - shown} left)
          </Text>
        </Pressable>
      )}

      <Viewer
        photos={photos}
        index={open}
        token={token}
        site={site}
        onChange={setOpen}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 14,
  },
  headBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginRight: 10,
  },
  title: {
    flex: 1,
    color: "#111",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  count: { color: "#A0A0A0", fontSize: 12, fontWeight: "800" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  tile: {
    width: TILE,
    height: TILE * 1.22,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#141416",
    borderWidth: 1.5,
    borderColor: "rgba(249,162,30,0.55)",
    elevation: 8,
    shadowColor: GOLD,
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  tileImg: { width: "100%", height: "100%" },
  tileShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  expand: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(10,10,10,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },

  arrow: {
    position: "absolute",
    top: "50%",
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(10,10,10,0.7)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowL: { left: 10 },
  arrowR: { right: 10 },
  counter: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: "rgba(10,10,10,0.7)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.5)",
  },
  counterText: {
    color: GOLD,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  more: {
    marginTop: 18,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.6)",
  },
  moreText: { color: GOLD, fontSize: 13, fontWeight: "800" },

  datePill: {
    position: "absolute",
    left: 10,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(10,10,10,0.7)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.5)",
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD },
  dateText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6,6,7,0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    width: W - 28,
    height: (W - 28) * 1.1,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(249,162,30,0.6)",
    backgroundColor: "#0C0C0D",
    elevation: 20,
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  full: { width: "100%", height: "100%" },
  close: {
    position: "absolute",
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(249,162,30,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  caption: { position: "absolute", left: 24, right: 24 },
  capLine: {
    width: 36,
    height: 3,
    borderRadius: 2,
    backgroundColor: GOLD,
    marginBottom: 12,
  },
  capDate: {
    color: GOLD,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  capSite: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },

  state: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 8,
  },
  stateTitle: { color: "#111", fontSize: 15, fontWeight: "700", marginTop: 4 },
  stateText: { color: "#8E8E93", fontSize: 12.5, textAlign: "center" },
});

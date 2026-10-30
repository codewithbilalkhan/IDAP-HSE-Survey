import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Image,
    Linking,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "@/constants/theme";
import type { Profile } from "@/hooks/useProfile";

const SCREEN_H = Dimensions.get("window").height;

type InfoRow = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  href?: string;
};

export function ProfileSheet({
  visible,
  onClose,
  profile,
  onSignOut,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSignOut?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // open / close animation
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SCREEN_H,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // drag down to dismiss
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) {
            translateY.setValue(g.dy);
            backdrop.setValue(Math.max(0, 1 - g.dy / 400));
          }
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 110 || g.vy > 0.9) {
            closeRef.current();
          } else {
            Animated.parallel([
              Animated.spring(translateY, {
                toValue: 0,
                damping: 20,
                stiffness: 220,
                useNativeDriver: true,
              }),
              Animated.timing(backdrop, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
              }),
            ]).start();
          }
        },
      }),
    [translateY, backdrop],
  );

  const name = profile?.name || "Welcome";

  const allRows: InfoRow[] = [
    {
      key: "email",
      icon: "mail-outline",
      label: "Email",
      value: profile?.email,
      href: profile?.email ? `mailto:${profile.email}` : undefined,
    },
    {
      key: "dept",
      icon: "briefcase-outline",
      label: "Department",
      value: profile?.department,
    },
    {
      key: "company",
      icon: "business-outline",
      label: "Company",
      value: profile?.company,
    },
    {
      key: "office",
      icon: "location-outline",
      label: "Office",
      value: profile?.office || profile?.location,
    },
    {
      key: "mobile",
      icon: "phone-portrait-outline",
      label: "Mobile",
      value: profile?.mobile,
      href: profile?.mobile ? `tel:${profile.mobile}` : undefined,
    },
    {
      key: "phone",
      icon: "call-outline",
      label: "Office phone",
      value: profile?.phone,
      href: profile?.phone ? `tel:${profile.phone}` : undefined,
    },
    {
      key: "empId",
      icon: "id-card-outline",
      label: "Employee ID",
      value: profile?.employeeId,
    },
    {
      key: "manager",
      icon: "people-outline",
      label: "Reports to",
      value: profile?.manager,
    },
  ];

  const rows = allRows.filter((r) => !!r.value);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Animated.View style={[s.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            s.sheet,
            {
              paddingBottom: insets.bottom + 18,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={s.glow} />

          {/* drag area */}
          <View {...pan.panHandlers} style={s.dragArea}>
            <View style={s.handle} />
          </View>

          {/* identity */}
          <View style={s.identity}>
            <View style={s.ring}>
              {profile?.photo ? (
                <Image source={{ uri: profile.photo }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.fallback]}>
                  <Text style={s.fallbackText}>
                    {name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.onlineDot} />
            </View>

            <Text style={s.name} numberOfLines={1}>
              {name}
            </Text>
            {!!profile?.jobTitle && (
              <View style={s.roleChip}>
                <Text style={s.roleText} numberOfLines={1}>
                  {profile.jobTitle}
                </Text>
              </View>
            )}
          </View>

          {/* info from Microsoft 365 */}
          {rows.length > 0 && (
            <ScrollView
              style={s.scroll}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={s.card}>
                {rows.map((r, i) => {
                  const body = (
                    <>
                      <View style={s.iconBox}>
                        <Ionicons name={r.icon} size={18} color={C.orange} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.rowLabel}>{r.label}</Text>
                        <Text style={s.rowValue} numberOfLines={1}>
                          {r.value}
                        </Text>
                      </View>
                      {!!r.href && (
                        <Ionicons
                          name="open-outline"
                          size={16}
                          color="rgba(255,255,255,0.3)"
                        />
                      )}
                    </>
                  );

                  return r.href ? (
                    <Pressable
                      key={r.key}
                      onPress={() => Linking.openURL(r.href!).catch(() => {})}
                      android_ripple={{ color: "rgba(255,255,255,0.06)" }}
                      style={({ pressed }) => [
                        s.row,
                        i > 0 && s.rowBorder,
                        pressed && {
                          backgroundColor: "rgba(255,255,255,0.05)",
                        },
                      ]}
                    >
                      {body}
                    </Pressable>
                  ) : (
                    <View key={r.key} style={[s.row, i > 0 && s.rowBorder]}>
                      {body}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* sign out: pehle confirm modal kholta hai */}
          {!!onSignOut && (
            <Pressable
              onPress={() => setConfirmOpen(true)}
              style={({ pressed }) => [s.signOut, pressed && { opacity: 0.75 }]}
            >
              <Ionicons name="log-out-outline" size={19} color="#ff6b6b" />
              <Text style={s.signOutText}>Sign out</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* sign out confirmation */}
        <Modal
          visible={confirmOpen}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setConfirmOpen(false)}
        >
          <View style={s.modalWrap}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setConfirmOpen(false)}
            />
            <View style={s.modalCard}>
              <View style={s.modalIcon}>
                <Ionicons name="log-out-outline" size={26} color={C.orange} />
              </View>
              <Text style={s.modalTitle}>Sign out?</Text>
              <Text style={s.modalSub}>Are you sure you want to sign out?</Text>

              <View style={s.modalBtns}>
                <Pressable
                  onPress={() => setConfirmOpen(false)}
                  style={({ pressed }) => [
                    s.btn,
                    s.btnCancel,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={s.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setConfirmOpen(false);
                    onClose();
                    setTimeout(() => onSignOut?.(), 260);
                  }}
                  style={({ pressed }) => [
                    s.btn,
                    s.btnYes,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={s.btnYesText}>Yes, sign out</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheet: {
    backgroundColor: C.dark,
    maxHeight: SCREEN_H * 0.9,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
    overflow: "hidden",
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: C.orange,
    opacity: 0.13,
    top: -170,
    alignSelf: "center",
  },
  dragArea: { alignItems: "center", paddingTop: 10, paddingBottom: 14 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.22)",
  },

  identity: { alignItems: "center", marginBottom: 20 },
  ring: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: C.orange,
    padding: 3,
    shadowColor: C.orange,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 45 },
  fallback: {
    backgroundColor: C.darkSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: { color: C.orange, fontWeight: "800", fontSize: 36 },
  onlineDot: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2ecc71",
    borderWidth: 3,
    borderColor: C.dark,
  },
  name: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginTop: 14,
  },
  roleChip: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "rgba(249,162,30,0.14)",
    maxWidth: "100%",
  },
  roleText: { color: C.orange, fontSize: 12, fontWeight: "700" },

  scroll: { flexGrow: 0, flexShrink: 1 },
  card: {
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(249,162,30,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: {
    color: C.grayLight,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  rowValue: { color: "#fff", fontSize: 14.5, fontWeight: "600", marginTop: 2 },

  signOut: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: "rgba(255,107,107,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.28)",
  },
  signOutText: { color: "#ff6b6b", fontSize: 15, fontWeight: "700" },

  /* confirm modal */
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  modalCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: C.dark,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(249,163,31,0.28)",
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(249,163,31,0.14)",
    borderWidth: 1,
    borderColor: "rgba(249,163,31,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  modalTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  modalSub: {
    color: "#8E8E93",
    fontSize: 14,
    textAlign: "center",
    marginTop: 6,
  },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 22 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  btnCancel: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  btnCancelText: { color: "#fff", fontWeight: "700", fontSize: 14.5 },
  btnYes: { backgroundColor: C.orange },
  btnYesText: { color: C.dark, fontWeight: "800", fontSize: 14.5 },
});

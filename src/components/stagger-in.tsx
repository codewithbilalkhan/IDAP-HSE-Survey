import { useEffect, useRef } from "react";
import { Animated, Easing } from "react-native";

export function StaggerIn({
  index,
  play,
  children,
}: {
  index: number;
  play: boolean;
  children: React.ReactNode;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!play) return;
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 350 + index * 140,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [play, index, v]);

  return (
    <Animated.View
      style={{
        opacity: v,
        transform: [
          {
            translateY: v.interpolate({
              inputRange: [0, 1],
              outputRange: [28, 0],
            }),
          },
          {
            scale: v.interpolate({
              inputRange: [0, 1],
              outputRange: [0.97, 1],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

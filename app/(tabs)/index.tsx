import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const SWIPE_COMMIT_THRESHOLD = 60;

// Ordered least-mowed to most-mowed, so swiping forward always shows more
// of the lawn getting cut — the whole point of the gesture-linked reveal.
const onboardingPages = [
  {
    title: "Welcome to HomeRun",
    subtitle:
      "HomeRun helps people get help with small jobs around the house while giving local workers an easy way to find nearby work.",
    icon: "home-outline" as const,
    image: require("../../assets/images/OpenGrass2.jpg"),
  },
  {
    title: "Post a Task",
    subtitle:
      "Need help with yard work, moving, cleaning, snow shoveling, or another home task? Post what you need, set a price, and choose a worker.",
    icon: "add-circle-outline" as const,
    image: require("../../assets/images/OpenGrass3.jpg"),
  },
  {
    title: "Find Nearby Work",
    subtitle:
      "Workers can browse nearby tasks, request jobs, complete work, and build a strong rating over time.",
    icon: "navigate-outline" as const,
    image: require("../../assets/images/OpenGrass4.jpg"),
  },
  {
    title: "Simple and Reliable",
    subtitle:
      "Customers pay upfront, workers get paid after completion, and both sides can rate each other to help keep the community reliable.",
    icon: "checkmark-circle-outline" as const,
    image: require("../../assets/images/OpenGrass1.jpg"),
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const [pageIndex, setPageIndex] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const contentFade = useRef(new Animated.Value(1)).current;
  const contentSlide = useRef(new Animated.Value(0)).current;
  const backgroundScale = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;

  const currentPage = onboardingPages[pageIndex];
  const isLastPage = pageIndex === onboardingPages.length - 1;

  // Slow continuous zoom on the settled (non-dragging) background photo —
  // restarts on every committed page change for a fresh, subtle Ken Burns
  // effect instead of a perfectly still image.
  useEffect(() => {
    backgroundScale.setValue(1);

    const zoom = Animated.loop(
      Animated.sequence([
        Animated.timing(backgroundScale, {
          toValue: 1.08,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(backgroundScale, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: true,
        }),
      ])
    );

    zoom.start();

    return () => zoom.stop();
  }, [pageIndex]);

  function goToPage(nextIndex: number, direction: "next" | "previous") {
    if (nextIndex < 0 || nextIndex >= onboardingPages.length) return;

    const slideOutValue = direction === "next" ? -width * 0.12 : width * 0.12;
    const slideInStartValue = direction === "next" ? width * 0.12 : -width * 0.12;

    Animated.parallel([
      Animated.timing(contentFade, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(contentSlide, {
        toValue: slideOutValue,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setPageIndex(nextIndex);
      contentSlide.setValue(slideInStartValue);

      Animated.parallel([
        Animated.timing(contentFade, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }

  function animateToNextPage() {
    goToPage(pageIndex + 1, "next");
  }

  function animateToPreviousPage() {
    goToPage(pageIndex - 1, "previous");
  }

  function handleDotPress(index: number) {
    if (index === pageIndex) return;
    goToPage(index, index > pageIndex ? "next" : "previous");
  }

  // Opacity of whichever neighbor photo is currently previewed, driven
  // directly by how far the finger has moved — this is what makes the
  // reveal feel tied to the swipe instead of a canned post-release fade.
  const previewOpacity = dragX.interpolate({
    inputRange: [-width, 0, width],
    outputRange: [1, 0, 1],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 20;
      },

      onPanResponderMove: (_, gestureState) => {
        dragX.setValue(gestureState.dx);

        const direction = gestureState.dx < 0 ? "next" : "previous";
        const neighbor = direction === "next" ? pageIndex + 1 : pageIndex - 1;
        const validNeighbor =
          neighbor >= 0 && neighbor < onboardingPages.length ? neighbor : null;

        setPreviewIndex((current) =>
          current !== validNeighbor ? validNeighbor : current
        );
      },

      onPanResponderRelease: (_, gestureState) => {
        const committed = Math.abs(gestureState.dx) > SWIPE_COMMIT_THRESHOLD;

        if (committed && previewIndex !== null) {
          goToPage(previewIndex, gestureState.dx < 0 ? "next" : "previous");
        }

        Animated.timing(dragX, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start(() => {
          setPreviewIndex(null);
        });
      },
    })
  ).current;

  return (
    <View style={styles.backgroundImage}>
      {/* Settled background — the current page's photo, with the idle zoom. */}
      <Animated.Image
        source={currentPage.image}
        style={[
          styles.backgroundLayer,
          { transform: [{ scale: backgroundScale }] },
        ]}
        resizeMode="cover"
      />

      {/* Swipe preview — the neighboring photo, revealed live as you drag.
          This is the "watch it get mowed as you swipe" effect. */}
      {previewIndex !== null && (
        <Animated.Image
          source={onboardingPages[previewIndex].image}
          style={[styles.backgroundLayer, { opacity: previewOpacity }]}
          resizeMode="cover"
        />
      )}

      <LinearGradient
        colors={["rgba(0,0,0,0.05)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.85)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
        <View style={styles.topRow}>
          <View style={styles.dotsRow}>
            {onboardingPages.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => handleDotPress(index)}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
                <View
                  style={[
                    styles.dot,
                    pageIndex === index && styles.dotActive,
                  ]}
                />
              </TouchableOpacity>
            ))}
          </View>

          {!isLastPage ? (
            <TouchableOpacity
              onPress={() => router.push("/start")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipPlaceholder} />
          )}
        </View>

        <Animated.View
          style={[
            styles.bottomContent,
            {
              opacity: contentFade,
              transform: [{ translateX: contentSlide }],
            },
          ]}
        >
          <View style={styles.infoCard}>
            <Ionicons
              name={currentPage.icon}
              size={30}
              color="#79C62D"
              style={styles.icon}
            />

            <Text style={styles.title}>{currentPage.title}</Text>

            <View style={styles.greenLine} />

            <Text style={styles.subtitle}>{currentPage.subtitle}</Text>
          </View>

          {!isLastPage ? (
            <View style={styles.navigationButtons}>
              {pageIndex > 0 && (
                <TouchableOpacity
                  style={styles.outlineButton}
                  onPress={animateToPreviousPage}
                >
                  <Text style={styles.outlineButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={animateToNextPage}
              >
                <Text style={styles.buttonText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.navigationButtons}>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/start")}
              >
                <Text style={styles.buttonText}>Get Started</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.textButton}
                onPress={animateToPreviousPage}
              >
                <Text style={styles.textButtonText}>Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    backgroundColor: "#000",
  },

  backgroundLayer: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 18,
    justifyContent: "space-between",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
    marginRight: 8,
  },

  dotActive: {
    width: 22,
    backgroundColor: "#79C62D",
  },

  skipText: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 15,
    fontWeight: "700",
  },

  skipPlaceholder: {
    width: 34,
  },

  bottomContent: {
    height: "50%",
    justifyContent: "flex-end",
  },

  infoCard: {
    backgroundColor: "rgba(8, 18, 9, 0.58)",
    borderRadius: 40,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    alignItems: "center",
  },

  icon: {
    marginBottom: 4,
  },

  title: {
    color: "#FFF",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 1,
  },

  greenLine: {
    width: 56,
    height: 2,
    backgroundColor: "#79C62D",
    alignSelf: "center",
    marginBottom: 16,
  },

  subtitle: {
    color: "#C9C9C9",
    fontSize: 15.5,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "500",
  },

  navigationButtons: {
    marginTop: 10,
  },

  primaryButton: {
    backgroundColor: "rgba(72, 207, 30, 0.72)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginBottom: 8,
    alignSelf: "center",
    width: "100%",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: "#293f0c",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 1.5,
  },

  outlineButton: {
    backgroundColor: "rgba(8, 18, 9, 0.55)",
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.20)",
    marginBottom: 8,
    alignSelf: "center",
    width: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },

  outlineButtonText: {
    color: "#f1fbf1",
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  textButton: {
    paddingVertical: 8,
  },

  textButtonText: {
    color: "#C9C9C9",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});

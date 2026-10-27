import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";



export default function WorkerHomeScreen() {
  const router = useRouter();
  
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [completedJobsCount, setCompletedJobsCount] = useState(0);
  const [averageRating, setAverageRating] = useState<number | null>(null);

  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);

  async function loadAvailableTasks() {
    setLoadingTasks(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Location Error", "You must be signed in to view nearby tasks.");
      setLoadingTasks(false);
      return;
    }

    const { data: workerProfile, error: workerError } = await supabase
      .from("worker_profiles")
      .select("service_radius_miles")
      .eq("id", userData.user.id)
      .single();

    if (workerError) {
      Alert.alert("Worker Profile Error", workerError.message);
      setLoadingTasks(false);
      return;
    }

    const radiusMiles = Number(workerProfile?.service_radius_miles || 10);

    const existingPermission = await Location.getForegroundPermissionsAsync();

    let finalPermission = existingPermission;

    if (existingPermission.status !== "granted") {
      finalPermission = await Location.requestForegroundPermissionsAsync();
    }

    if (finalPermission.status !== "granted") {
      setLocationPermissionDenied(true);

      Alert.alert(
        "Location Permission Needed",
        "HomeRun needs your location to show tasks near you. You can turn this on in your phone settings.",
        [
          {
            text: "Not Now",
            style: "cancel",
          },
          {
            text: "Open Settings",
            onPress: () => Linking.openSettings(),
          },
        ]
      );

      setAvailableTasks([]);
      setLoadingTasks(false);
      return;
    }

    setLocationPermissionDenied(false);

    const currentLocation = await Location.getCurrentPositionAsync({});

    const workerLat = currentLocation.coords.latitude;
    const workerLng = currentLocation.coords.longitude;

    const { data, error } = await supabase.rpc("nearby_open_tasks", {
      worker_lat: workerLat,
      worker_lng: workerLng,
      radius_miles: radiusMiles,
    });

    if (error) {
      Alert.alert("Error loading nearby tasks", error.message);
      setLoadingTasks(false);
      return;
    }

    setAvailableTasks(data || []);
    setLoadingTasks(false);
  }


  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Logout Error", error.message);
      return;
    }

    router.replace("/");
  }

  function handleViewTaskDetails(task: any) {
    router.push({
      pathname: "/worker-task-details",
      params: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        paymentType: task.payment_type,
        price: task.price?.toString() || "",
        address: task.address,
        date: task.preferred_date,
        time: task.preferred_time,
        equipment: task.equipment_needed?.join(", ") || "",
        extraNotes: task.extra_notes || "",
      },
    });
  }

  function getPriceLabel(task: any) {
    if (task.payment_type === "hourly") {
      return `$${task.price}/hr`;
    }

    if (task.payment_type === "estimate") {
      return "Estimate";
    }

    return `$${task.price}`;
  }

  function getPaymentTypeLabel(task: any) {
    if (task.payment_type === "hourly") {
      return "Hourly Rate";
    }

    if (task.payment_type === "estimate") {
      return "Estimate Requested";
    }

    return "Flat Rate";
  }

  async function loadWorkerStats() {
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return;
    }

    const workerId = userData.user.id;

    const { count: completedCount, error: completedError } = await supabase
      .from("agreements")
      .select("id", { count: "exact", head: true })
      .eq("worker_id", workerId)
      .or("payment_status.eq.paid,agreement_status.eq.completed");

    if (!completedError) {
      setCompletedJobsCount(completedCount || 0);
    }

    const { data: reviewsData, error: reviewsError } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_id", workerId);

    if (reviewsError) {
      return;
    }

    if (!reviewsData || reviewsData.length === 0) {
      setAverageRating(null);
      return;
    }

    const totalRating = reviewsData.reduce(
      (total, review) => total + Number(review.rating || 0),
      0
    );

    const average = totalRating / reviewsData.length;

    setAverageRating(average);
  }

  useEffect(() => {
    loadAvailableTasks();
    loadWorkerStats();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        loadAvailableTasks();
        loadWorkerStats();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);

    try {
      await Promise.all([
        loadAvailableTasks(),
        loadWorkerStats(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
   <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          progressViewOffset={70}
        />
      }
    >

      <Text style={styles.title}>Worker Homepage</Text>

      <Text style={styles.subtitle}>
        Find nearby tasks, track your work, and build your rating.
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedJobsCount}</Text>
          <Text style={styles.statLabel}>Jobs</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {averageRating === null ? "New" : `★ ${averageRating.toFixed(1)}`}
          </Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>100%</Text>
          <Text style={styles.statLabel}>Reliability</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Available Tasks</Text>

      {locationPermissionDenied ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Location permission needed</Text>
          <Text style={styles.emptyText}>
            Turn on location access so HomeRun can show tasks within your service radius.
          </Text>

          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.emptyButtonText}>Open Settings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryEmptyButton}
            onPress={loadAvailableTasks}
          >
            <Text style={styles.secondaryEmptyButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : loadingTasks ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Loading tasks...</Text>
          <Text style={styles.emptyText}>
            Checking for nearby customer tasks.
          </Text>
        </View>
      ) : availableTasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No tasks available yet</Text>
          <Text style={styles.emptyText}>
            Nearby customer tasks will appear here once they are posted.
          </Text>
        </View>
      ) : (
        availableTasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskHeaderRow}>
              <Text style={styles.taskTitle}>{task.title}</Text>
              <Text style={styles.taskPrice}>{getPriceLabel(task)}</Text>
            </View>

            <Text style={styles.paymentTypeLabel}>
              {getPaymentTypeLabel(task)}
            </Text>

            <Text style={styles.taskCategory}>{task.category}</Text>

            <Text style={styles.taskDetail}>{task.address}</Text>
            {task.distance_miles !== undefined ? (
              <Text style={styles.distanceText}>
                {Number(task.distance_miles).toFixed(1)} miles away
              </Text>
            ) : null}

            <Text style={styles.taskDetail}>
              {task.preferred_date} • {task.preferred_time}
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleViewTaskDetails(task)}
            >
              <Text style={styles.buttonText}>
                {task.payment_type === "estimate" ? "Send Estimate" : "View Details"}
              </Text>
            </TouchableOpacity>
          </View>
        ))
      )}
      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/messages")}
        >
          <Text style={styles.quickActionText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.quickActionButton}
          onPress={() => router.push("/earnings")}
          >
          <Text style={styles.quickActionText}>Earnings</Text>
        </TouchableOpacity>

        <TouchableOpacity
            style={styles.quickActionButton}
            onPress={() => router.push("/edit-worker-profile")}
        >
            <Text style={styles.quickActionText}>Edit Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/worker-schedule")}
        >
          <Text style={styles.quickActionText}>Schedule</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/worker-completed-jobs")}
        >
          <Text style={styles.quickActionText}>Completed Jobs</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quickActionButton} onPress={handleLogout}>
          <Text style={styles.quickActionText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 80,
    backgroundColor: "#F7F7F7",
  },

  scrollView: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  backButton: {
    marginTop: 20,
    marginBottom: 20,
  },

  backButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F7A4D",
  },

  title: {
    fontSize: 34,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#1F7A4D",
  },

  subtitle: {
    fontSize: 17,
    textAlign: "center",
    color: "#555",
    lineHeight: 24,
    marginBottom: 30,
  },

  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F7A4D",
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginTop: 18,
    marginBottom: 12,
  },

  taskCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  taskHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },

  taskTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginRight: 12,
  },

  taskPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F7A4D",
    textAlign: "right",
    maxWidth: 110,
  },

  taskCategory: {
    fontSize: 15,
    fontWeight: "600",
    color: "#555",
    marginBottom: 10,
  },

  taskDetail: {
    fontSize: 15,
    color: "#666",
    marginBottom: 4,
  },

  primaryButton: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
  },

  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  quickActions: {
    marginBottom: 40,
  },

  quickActionButton: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 10,
  },

  quickActionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  emptyCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 16,
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 15,
    color: "#666",
    lineHeight: 22,
  },

  paymentTypeLabel: {
    fontSize: 13,
    color: "#1F7A4D",
    fontWeight: "700",
    marginBottom: 8,
  },

  distanceText: {
    fontSize: 14,
    color: "#1F7A4D",
    fontWeight: "700",
    marginBottom: 6,
  },

  emptyButton: {
  backgroundColor: "#1F7A4D",
  padding: 14,
  borderRadius: 12,
  marginTop: 14,
},

emptyButtonText: {
  color: "#FFF",
  fontSize: 15,
  fontWeight: "700",
  textAlign: "center",
},

secondaryEmptyButton: {
  backgroundColor: "#FFF",
  padding: 14,
  borderRadius: 12,
  marginTop: 10,
  borderWidth: 1,
  borderColor: "#DDD",
},

secondaryEmptyButtonText: {
  color: "#111",
  fontSize: 15,
  fontWeight: "700",
  textAlign: "center",
},
});
import { useRouter } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const weeklyEarnings = [
  { day: "Mon", amount: 45 },
  { day: "Tue", amount: 0 },
  { day: "Wed", amount: 70 },
  { day: "Thu", amount: 35 },
  { day: "Fri", amount: 95 },
  { day: "Sat", amount: 120 },
  { day: "Sun", amount: 55 },
];

const recentJobs = [
  {
    id: "1",
    title: "Mowed front and backyard",
    customer: "Sarah M.",
    date: "Today",
    amount: 55,
    status: "Pending Payout",
  },
  {
    id: "2",
    title: "Helped move couch",
    customer: "Daniel R.",
    date: "Yesterday",
    amount: 60,
    status: "Paid",
  },
  {
    id: "3",
    title: "Pulled weeds",
    customer: "Megan T.",
    date: "May 21",
    amount: 35,
    status: "Paid",
  },
  {
    id: "4",
    title: "Furniture assembly",
    customer: "Chris B.",
    date: "May 20",
    amount: 45,
    status: "Paid",
  },
];

export default function EarningsScreen() {
  const router = useRouter();

  const totalIncome = recentJobs.reduce((sum, job) => sum + job.amount, 0);
  const weeklyIncome = weeklyEarnings.reduce((sum, day) => sum + day.amount, 0);
  const pendingPayout = recentJobs
    .filter((job) => job.status === "Pending Payout")
    .reduce((sum, job) => sum + job.amount, 0);

  const completedJobs = recentJobs.length;
  const averageJobPay = totalIncome / completedJobs;

  const maxEarning = Math.max(...weeklyEarnings.map((day) => day.amount));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/worker-home")}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Earnings</Text>

      <Text style={styles.subtitle}>
        Track your income, payouts, completed jobs, and weekly progress.
      </Text>

      <View style={styles.mainEarningsCard}>
        <Text style={styles.mainEarningsLabel}>Total Income</Text>
        <Text style={styles.mainEarningsAmount}>${totalIncome}</Text>
        <Text style={styles.mainEarningsSubtext}>
          From {completedJobs} completed jobs
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statAmount}>${weeklyIncome}</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statAmount}>${pendingPayout}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statAmount}>{completedJobs}</Text>
          <Text style={styles.statLabel}>Jobs</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statAmount}>${averageJobPay.toFixed(0)}</Text>
          <Text style={styles.statLabel}>Avg. Job</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Earnings This Week</Text>

      <View style={styles.chartCard}>
        <View style={styles.chartArea}>
          {weeklyEarnings.map((day) => {
            const barHeight =
              maxEarning === 0 ? 0 : (day.amount / maxEarning) * 130;

            return (
              <View key={day.day} style={styles.barGroup}>
                <Text style={styles.barAmount}>
                  {day.amount > 0 ? `$${day.amount}` : ""}
                </Text>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { height: barHeight }]} />
                </View>

                <Text style={styles.barLabel}>{day.day}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Jobs</Text>

      {recentJobs.map((job) => (
        <View key={job.id} style={styles.jobCard}>
          <View style={styles.jobTopRow}>
            <View style={styles.jobTextContainer}>
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobDetail}>Customer: {job.customer}</Text>
              <Text style={styles.jobDetail}>{job.date}</Text>
            </View>

            <Text style={styles.jobAmount}>${job.amount}</Text>
          </View>

          <View
            style={[
              styles.statusPill,
              job.status === "Paid" && styles.statusPaid,
              job.status === "Pending Payout" && styles.statusPending,
            ]}
          >
            <Text style={styles.statusText}>{job.status}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Payout Info</Text>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How payouts will work</Text>
        <Text style={styles.infoText}>
          Customers will pay upfront. After a job is completed and confirmed,
          the worker payout will be released after the app fee is deducted.
        </Text>

        <View style={styles.payoutExample}>
          <Text style={styles.payoutLine}>Task price: $60</Text>
          <Text style={styles.payoutLine}>Worker fee: -$3</Text>
          <Text style={styles.payoutTotal}>Worker receives: $57</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
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
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#1F7A4D",
  },

  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    lineHeight: 23,
    marginBottom: 24,
  },

  mainEarningsCard: {
    backgroundColor: "#1F7A4D",
    borderRadius: 22,
    padding: 24,
    marginBottom: 18,
  },

  mainEarningsLabel: {
    color: "#DDEFE4",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 8,
  },

  mainEarningsAmount: {
    color: "#FFF",
    fontSize: 46,
    fontWeight: "bold",
    marginBottom: 6,
  },

  mainEarningsSubtext: {
    color: "#DDEFE4",
    fontSize: 15,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  statAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F7A4D",
    marginBottom: 4,
  },

  statLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginTop: 18,
    marginBottom: 12,
  },

  chartCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 12,
  },

  chartArea: {
    height: 190,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },

  barGroup: {
    flex: 1,
    alignItems: "center",
  },

  barAmount: {
    fontSize: 11,
    color: "#555",
    marginBottom: 6,
    height: 16,
  },

  barTrack: {
    height: 130,
    width: 22,
    backgroundColor: "#E8EFEA",
    borderRadius: 999,
    justifyContent: "flex-end",
    overflow: "hidden",
  },

  barFill: {
    width: "100%",
    backgroundColor: "#1F7A4D",
    borderRadius: 999,
  },

  barLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
    fontWeight: "600",
  },

  jobCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 14,
  },

  jobTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },

  jobTextContainer: {
    flex: 1,
    marginRight: 12,
  },

  jobTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111",
    marginBottom: 5,
  },

  jobDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },

  jobAmount: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F7A4D",
  },

  statusPill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  statusPaid: {
    backgroundColor: "#EAF5EE",
  },

  statusPending: {
    backgroundColor: "#FFF4D6",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  infoCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 40,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },

  infoText: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    marginBottom: 16,
  },

  payoutExample: {
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    padding: 14,
  },

  payoutLine: {
    fontSize: 15,
    color: "#555",
    marginBottom: 5,
  },

  payoutTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F7A4D",
    marginTop: 4,
  },
});
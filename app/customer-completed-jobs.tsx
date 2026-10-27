import { calculateServiceFee } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CustomerCompletedJobsScreen() {
  const router = useRouter();

  const [completedJobs, setCompletedJobs] = useState<any[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedReviewJob, setSelectedReviewJob] = useState<any>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  async function loadCompletedJobs() {
    setIsLoadingJobs(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Not Signed In", "Please log in to view completed jobs.");
      setIsLoadingJobs(false);
      return;
    }

    const { data, error } = await supabase
      .from("agreements")
      .select(`
        *,
        tasks (
          id,
          title,
          address,
          preferred_date,
          preferred_time,
          price,
          payment_type,
          status,
          equipment_needed
        ),
        profiles!agreements_worker_id_fkey (
          full_name
        )
      `)
      .eq("customer_id", userData.user.id)
      .or("payment_status.eq.paid,agreement_status.eq.completed")
      .order("paid_at", { ascending: false });

    if (error) {
      Alert.alert("Completed Jobs Error", error.message);
      setIsLoadingJobs(false);
      return;
    }

    setCompletedJobs(data || []);
    setIsLoadingJobs(false);
  }

  useEffect(() => {
    loadCompletedJobs();
  }, []);

  function getTask(job: any) {
    return Array.isArray(job.tasks) ? job.tasks[0] : job.tasks;
  }

  function getWorkerName(job: any) {
    return job.profiles?.full_name || "Worker";
  }

  function getPaymentTypeLabel(job: any) {
    const task = getTask(job);
    const paymentType = job.payment_type || task?.payment_type;

    if (paymentType === "hourly") {
      return "Hourly Rate";
    }

    if (paymentType === "estimate") {
      return "Estimate";
    }

    return "Flat Rate";
  }

  function getJobPrice(job: any) {
    const task = getTask(job);

    return Number(
      job.final_price ??
      job.agreed_price ??
      task?.price ??
      0
    );
  }

  function getServiceFee(job: any) {
    return calculateServiceFee(getJobPrice(job));
  }

  function getTotalPaid(job: any) {
    return getJobPrice(job) + getServiceFee(job);
  }

  function getCompletedDate(job: any) {
    const dateValue =
      job.paid_at ||
      job.customer_approved_at ||
      job.worker_completed_at ||
      job.created_at;

    if (!dateValue) {
      return "Completed date not available";
    }

    return new Date(dateValue).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handleViewReceipt(job: any) {
    const task = getTask(job);
    const workerName = getWorkerName(job);
    const taskPrice = getJobPrice(job);
    const serviceFee = getServiceFee(job);
    const totalPaid = getTotalPaid(job);

    router.push({
      pathname: "/receipt-preview",
      params: {
        taskTitle: task?.title || "Task",
        workerName,
        taskPrice: taskPrice.toString(),
        serviceFee: serviceFee.toString(),
        totalPaid: totalPaid.toString(),
        date: task?.preferred_date || "",
        status: job.agreement_status || "completed",
      },
    });
  }

  function handleViewAgreement(job: any) {
    const task = getTask(job);
    const workerName = getWorkerName(job);

    if (!task) {
      Alert.alert("Agreement Error", "No task was found for this agreement.");
      return;
    }

    router.push({
      pathname: "/agreement-preview",
      params: {
        viewer: "customer",
        mode: "view",
        returnTo: "customer-completed-jobs",

        taskTitle: task.title || "Task",
        workerName,
        paymentType: job.payment_type || task.payment_type || "",
        price:
          job.final_price?.toString() ||
          job.agreed_price?.toString() ||
          task.price?.toString() ||
          "",
        date: task.preferred_date || "",
        time: task.preferred_time || "",
        address: task.address || "",
        equipment: task.equipment_needed?.join(", ") || "",
        workerMessage: "This agreement is connected to a completed job.",
      },
    });
  }

  function handleOpenRatingModal(job: any) {
    setSelectedReviewJob(job);
    setSelectedRating(0);
    setReviewComment("");
    setShowRatingModal(true);
  }

  function handleCloseRatingModal() {
    if (isSubmittingReview) {
      return;
    }

    setShowRatingModal(false);
    setSelectedReviewJob(null);
    setSelectedRating(0);
    setReviewComment("");
  }

  async function handleSubmitReview() {
    if (!selectedReviewJob) {
      Alert.alert("Review Error", "No completed job was selected.");
      return;
    }

    if (selectedRating < 1 || selectedRating > 5) {
      Alert.alert("Rating Required", "Please choose a rating from 1 to 5 stars.");
      return;
    }

    const task = getTask(selectedReviewJob);

    if (!task) {
      Alert.alert("Review Error", "No task was found for this review.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Not Signed In", "Please log in before leaving a review.");
      return;
    }

    setIsSubmittingReview(true);

    const { error } = await supabase
      .from("reviews")
      .upsert(
        {
          task_id: task.id,
          reviewer_id: userData.user.id,
          reviewee_id: selectedReviewJob.worker_id,
          rating: selectedRating,
          comment: reviewComment.trim() || null,
        },
        {
          onConflict: "task_id,reviewer_id",
        }
      );

    if (error) {
      setIsSubmittingReview(false);
      Alert.alert("Review Error", error.message);
      return;
    }

    setIsSubmittingReview(false);
    handleCloseRatingModal();

    Alert.alert("Review Submitted", "Thanks for rating your worker.");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.replace("/customer-home")}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Completed Jobs</Text>

      <Text style={styles.subtitle}>
        Review your finished jobs, receipts, agreements, and payment history.
      </Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryNumber}>{completedJobs.length}</Text>
        <Text style={styles.summaryLabel}>Completed Jobs</Text>
      </View>

      {isLoadingJobs ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Loading completed jobs...</Text>
          <Text style={styles.emptyText}>
            Checking your completed job history.
          </Text>
        </View>
      ) : completedJobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No completed jobs yet</Text>
          <Text style={styles.emptyText}>
            Jobs will appear here after the worker finishes the job and you
            confirm completion and payment.
          </Text>
        </View>
      ) : (
        completedJobs.map((job) => {
          const task = getTask(job);
          const workerName = getWorkerName(job);
          const jobPrice = getJobPrice(job);
          const serviceFee = getServiceFee(job);
          const totalPaid = getTotalPaid(job);

          return (
            <View key={job.id} style={styles.jobCard}>
              <View style={styles.jobTopRow}>
                <View style={styles.jobTextContainer}>
                  <Text style={styles.jobTitle}>
                    {task?.title || "Completed Job"}
                  </Text>

                  <Text style={styles.workerName}>
                    Worker: {workerName}
                  </Text>

                  <Text style={styles.paymentType}>
                    {getPaymentTypeLabel(job)}
                  </Text>
                </View>

                <Text style={styles.totalPaid}>
                  ${totalPaid.toFixed(2)}
                </Text>
              </View>

              <View style={styles.detailBox}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Job price</Text>
                  <Text style={styles.detailValue}>
                    ${jobPrice.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Service fee</Text>
                  <Text style={styles.detailValue}>
                    ${serviceFee.toFixed(2)}
                  </Text>
                </View>

                <View style={styles.detailRowTotal}>
                  <Text style={styles.detailLabelTotal}>Total paid</Text>
                  <Text style={styles.detailValueTotal}>
                    ${totalPaid.toFixed(2)}
                  </Text>
                </View>
              </View>

              <Text style={styles.jobDetail}>
                Completed: {getCompletedDate(job)}
              </Text>

              <Text style={styles.jobDetail}>
                Original date: {task?.preferred_date || "Date not set"} •{" "}
                {task?.preferred_time || "Time not set"}
              </Text>

              <View style={styles.statusPill}>
                <Text style={styles.statusText}>Completed & Paid</Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => handleViewReceipt(job)}
                >
                  <Text style={styles.primaryButtonText}>View Receipt</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handleViewAgreement(job)}
                >
                  <Text style={styles.secondaryButtonText}>
                    View Agreement
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.rateButton}
                onPress={() => handleOpenRatingModal(job)}
              >
                <Text style={styles.rateButtonText}>Rate Worker</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
      <Modal
        visible={showRatingModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseRatingModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rate Worker</Text>

            <Text style={styles.modalSubtitle}>
              How was your experience with this worker?
            </Text>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setSelectedRating(star)}
                  disabled={isSubmittingReview}
                >
                  <Text
                    style={[
                      styles.starText,
                      selectedRating >= star && styles.starTextSelected,
                    ]}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.ratingLabel}>
              {selectedRating === 0
                ? "Select a rating"
                : `${selectedRating} out of 5 stars`}
            </Text>

            <TextInput
              style={styles.reviewInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="Optional: describe your experience"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.submitReviewButton,
                isSubmittingReview && styles.disabledButton,
              ]}
              disabled={isSubmittingReview}
              onPress={handleSubmitReview}
            >
              <Text style={styles.submitReviewButtonText}>
                {isSubmittingReview ? "Submitting..." : "Submit Rating"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelReviewButton}
              disabled={isSubmittingReview}
              onPress={handleCloseRatingModal}
            >
              <Text style={styles.cancelReviewButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: "#F7F7F7",
  },

  backButton: {
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
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    lineHeight: 23,
    marginBottom: 24,
  },

  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    marginBottom: 24,
  },

  summaryNumber: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F7A4D",
    marginBottom: 4,
  },

  summaryLabel: {
    fontSize: 14,
    color: "#666",
    fontWeight: "700",
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

  jobCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
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
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },

  workerName: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    marginBottom: 4,
  },

  paymentType: {
    fontSize: 13,
    color: "#1F7A4D",
    fontWeight: "700",
  },

  totalPaid: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F7A4D",
    textAlign: "right",
  },

  detailBox: {
    backgroundColor: "#F7F7F7",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },

  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  detailRowTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#DDD",
    paddingTop: 8,
    marginTop: 4,
  },

  detailLabel: {
    fontSize: 14,
    color: "#666",
  },

  detailValue: {
    fontSize: 14,
    color: "#111",
    fontWeight: "600",
  },

  detailLabelTotal: {
    fontSize: 15,
    color: "#111",
    fontWeight: "700",
  },

  detailValueTotal: {
    fontSize: 15,
    color: "#1F7A4D",
    fontWeight: "700",
  },

  jobDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },

  statusPill: {
    alignSelf: "flex-start",
    backgroundColor: "#EAF5EE",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 4,
    marginBottom: 14,
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  buttonRow: {
    flexDirection: "row",
    marginBottom: 10,
  },

  primaryButton: {
    flex: 1,
    backgroundColor: "#111",
    padding: 13,
    borderRadius: 12,
    marginRight: 6,
  },

  primaryButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  secondaryButton: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    marginLeft: 6,
  },

  secondaryButtonText: {
    color: "#111",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  rateButton: {
    backgroundColor: "#1F7A4D",
    padding: 13,
    borderRadius: 12,
  },

  rateButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    padding: 24,
  },

  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
  },

  modalTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
    marginBottom: 8,
  },

  modalSubtitle: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },

  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },

  starText: {
    fontSize: 38,
    color: "#D1D5DB",
    marginHorizontal: 3,
  },

  starTextSelected: {
    color: "#FACC15",
  },

  ratingLabel: {
    fontSize: 14,
    color: "#555",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 14,
  },

  reviewInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 15,
    color: "#111",
    marginBottom: 16,
  },

  submitReviewButton: {
    backgroundColor: "#1F7A4D",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  submitReviewButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  cancelReviewButton: {
    padding: 12,
  },

  cancelReviewButtonText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.55,
  },
});
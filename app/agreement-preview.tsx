import { supabase } from "@/lib/supabase";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

function getParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AgreementPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const viewer = getParamValue(params.viewer);
  const mode = getParamValue(params.mode) || "view";
  const returnTo = getParamValue(params.returnTo);
  const isConfirmMode = mode === "confirm";

  const requestId = getParamValue(params.requestId);
  const taskId = getParamValue(params.taskId);
  const workerId = getParamValue(params.workerId);
  const customerId = getParamValue(params.customerId);

  const taskTitle = getParamValue(params.taskTitle) || "Task";
  const workerName = getParamValue(params.workerName) || "Worker";
  const isViewOnly = viewer === "worker" || !isConfirmMode;
  const paymentType = getParamValue(params.paymentType) || "flat";
  const price = getParamValue(params.price) || "";
  const date = getParamValue(params.date) || "";
  const time = getParamValue(params.time) || "";
  const address = getParamValue(params.address) || "";
  const equipment = getParamValue(params.equipment) || "";
  const workerMessage =
    getParamValue(params.workerMessage) ||
    "This agreement is connected to the selected job.";

  const isWorkerView = viewer === "worker";

  const [isConfirming, setIsConfirming] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  function handleLeaveAgreement() {
    if (returnTo === "worker-completed-jobs") {
      router.replace("/worker-completed-jobs");
      return;
    }

    if (returnTo === "customer-payments" || returnTo === "customer-completed-jobs") {
      router.replace("/customer-completed-jobs");
      return;
    }

    if (returnTo === "worker-schedule") {
      router.replace("/worker-schedule");
      return;
    }

    if (isWorkerView) {
      router.replace("/worker-schedule");
      return;
    }

    router.replace("/customer-home");
  }

  async function handleConfirmAgreement() {
    if (isViewOnly) {
      handleLeaveAgreement();
      return;
    }

    if (isWorkerView) {
      router.replace("/worker-schedule");
      return;
    }

    if (isConfirming || hasConfirmed) {
      return;
    }

    if (!requestId || !taskId || !workerId || !customerId) {
      Alert.alert(
        "Agreement Error",
        `Missing ID info.\n\nrequestId: ${requestId || "missing"}\ntaskId: ${taskId || "missing"
        }\nworkerId: ${workerId || "missing"}\ncustomerId: ${customerId || "missing"
        }`
      );
      return;
    }

    setIsConfirming(true);

    const { data: updatedRequest, error: requestError } = await supabase
      .from("task_requests")
      .update({ status: "accepted" })
      .eq("id", requestId)
      .select("id, task_id, worker_id, status")
      .single();

    if (requestError) {
      setIsConfirming(false);
      Alert.alert("Request Error", requestError.message);
      return;
    }

    if (!updatedRequest || updatedRequest.status !== "accepted") {
      setIsConfirming(false);
      Alert.alert(
        "Request Error",
        "The task request was not accepted. This usually means the request ID is wrong or RLS blocked the update."
      );
      return;
    }

    const { error: declineOthersError } = await supabase
      .from("task_requests")
      .update({ status: "declined" })
      .eq("task_id", taskId)
      .eq("status", "pending")
      .neq("id", requestId);

    if (declineOthersError) {
      setIsConfirming(false);
      Alert.alert("Request Error", declineOthersError.message);
      return;
    }

    const { data: updatedTask, error: taskError } = await supabase
      .from("tasks")
      .update({
        status: "accepted",
        accepted_worker_id: workerId,
      })
      .eq("id", taskId)
      .select("id, status, accepted_worker_id")
      .single();

    if (taskError) {
      setIsConfirming(false);
      Alert.alert("Task Error", taskError.message);
      return;
    }

    if (!updatedTask || updatedTask.status !== "accepted") {
      setIsConfirming(false);
      Alert.alert(
        "Task Error",
        "The task was not updated correctly. This may be an RLS policy issue."
      );
      return;
    }

    const agreedPrice = price ? Number(price) : null;

    const { data: existingAgreement, error: existingAgreementError } =
      await supabase
        .from("agreements")
        .select("id")
        .eq("task_id", taskId)
        .eq("customer_id", customerId)
        .eq("worker_id", workerId)
        .maybeSingle();

    if (existingAgreementError) {
      setIsConfirming(false);
      Alert.alert("Agreement Error", existingAgreementError.message);
      return;
    }

    if (existingAgreement) {
      const { error: updateAgreementError } = await supabase
        .from("agreements")
        .update({
          payment_type: paymentType,
          agreed_price: agreedPrice,
          agreement_status: "confirmed",
          payment_status: "unpaid",
        })
        .eq("id", existingAgreement.id);

      if (updateAgreementError) {
        setIsConfirming(false);
        Alert.alert("Agreement Error", updateAgreementError.message);
        return;
      }
    } else {
      const { error: insertAgreementError } = await supabase
        .from("agreements")
        .insert({
          task_id: taskId,
          customer_id: customerId,
          worker_id: workerId,
          payment_type: paymentType,
          agreed_price: agreedPrice,
          agreement_status: "confirmed",
          payment_status: "unpaid",
        });

      if (insertAgreementError) {
        setIsConfirming(false);
        Alert.alert("Agreement Error", insertAgreementError.message);
        return;
      }
    }

    setHasConfirmed(true);
    setIsConfirming(false);

    Alert.alert(
      "Agreement Confirmed",
      "The worker has been accepted and the job has been confirmed.",
      [
        {
          text: "Back to Home",
          onPress: () => router.replace("/customer-home"),
        },
      ]
    );
  }

  const paymentLabel =
    paymentType === "hourly"
      ? "Hourly Rate"
      : paymentType === "estimate"
        ? "Estimate Requested"
        : "Flat Rate";

  const priceLabel = price
    ? paymentType === "hourly"
      ? `$${price}/hr`
      : `$${price}`
    : paymentType === "estimate"
      ? "Estimate Required"
      : "$0";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={handleLeaveAgreement}>
        <Text style={styles.backButtonText}>
          {isWorkerView ? "← Back to Schedule" : "← Back to Payments"}
        </Text>
      </TouchableOpacity>

      <Text style={styles.title}>Agreement Preview</Text>

      <Text style={styles.subtitle}>
        {isWorkerView
          ? "Review the agreement connected to your accepted job."
          : "Review the job details before confirming this worker."}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{taskTitle}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Worker</Text>
          <Text style={styles.value}>{workerName}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Payment Type</Text>
          <Text style={styles.value}>{paymentLabel}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Price</Text>
          <Text style={styles.value}>{priceLabel}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Date</Text>
          <Text style={styles.value}>{date || "Not set"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Time</Text>
          <Text style={styles.value}>{time || "Not set"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Address</Text>
          <Text style={styles.value}>{address || "Not provided"}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Equipment</Text>
          <Text style={styles.value}>{equipment || "None listed"}</Text>
        </View>
      </View>

      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>Worker Message</Text>
        <Text style={styles.messageText}>{workerMessage}</Text>
      </View>

      <View style={styles.termsCard}>
        <Text style={styles.termsTitle}>Agreement Terms</Text>

        <Text style={styles.termsText}>
          • The worker agrees to complete the job as described.
        </Text>

        <Text style={styles.termsText}>
          • The customer agrees to confirm completion after the job is done.
        </Text>

        <Text style={styles.termsText}>
          • Payment is released after completion is confirmed.
        </Text>

        <Text style={styles.termsText}>
          • No-shows, ghosting, or late cancellations may affect account
          reliability.
        </Text>
      </View>

      {isViewOnly ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleLeaveAgreement}>
          <Text style={styles.primaryButtonText}>
            {isWorkerView ? "Back to Schedule" : "Back"}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (isConfirming || hasConfirmed) && styles.disabledButton,
            ]}
            disabled={isConfirming || hasConfirmed}
            onPress={handleConfirmAgreement}
          >
            <Text style={styles.primaryButtonText}>
              {hasConfirmed
                ? "Agreement Confirmed"
                : isConfirming
                  ? "Confirming..."
                  : "Confirm Agreement"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            disabled={isConfirming || hasConfirmed}
            onPress={handleLeaveAgreement}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      )}
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
    marginBottom: 18,
  },

  backButtonText: {
    color: "#1F7A4D",
    fontSize: 16,
    fontWeight: "700",
  },

  title: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#1F7A4D",
    textAlign: "center",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    lineHeight: 23,
    marginBottom: 22,
  },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 16,
  },

  cardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#222",
    marginBottom: 16,
  },

  row: {
    marginBottom: 12,
  },

  label: {
    fontSize: 13,
    color: "#777",
    fontWeight: "700",
    marginBottom: 3,
  },

  value: {
    fontSize: 16,
    color: "#222",
    fontWeight: "600",
  },

  messageCard: {
    backgroundColor: "#EAF7EF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#BFE5CD",
  },

  messageTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1F7A4D",
    marginBottom: 8,
  },

  messageText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },

  termsCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 18,
  },

  termsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#222",
    marginBottom: 10,
  },

  termsText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginBottom: 6,
  },

  primaryButton: {
    backgroundColor: "#1F7A4D",
    padding: 15,
    borderRadius: 14,
    marginBottom: 12,
  },

  primaryButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.55,
  },

  cancelButton: {
    backgroundColor: "#FFF",
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    marginBottom: 30,
  },

  cancelButtonText: {
    color: "#444",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
});
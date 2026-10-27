import { calculateServiceFee } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";


type WorkSession = {
  id: string;
  task_id: string;
  agreement_id: string;
  worker_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  status: "active" | "completed";
  created_at: string;
};


const recentActivity: any[] = [];

export default function CustomerHomeScreen() {
  const router = useRouter();

  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<any[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const totalWorkerRequests = activeTasks.reduce((total, task) => total + task.requests, 0);

  const [payNowJobs, setPayNowJobs] = useState<any[]>([]);
  const [isLoadingPayNowJobs, setIsLoadingPayNowJobs] = useState(true);
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  const [showEstimateModal, setShowEstimateModal] = useState(false);
  const [selectedEstimateJob, setSelectedEstimateJob] = useState<any>(null);
  const [estimateAmount, setEstimateAmount] = useState("");
  const [isSavingEstimate, setIsSavingEstimate] = useState(false);

  const [showHoursAdjustmentModal, setShowHoursAdjustmentModal] = useState(false);
  const [selectedHourlyJob, setSelectedHourlyJob] = useState<any>(null);
  const [additionalHours, setAdditionalHours] = useState("");
  const [adjustmentNote, setAdjustmentNote] = useState("");
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [adjustmentMode, setAdjustmentMode] = useState<"add" | "remove">("add");

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewJob, setSelectedReviewJob] = useState<any>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  function getTask(job: any) {
    return Array.isArray(job.tasks) ? job.tasks[0] : job.tasks;
  }

  function getWorkerName(job: any) {
    const workerProfile = Array.isArray(job.profiles)
      ? job.profiles[0]
      : job.profiles;

    return workerProfile?.full_name || "Worker";
  }

  function getTaskPrice(job: any) {
    const task = getTask(job);
    const paymentType = job.payment_type || task?.payment_type;

    if (paymentType === "hourly") {
      return Number(job.final_price ?? getAdjustedHourlyPrice(job));
    }

    return Number(
      job.final_price ??
      job.agreed_price ??
      task?.price ??
      0
    );
  }

  function getServiceFee(job: any) {
    return calculateServiceFee(getTaskPrice(job));
  }

  function getTotalDue(job: any) {
    return getTaskPrice(job) + getServiceFee(job);
  }

  function getWorkSessions(job: any): WorkSession[] {
    return Array.isArray(job.work_sessions) ? job.work_sessions : [];
  }

  function getCompletedSessions(job: any) {
    return getWorkSessions(job).filter(
      (session) =>
        session.status === "completed" &&
        session.ended_at &&
        Number(session.duration_seconds || 0) > 0
    );
  }

  function getTotalSeconds(job: any) {
    return getCompletedSessions(job).reduce(
      (total, session) => total + Number(session.duration_seconds || 0),
      0
    );
  }

  function getAdjustmentSeconds(job: any) {
    return Number(job.customer_adjustment_seconds || 0);
  }

  function getApprovedTotalSeconds(job: any) {
    return getTotalSeconds(job) + getAdjustmentSeconds(job);
  }

  function getHourlyRate(job: any) {
    const task = getTask(job);
    return Number(job.agreed_price ?? task?.price ?? 0);
  }

  function getAdjustedHourlyPrice(job: any) {
    const approvedSeconds = getApprovedTotalSeconds(job);
    const hourlyRate = getHourlyRate(job);

    return Math.round((approvedSeconds / 3600) * hourlyRate * 100) / 100;
  }

  function formatDuration(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [hours, minutes, seconds]
      .map((value) => String(value).padStart(2, "0"))
      .join(":");
  }

  function formatSessionDate(dateValue: string) {
    return new Date(dateValue).toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatSessionTime(dateValue: string) {
    return new Date(dateValue).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getPaymentTypeLabel(item: any) {
    const task = getTask(item);
    const paymentType = item.payment_type || task?.payment_type || item.payment_type;

    if (paymentType === "hourly") {
      return "Hourly Rate";
    }

    if (paymentType === "estimate") {
      return "Estimate";
    }

    return "Flat Rate";
  }

  function getPaymentStatus(job: any) {
    const task = getTask(job);
    const paymentType = job.payment_type || task?.payment_type;

    const estimateAmount =
      job.final_price ??
      job.agreed_price ??
      task?.price ??
      null;

    const hasEstimateAmount =
      estimateAmount !== null &&
      estimateAmount !== undefined &&
      Number(estimateAmount) > 0;

    if (
      job.payment_status === "paid" ||
      job.agreement_status === "completed"
    ) {
      return "Paid";
    }

    if (
      job.payment_status === "pending_customer_confirmation" ||
      task?.status === "worker_completed"
    ) {
      if (paymentType === "estimate" && !hasEstimateAmount) {
        return "Estimate Needed";
      }

      return "Needs Confirmation";
    }

    if (paymentType === "estimate" && !hasEstimateAmount) {
      return "Estimate Needed";
    }

    if (paymentType === "hourly" && task?.status === "in_progress") {
      return "Hourly Work In Progress";
    }

    return "Payment Pending";
  }


  async function loadPayNowJobs() {
    setIsLoadingPayNowJobs(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setIsLoadingPayNowJobs(false);
      return;
    }

    const { data: agreementsData, error: agreementsError } = await supabase
      .from("agreements")
      .select(`
        *,
        tasks (
          id,
          title,
          category,
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
      .or("payment_status.is.null,payment_status.neq.paid")
      .order("created_at", { ascending: false });

    if (agreementsError) {
      Alert.alert("Pay Now Error", agreementsError.message);
      setIsLoadingPayNowJobs(false);
      return;
    }

    const taskIds = (agreementsData || [])
      .map((agreement: any) => getTask(agreement)?.id)
      .filter(Boolean);

    let sessionData: WorkSession[] = [];

    if (taskIds.length > 0) {
      const { data, error: sessionsError } = await supabase
        .from("work_sessions")
        .select("*")
        .in("task_id", taskIds)
        .order("started_at", { ascending: true });

      if (sessionsError) {
        Alert.alert("Work Log Error", sessionsError.message);
        setIsLoadingPayNowJobs(false);
        return;
      }

      sessionData = (data || []) as WorkSession[];
    }

    const paymentsWithSessions = (agreementsData || []).map((agreement: any) => {
      const task = getTask(agreement);

      return {
        ...agreement,
        work_sessions: sessionData.filter(
          (session) => session.task_id === task?.id
        ),
      };
    });

    const readyForPayment = paymentsWithSessions.filter((job) => {
      const task = getTask(job);

      return (
        task?.status === "worker_completed" ||
        job.payment_status === "pending_customer_confirmation"
      );
    });

    setPayNowJobs(readyForPayment);
    setIsLoadingPayNowJobs(false);
  }


  async function loadCustomerTasks() {
    setIsLoadingTasks(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Not Signed In", "Please log in to view your tasks.");
      setIsLoadingTasks(false);
      return;
    }

    const { data: openTasksData, error: openTasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("customer_id", userData.user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (openTasksError) {
      Alert.alert("Task Error", openTasksError.message);
      setIsLoadingTasks(false);
      return;
    }

    const tasksWithRequestCounts = await Promise.all(
      (openTasksData || []).map(async (task) => {
        const { count } = await supabase
          .from("task_requests")
          .select("*", { count: "exact", head: true })
          .eq("task_id", task.id)
          .eq("status", "pending");

        return {
          ...task,
          requests: count || 0,
        };
      })
    );

    const { data: agreementsData, error: agreementsError } = await supabase
      .from("agreements")
      .select(`
        *,
        tasks (
          id,
          title,
          category,
          address,
          preferred_date,
          preferred_time,
          payment_type,
          price,
          equipment_needed,
          status
        ),
        profiles!agreements_worker_id_fkey (
          full_name
        )
      `)
      .eq("customer_id", userData.user.id)
      .in("agreement_status", ["confirmed", "pending"])
      .order("created_at", { ascending: false });

    if (agreementsError) {
      Alert.alert("Upcoming Jobs Error", agreementsError.message);
      setIsLoadingTasks(false);
      return;
    }

    const formattedUpcomingJobs = (agreementsData || [])
      .filter((agreement) => {
        const task = Array.isArray(agreement.tasks)
          ? agreement.tasks[0]
          : agreement.tasks;

        return task && task.status === "accepted";
      })
      .map((agreement) => {
        const task = Array.isArray(agreement.tasks)
          ? agreement.tasks[0]
          : agreement.tasks;

        const workerProfile = Array.isArray(agreement.profiles)
          ? agreement.profiles[0]
          : agreement.profiles;

        return {
          id: agreement.id,
          taskId: task.id,
          title: task.title,
          category: task.category,
          worker: workerProfile?.full_name || "Worker",
          payment_type: agreement.payment_type || task.payment_type,
          paymentType: agreement.payment_type || task.payment_type,
          price: agreement.final_price || agreement.agreed_price || task.price || 0,
          date: task.preferred_date || "",
          time: task.preferred_time || "",
          address: task.address || "",
          equipment: task.equipment_needed?.join(", ") || "",
          workerMessage: "",
          agreementStatus:
            agreement.agreement_status === "confirmed"
              ? "Agreement Confirmed"
              : "Agreement Pending",
          paymentStatus:
            agreement.payment_status === "paid"
              ? "Paid"
              : "Payment Pending",
        };
      });

    setActiveTasks(tasksWithRequestCounts);
    setUpcomingJobs(formattedUpcomingJobs);
    setIsLoadingTasks(false);
  }

  useEffect(() => {
    loadCustomerTasks();
    loadPayNowJobs();
  }, []);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert("Logout Error", error.message);
      return;
    }

    router.replace("/");
  }

  function handlePostTask() {
    router.push("/post-task");
  }

  function handleViewRequests(task: any) {
    router.push({
      pathname: "/worker-requests",
      params: {
        taskId: task.id,
      },
    });
  }

  function handleEditTask(task: any) {
    router.push({
      pathname: "/edit-task",
      params: {
        taskId: task.id,
        title: task.title,
        description: task.description,
        category: task.category,
        paymentType: task.payment_type,
        price: task.price?.toString() || "",
        address: task.address || "",
        date: task.preferred_date || "",
        time: task.preferred_time || "",
        extraNotes: task.extra_notes || "",
        equipment: task.equipment_needed?.join(", ") || "",
      },
    });
  }

  function handleCancelTask(taskId: string, taskTitle: string) {
    Alert.alert(
      "Cancel Task?",
      `Are you sure you want to cancel: ${taskTitle}?`,
      [
        {
          text: "Keep Task",
          style: "cancel",
        },
        {
          text: "Cancel Task",
          style: "destructive",
          onPress: async () => {
            const { data: userData, error: userError } =
              await supabase.auth.getUser();

            if (userError || !userData.user) {
              Alert.alert(
                "Cancel Error",
                "You must be signed in to cancel this task."
              );
              return;
            }

            const cancelledAt = new Date().toISOString();

            const { error: taskError } = await supabase
              .from("tasks")
              .update({
                status: "cancelled",
                cancelled_by: userData.user.id,
                cancelled_by_role: "customer",
                cancellation_reason: "Customer cancelled from Customer Home.",
                cancelled_at: cancelledAt,
              })
              .eq("id", taskId);

            if (taskError) {
              Alert.alert("Cancel Error", taskError.message);
              return;
            }

            const { error: agreementError } = await supabase
              .from("agreements")
              .update({
                agreement_status: "cancelled",
                payment_status: "cancelled",
                cancelled_by: userData.user.id,
                cancelled_by_role: "customer",
                cancellation_reason: "Customer cancelled from Customer Home.",
                cancelled_at: cancelledAt,
              })
              .eq("task_id", taskId);

            if (agreementError) {
              Alert.alert("Agreement Cancel Error", agreementError.message);
              return;
            }

            const { error: requestError } = await supabase
              .from("task_requests")
              .update({
                status: "declined",
              })
              .eq("task_id", taskId)
              .eq("status", "pending");

            if (requestError) {
              Alert.alert("Request Cancel Error", requestError.message);
              return;
            }

            setActiveTasks((currentTasks) =>
              currentTasks.filter((task) => task.id !== taskId)
            );

            Alert.alert(
              "Task Cancelled",
              "The task has been cancelled and removed from your active list."
            );
          },
        },
      ]
    );
  }

  function handleOpenReviewModal(job: any) {
    setSelectedReviewJob(job);
    setSelectedRating(0);
    setReviewComment("");
    setShowReviewModal(true);
  }

  function handleCloseReviewModal() {
    if (isSubmittingReview) {
      return;
    }

    setShowReviewModal(false);
    setSelectedReviewJob(null);
    setSelectedRating(0);
    setReviewComment("");
  }

  async function handleSubmitReview() {
    if (!selectedReviewJob) {
      Alert.alert("Review Error", "No job was selected for review.");
      return;
    }

    if (selectedRating < 1) {
      Alert.alert("Rating Required", "Please choose a star rating before submitting.");
      return;
    }

    const task = getTask(selectedReviewJob);

    if (!task) {
      Alert.alert("Review Error", "No task was found for this review.");
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Review Error", "You must be signed in to leave a review.");
      return;
    }

    if (!selectedReviewJob.worker_id) {
      Alert.alert("Review Error", "No worker was found for this review.");
      return;
    }

    setIsSubmittingReview(true);

    const { error } = await supabase.from("reviews").upsert(
      {
        task_id: task.id,
        reviewer_id: userData.user.id,
        reviewee_id: selectedReviewJob.worker_id,
        rating: selectedRating,
        comment: reviewComment.trim() || null,
      },
      { onConflict: "task_id,reviewer_id" }
    );

    if (error) {
      setIsSubmittingReview(false);
      Alert.alert("Review Error", error.message);
      return;
    }

    setIsSubmittingReview(false);
    handleCloseReviewModal();

    Alert.alert("Review Submitted", "Thanks for reviewing your worker.");
  }

  function getPriceLabel(item: any) {
    if (item.payment_type === "hourly") {
      return item.price ? `$${item.price}/hr` : "Hourly";
    }

    if (item.payment_type === "estimate") {
      return "Estimate";
    }

    return item.price ? `$${item.price}` : "Price not set";
  }

  async function onRefresh() {
    setRefreshing(true);

    try {
      await Promise.all([
        loadCustomerTasks(),
        loadPayNowJobs(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleOpenEstimateModal(job: any) {
    const task = getTask(job);

    const currentEstimate =
      job.final_price ??
      job.agreed_price ??
      task?.price ??
      "";

    setSelectedEstimateJob(job);
    setEstimateAmount(currentEstimate ? currentEstimate.toString() : "");
    setShowEstimateModal(true);
  }

  function handleCloseEstimateModal() {
    if (isSavingEstimate) {
      return;
    }

    setShowEstimateModal(false);
    setSelectedEstimateJob(null);
    setEstimateAmount("");
  }

  async function handleSaveEstimate() {
    if (!selectedEstimateJob) {
      Alert.alert("Estimate Error", "No agreement was selected.");
      return;
    }

    const parsedAmount = Number(estimateAmount);

    if (
      !estimateAmount.trim() ||
      !Number.isFinite(parsedAmount) ||
      parsedAmount <= 0
    ) {
      Alert.alert(
        "Invalid Estimate",
        "Please enter an estimate greater than zero."
      );
      return;
    }

    setIsSavingEstimate(true);

    const { data: updatedAgreement, error } = await supabase
      .from("agreements")
      .update({
        final_price: parsedAmount,
      })
      .eq("id", selectedEstimateJob.id)
      .eq("customer_id", selectedEstimateJob.customer_id)
      .select("id, final_price")
      .single();

    if (error) {
      setIsSavingEstimate(false);
      Alert.alert("Estimate Error", error.message);
      return;
    }

    if (!updatedAgreement || Number(updatedAgreement.final_price) !== parsedAmount) {
      setIsSavingEstimate(false);
      Alert.alert("Estimate Error", "The estimate was not saved correctly.");
      return;
    }

    setIsSavingEstimate(false);
    handleCloseEstimateModal();

    await Promise.all([
      loadCustomerTasks(),
      loadPayNowJobs(),
    ]);

    Alert.alert(
      "Estimate Saved",
      `The agreed estimate is now $${parsedAmount.toFixed(2)}.`
    );
  }

  function handleOpenHoursAdjustmentModal(job: any) {
    setSelectedHourlyJob(job);
    setAdditionalHours("");
    setAdjustmentMode("add");
    setAdjustmentNote("");
    setShowHoursAdjustmentModal(true);
  }

  function handleCloseHoursAdjustmentModal() {
    if (isSavingAdjustment) {
      return;
    }

    setShowHoursAdjustmentModal(false);
    setSelectedHourlyJob(null);
    setAdditionalHours("");
    setAdjustmentNote("");
    setAdjustmentMode("add");
  }

  async function handleSaveHoursAdjustment() {
    if (!selectedHourlyJob) {
      Alert.alert("Adjustment Error", "No hourly agreement was selected.");
      return;
    }

    const parsedHours = Number(additionalHours);

    if (
      !additionalHours.trim() ||
      !Number.isFinite(parsedHours) ||
      parsedHours <= 0
    ) {
      Alert.alert("Invalid Hours", "Enter an amount greater than zero.");
      return;
    }

    const enteredSeconds = Math.round(parsedHours * 3600);
    const currentAdjustmentSeconds = Number(
      selectedHourlyJob.customer_adjustment_seconds || 0
    );

    const newAdjustmentSeconds =
      adjustmentMode === "add"
        ? currentAdjustmentSeconds + enteredSeconds
        : currentAdjustmentSeconds - enteredSeconds;

    if (newAdjustmentSeconds < 0) {
      Alert.alert(
        "Cannot Remove That Much",
        `The current adjustment is ${formatDuration(
          currentAdjustmentSeconds
        )}. You cannot remove more time than was previously added.`
      );
      return;
    }

    const loggedSeconds = getTotalSeconds(selectedHourlyJob);
    const approvedSeconds = loggedSeconds + newAdjustmentSeconds;
    const hourlyRate = getHourlyRate(selectedHourlyJob);

    const adjustedFinalPrice =
      Math.round((approvedSeconds / 3600) * hourlyRate * 100) / 100;

    const previousNote = selectedHourlyJob.customer_adjustment_note?.trim() || "";

    const actionText =
      adjustmentMode === "add"
        ? `Added ${parsedHours} hour${parsedHours === 1 ? "" : "s"}`
        : `Removed ${parsedHours} hour${parsedHours === 1 ? "" : "s"}`;

    const newNotePart = adjustmentNote.trim()
      ? `${actionText}: ${adjustmentNote.trim()}`
      : actionText;

    const combinedNote = previousNote
      ? `${previousNote}\n${newNotePart}`
      : newNotePart;

    setIsSavingAdjustment(true);

    const { data: updatedAgreement, error } = await supabase
      .from("agreements")
      .update({
        customer_adjustment_seconds: newAdjustmentSeconds,
        customer_adjustment_note: newAdjustmentSeconds === 0 ? null : combinedNote,
        customer_adjusted_at: new Date().toISOString(),
        final_price: adjustedFinalPrice,
      })
      .eq("id", selectedHourlyJob.id)
      .select(`
        id,
        customer_adjustment_seconds,
        customer_adjustment_note,
        customer_adjusted_at,
        final_price
      `)
      .single();

    if (error) {
      setIsSavingAdjustment(false);
      Alert.alert("Adjustment Error", error.message);
      return;
    }

    if (!updatedAgreement) {
      setIsSavingAdjustment(false);
      Alert.alert("Adjustment Error", "The hours adjustment was not saved.");
      return;
    }

    setIsSavingAdjustment(false);
    handleCloseHoursAdjustmentModal();

    await Promise.all([
      loadCustomerTasks(),
      loadPayNowJobs(),
    ]);

    Alert.alert(
      "Hours Updated",
      `Adjustment total: ${formatDuration(
        newAdjustmentSeconds
      )}\nApproved job time: ${formatDuration(
        approvedSeconds
      )}\nJob price: $${adjustedFinalPrice.toFixed(2)}`
    );
  }

  async function handleMakePaymentFromHome(job: any) {
    const task = getTask(job);
    const taskTitle = task?.title || "this task";
    const paymentType = job.payment_type || task?.payment_type;
    const loggedSeconds = getTotalSeconds(job);
    const adjustmentSeconds = getAdjustmentSeconds(job);
    const approvedSeconds = getApprovedTotalSeconds(job);
    const hourlyRate = getHourlyRate(job);
    const finalPrice = getTaskPrice(job);

    if (!task) {
      Alert.alert("Payment Error", "No task was found for this payment.");
      return;
    }

    if (task.status !== "worker_completed") {
      Alert.alert(
        "Job Not Ready",
        "The worker has not marked this job as complete yet."
      );
      return;
    }

    if (paymentType === "hourly" && approvedSeconds <= 0) {
      Alert.alert(
        "Work Log Error",
        "No completed hourly work sessions were found for this job."
      );
      return;
    }

    const confirmationMessage =
      paymentType === "hourly"
        ? `Review "${taskTitle}":\n\nWorker logged: ${formatDuration(
          loggedSeconds
        )}\nAdded time: ${formatDuration(
          adjustmentSeconds
        )}\nApproved total: ${formatDuration(
          approvedSeconds
        )}\nHourly rate: $${hourlyRate.toFixed(
          2
        )}/hr\nJob price: $${finalPrice.toFixed(
          2
        )}\n\nConfirm these hours and release payment?`
        : `Confirm that "${taskTitle}" is complete and release payment?`;

    Alert.alert(
      paymentType === "hourly"
        ? "Confirm Hours & Payment?"
        : "Confirm Completion?",
      confirmationMessage,
      [
        {
          text: "Not Yet",
          style: "cancel",
        },
        {
          text:
            paymentType === "hourly"
              ? "Approve Hours & Pay"
              : "Confirm & Pay",
          onPress: async () => {
            setBusyPaymentId(job.id);

            // One call, one server-side transaction. The edge function
            // re-derives the price from work_sessions + adjustments itself
            // instead of trusting finalPrice computed above in this component,
            // and request_id makes a double-tap or retry a no-op instead of
            // a double-charge once a real payment processor is wired in.
            const requestId = `${job.id}-confirm-${Date.now()}`;

            const { data, error } = await supabase.functions.invoke(
              "confirm-and-pay",
              { body: { agreement_id: job.id, request_id: requestId } }
            );

            if (error) {
              setBusyPaymentId(null);
              Alert.alert("Payment Error", error.message);
              return;
            }

            const completedReviewJob = {
              ...job,
              agreement_status: "completed",
              payment_status: "paid",
              final_price: data?.final_price ?? finalPrice,
              tasks: {
                ...task,
                status: "completed",
              },
            };

            await Promise.all([
              loadCustomerTasks(),
              loadPayNowJobs(),
            ]);

            setBusyPaymentId(null);

            Alert.alert(
              "Payment Sent",
              paymentType === "hourly"
                ? "The hours were approved and payment has been released."
                : "The job has been completed and payment has been released.",
              [
                {
                  text: "Review Worker",
                  onPress: () => handleOpenReviewModal(completedReviewJob),
                },
              ]
            );
          },
        },
      ]
    );
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

      <Text style={styles.title}>Customer Homepage</Text>

      <Text style={styles.subtitle}>
        Post home tasks, review worker requests, and keep track of upcoming jobs.
      </Text>

      <TouchableOpacity style={styles.postTaskButton} onPress={handlePostTask}>
        <Text style={styles.postTaskButtonText}>+ Post a New Task</Text>
      </TouchableOpacity>

      {payNowJobs.length > 0 ? (
        <>
          <Text style={styles.urgentSectionTitle}>Pay Now</Text>

          {payNowJobs.map((job) => {
            const task = getTask(job);
            const workerName = getWorkerName(job);
            const paymentType = job.payment_type || task?.payment_type;
            const taskPrice = getTaskPrice(job);
            const serviceFee = getServiceFee(job);
            const totalDue = getTotalDue(job);
            const isBusy = busyPaymentId === job.id;
            const paymentStatus = getPaymentStatus(job);
            const completedSessions = getCompletedSessions(job);
            const loggedSeconds = getTotalSeconds(job);
            const adjustmentSeconds = getAdjustmentSeconds(job);
            const approvedSeconds = getApprovedTotalSeconds(job);
            const hourlyRate = getHourlyRate(job);

            return (
              <View key={job.id} style={styles.payNowCard}>
                <View style={styles.taskTopRow}>
                  <View style={styles.taskTextContainer}>
                    <Text style={styles.taskTitle}>
                      {task?.title || "Task"}
                    </Text>

                    <Text style={styles.taskCategory}>
                      Worker: {workerName}
                    </Text>

                    <Text style={styles.paymentTypeLabel}>
                      {getPaymentTypeLabel(job)}
                    </Text>
                  </View>

                  <Text style={styles.taskPrice}>
                    {paymentStatus === "Estimate Needed"
                      ? "Pending"
                      : `$${totalDue.toFixed(2)}`}
                  </Text>
                </View>

                {paymentType === "hourly" && completedSessions.length > 0 ? (
                  <View style={styles.hourlyReviewCard}>
                    <Text style={styles.hourlyReviewTitle}>
                      Hourly Work Summary
                    </Text>

                    <View style={styles.hourlySummaryRow}>
                      <View style={styles.hourlySummaryItem}>
                        <Text style={styles.hourlySummaryValue}>
                          {formatDuration(loggedSeconds)}
                        </Text>
                        <Text style={styles.hourlySummaryLabel}>
                          Logged Time
                        </Text>
                      </View>

                      <View style={styles.hourlySummaryItem}>
                        <Text style={styles.hourlySummaryValue}>
                          {formatDuration(adjustmentSeconds)}
                        </Text>
                        <Text style={styles.hourlySummaryLabel}>
                          Added Time
                        </Text>
                      </View>

                      <View style={styles.hourlySummaryItem}>
                        <Text style={styles.hourlySummaryValue}>
                          {formatDuration(approvedSeconds)}
                        </Text>
                        <Text style={styles.hourlySummaryLabel}>
                          Approved Total
                        </Text>
                      </View>

                      <View style={styles.hourlySummaryItem}>
                        <Text style={styles.hourlySummaryValue}>
                          ${hourlyRate.toFixed(2)}
                        </Text>
                        <Text style={styles.hourlySummaryLabel}>
                          Hourly Rate
                        </Text>
                      </View>

                      <View style={styles.hourlySummaryItem}>
                        <Text style={styles.hourlySummaryValue}>
                          ${taskPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.hourlySummaryLabel}>
                          Job Price
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.workLogTitle}>Work Log</Text>

                    {completedSessions.map((session, index) => (
                      <View key={session.id} style={styles.sessionRow}>
                        <View style={styles.sessionTextContainer}>
                          <Text style={styles.sessionTitle}>
                            Session {index + 1} · {formatSessionDate(session.started_at)}
                          </Text>

                          <Text style={styles.sessionTimes}>
                            {formatSessionTime(session.started_at)} –{" "}
                            {session.ended_at
                              ? formatSessionTime(session.ended_at)
                              : "In progress"}
                          </Text>
                        </View>

                        <Text style={styles.sessionDuration}>
                          {formatDuration(Number(session.duration_seconds || 0))}
                        </Text>
                      </View>
                    ))}

                    <TouchableOpacity
                      style={styles.adjustHoursButton}
                      onPress={() => handleOpenHoursAdjustmentModal(job)}
                    >
                      <Text style={styles.adjustHoursButtonText}>
                        Add / Remove Hours
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}

                <View style={styles.paymentBreakdownBox}>
                  <View style={styles.paymentBreakdownRow}>
                    <Text style={styles.paymentBreakdownLabel}>
                      {paymentType === "hourly"
                        ? "Calculated job price"
                        : "Job price"}
                    </Text>
                    <Text style={styles.paymentBreakdownValue}>
                      {paymentStatus === "Estimate Needed"
                        ? "Pending"
                        : `$${taskPrice.toFixed(2)}`}
                    </Text>
                  </View>

                  <View style={styles.paymentBreakdownRow}>
                    <Text style={styles.paymentBreakdownLabel}>Service fee</Text>
                    <Text style={styles.paymentBreakdownValue}>
                      {paymentStatus === "Estimate Needed"
                        ? "Pending"
                        : `$${serviceFee.toFixed(2)}`}
                    </Text>
                  </View>

                  <View style={styles.paymentBreakdownTotalRow}>
                    <Text style={styles.paymentBreakdownTotalLabel}>Total due</Text>
                    <Text style={styles.paymentBreakdownTotalValue}>
                      {paymentStatus === "Estimate Needed"
                        ? "Pending"
                        : `$${totalDue.toFixed(2)}`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.taskDetail}>
                  {task?.preferred_date || "Date not set"} •{" "}
                  {task?.preferred_time || "Time not set"}
                </Text>

                <Text style={styles.payNowHelperText}>
                  {paymentStatus === "Estimate Needed"
                    ? "Enter the final agreed estimate before confirming payment."
                    : paymentType === "hourly"
                      ? "Review the worker's logged hours before confirming payment."
                      : "The worker marked this job as finished. Confirm completion and release payment."}
                </Text>

                {paymentStatus === "Estimate Needed" ? (
                  <TouchableOpacity
                    style={styles.payNowButton}
                    onPress={() => handleOpenEstimateModal(job)}
                  >
                    <Text style={styles.payNowButtonText}>
                      Enter Estimate Amount
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.payNowButton,
                      isBusy && styles.disabledButton,
                    ]}
                    disabled={isBusy}
                    onPress={() => handleMakePaymentFromHome(job)}
                  >
                    <Text style={styles.payNowButtonText}>
                      {isBusy
                        ? "Processing..."
                        : paymentType === "hourly"
                          ? "Review Hours & Pay"
                          : "Confirm & Pay"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      ) : null}

      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{activeTasks.length}</Text>
          <Text style={styles.summaryLabel}>Active Tasks</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{totalWorkerRequests}</Text>
          <Text style={styles.summaryLabel}>Worker Requests</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{upcomingJobs.length}</Text>
          <Text style={styles.summaryLabel}>Upcoming Job</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Active Tasks</Text>

      {isLoadingTasks ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Loading tasks...</Text>
          <Text style={styles.emptyText}>
            Checking your posted tasks.
          </Text>
        </View>
      ) : activeTasks.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active tasks yet</Text>
          <Text style={styles.emptyText}>
            When you post a task, it will show up here so you can review worker
            requests, edit details, or cancel it.
          </Text>

          <TouchableOpacity style={styles.emptyButton} onPress={handlePostTask}>
            <Text style={styles.emptyButtonText}>Post Your First Task</Text>
          </TouchableOpacity>
        </View>
      ) : (
        activeTasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <View style={styles.taskTopRow}>
              <View style={styles.taskTextContainer}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskCategory}>{task.category}</Text>
                <Text style={styles.paymentTypeLabel}>
                  {getPaymentTypeLabel(task)}
                </Text>
              </View>

              <Text style={styles.taskPrice}>{getPriceLabel(task)}</Text>
            </View>

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, styles.statusAwaiting]}>
                <Text style={styles.statusText}>Awaiting Worker</Text>
              </View>

              <Text style={styles.requestText}>
                {task.requests} request{task.requests !== 1 ? "s" : ""}
              </Text>
            </View>

            <Text style={styles.taskDetail}>
              {task.preferred_date} • {task.preferred_time}
            </Text>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => handleViewRequests(task)}
            >
              <Text style={styles.secondaryButtonText}>View Worker Requests</Text>
            </TouchableOpacity>

            <View style={styles.taskActionRow}>
              <TouchableOpacity
                style={styles.editTaskButton}
                onPress={() => handleEditTask(task)}
              >
                <Text style={styles.editTaskButtonText}>Edit Task</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelTaskButton}
                onPress={() => handleCancelTask(task.id, task.title)}

              >
                <Text style={styles.cancelTaskButtonText}>Cancel Task</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <Text style={styles.sectionTitle}>Upcoming Jobs</Text>

      {upcomingJobs.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No upcoming jobs yet</Text>
          <Text style={styles.emptyText}>
            Once you accept a worker and confirm an agreement, scheduled jobs will
            appear here.
          </Text>
        </View>
      ) : (
        upcomingJobs.map((job) => (
          <View key={job.id} style={styles.jobCard}>
            <View style={styles.taskTopRow}>
              <View style={styles.taskTextContainer}>
                <Text style={styles.taskTitle}>{job.title}</Text>
                <Text style={styles.taskCategory}>Worker: {job.worker}</Text>
                <Text style={styles.paymentTypeLabel}>
                  {getPaymentTypeLabel(job)}
                </Text>
              </View>

              <Text style={styles.taskPrice}>{getPriceLabel(job)}</Text>
            </View>

            <Text style={styles.taskDetail}>
              {job.date} • {job.time}
            </Text>

            <View style={styles.agreementPill}>
              <Text style={styles.agreementText}>{job.agreementStatus}</Text>
            </View>

            <View style={styles.paymentPill}>
              <Text style={styles.paymentText}>{job.paymentStatus}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push({
                  pathname: "/agreement-preview",
                  params: {
                    taskTitle: job.title,
                    workerName: job.worker,
                    paymentType: job.paymentType,
                    price: job.price.toString(),
                    date: job.date,
                    time: job.time,
                    address: job.address,
                    equipment: job.equipment,
                    workerMessage: job.workerMessage,
                  },
                })
              }
            >
              <Text style={styles.primaryButtonText}>Review Agreement</Text>
            </TouchableOpacity>
          </View>
        ))
      )}


      <Text style={styles.sectionTitle}>Quick Actions</Text>

      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={handlePostTask}
        >
          <Text style={styles.quickActionText}>Post Task</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/customer-messages")}
        >
          <Text style={styles.quickActionText}>Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/customer-completed-jobs")}
        >
          <Text style={styles.quickActionText}>Completed Jobs</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={() => router.push("/edit-customer-profile")}
        >
          <Text style={styles.quickActionText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.quickActionButton} onPress={handleLogout}>
        <Text style={styles.quickActionText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Recent Activity</Text>

      {recentActivity.map((activity) => (
        <View key={activity.id} style={styles.activityCard}>
          <Text style={styles.activityText}>{activity.text}</Text>
          <Text style={styles.activityTime}>{activity.time}</Text>
        </View>
      ))}

      <Modal
        visible={showEstimateModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseEstimateModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Enter Agreed Estimate</Text>

            <Text style={styles.modalSubtitle}>
              Enter the amount you and the worker agreed on. Once saved, this job will be ready for payment.
            </Text>

            <Text style={styles.modalLabel}>Estimate Amount</Text>

            <View style={styles.estimateInputRow}>
              <Text style={styles.currencySymbol}>$</Text>

              <TextInput
                style={styles.estimateInput}
                value={estimateAmount}
                onChangeText={setEstimateAmount}
                placeholder="0.00"
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                isSavingEstimate && styles.disabledButton,
              ]}
              disabled={isSavingEstimate}
              onPress={handleSaveEstimate}
            >
              <Text style={styles.modalSaveButtonText}>
                {isSavingEstimate ? "Saving..." : "Save Estimate"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              disabled={isSavingEstimate}
              onPress={handleCloseEstimateModal}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showHoursAdjustmentModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseHoursAdjustmentModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add / Remove Approved Hours</Text>

            <Text style={styles.modalSubtitle}>
              Adjust approved time without changing the worker's original timer logs.
            </Text>

            <Text style={styles.modalLabel}>Adjustment Type</Text>

            <View style={styles.adjustmentModeRow}>
              <TouchableOpacity
                style={[
                  styles.adjustmentModeButton,
                  adjustmentMode === "add" &&
                  styles.adjustmentModeButtonActive,
                ]}
                onPress={() => setAdjustmentMode("add")}
                disabled={isSavingAdjustment}
              >
                <Text
                  style={[
                    styles.adjustmentModeButtonText,
                    adjustmentMode === "add" &&
                    styles.adjustmentModeButtonTextActive,
                  ]}
                >
                  Add Hours
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.adjustmentModeButton,
                  adjustmentMode === "remove" &&
                  styles.adjustmentModeButtonActive,
                ]}
                onPress={() => setAdjustmentMode("remove")}
                disabled={isSavingAdjustment}
              >
                <Text
                  style={[
                    styles.adjustmentModeButtonText,
                    adjustmentMode === "remove" &&
                    styles.adjustmentModeButtonTextActive,
                  ]}
                >
                  Remove Hours
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>
              Hours to {adjustmentMode === "add" ? "Add" : "Remove"}
            </Text>

            <TextInput
              style={styles.hoursAdjustmentInput}
              value={additionalHours}
              onChangeText={setAdditionalHours}
              placeholder="Example: 0.5"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            <Text style={styles.adjustmentHelperText}>
              0.25 = 15 minutes · 0.5 = 30 minutes · 1.5 = 1 hour 30 minutes
            </Text>

            {selectedHourlyJob ? (
              <View style={styles.currentAdjustmentCard}>
                <Text style={styles.currentAdjustmentLabel}>
                  Current added time
                </Text>
                <Text style={styles.currentAdjustmentValue}>
                  {formatDuration(getAdjustmentSeconds(selectedHourlyJob))}
                </Text>
              </View>
            ) : null}

            <Text style={styles.modalLabel}>Optional Note</Text>

            <TextInput
              style={styles.adjustmentNoteInput}
              value={adjustmentNote}
              onChangeText={setAdjustmentNote}
              placeholder="Why are you changing the approved time?"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                isSavingAdjustment && styles.disabledButton,
              ]}
              disabled={isSavingAdjustment}
              onPress={handleSaveHoursAdjustment}
            >
              <Text style={styles.modalSaveButtonText}>
                {isSavingAdjustment
                  ? "Saving..."
                  : adjustmentMode === "add"
                    ? "Add Hours"
                    : "Remove Hours"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              disabled={isSavingAdjustment}
              onPress={handleCloseHoursAdjustmentModal}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showReviewModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseReviewModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Review Your Worker</Text>

            <Text style={styles.modalSubtitle}>
              How did the worker do on this job? Your review helps keep HomeRun reliable for everyone.
            </Text>

            <Text style={styles.modalLabel}>Rating</Text>

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

            <Text style={styles.modalLabel}>Optional Comment</Text>

            <TextInput
              style={styles.reviewCommentInput}
              value={reviewComment}
              onChangeText={setReviewComment}
              placeholder="What went well? Was the worker reliable?"
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
              editable={!isSubmittingReview}
            />

            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                isSubmittingReview && styles.disabledButton,
              ]}
              disabled={isSubmittingReview}
              onPress={handleSubmitReview}
            >
              <Text style={styles.modalSaveButtonText}>
                {isSubmittingReview ? "Submitting..." : "Submit Review"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              disabled={isSubmittingReview}
              onPress={handleCloseReviewModal}
            >
              <Text style={styles.modalCancelButtonText}>Maybe Later</Text>
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
    fontSize: 16,
    textAlign: "center",
    color: "#555",
    lineHeight: 23,
    marginBottom: 24,
  },

  postTaskButton: {
    backgroundColor: "#1F7A4D",
    padding: 18,
    borderRadius: 18,
    marginBottom: 20,
  },

  postTaskButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },

  summaryCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },

  summaryNumber: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1F7A4D",
    marginBottom: 4,
  },

  summaryLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    fontWeight: "600",
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
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 14,
  },

  jobCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 14,
  },

  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },

  taskTextContainer: {
    flex: 1,
    marginRight: 12,
  },

  taskTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },

  taskCategory: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },

  taskPrice: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F7A4D",
    textAlign: "right",
    maxWidth: 110,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },

  statusPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  statusAwaiting: {
    backgroundColor: "#FFF4D6",
  },

  statusConfirmed: {
    backgroundColor: "#EAF5EE",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  requestText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F7A4D",
  },

  taskDetail: {
    fontSize: 14,
    color: "#666",
    marginBottom: 14,
  },

  primaryButton: {
    backgroundColor: "#111",
    padding: 14,
    borderRadius: 12,
    marginTop: 14,
  },

  primaryButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  secondaryButton: {
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  secondaryButtonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  agreementPill: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF4D6",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },

  paymentPill: {
    alignSelf: "flex-start",
    backgroundColor: "#E8F0FE",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginTop: 8,
  },

  paymentText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  agreementText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  quickActions: {
    marginBottom: 8,
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

  activityCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    marginBottom: 10,
  },

  activityText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    marginBottom: 4,
  },

  activityTime: {
    fontSize: 13,
    color: "#777",
  },

  taskActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },

  editTaskButton: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    marginRight: 6,
  },

  editTaskButtonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  cancelTaskButton: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    marginLeft: 6,
  },

  cancelTaskButtonText: {
    color: "#B91C1C",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  payNowButton: {
    backgroundColor: "#1F7A4D",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },

  payNowButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
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
    marginBottom: 16,
  },

  emptyButton: {
    backgroundColor: "#1F7A4D",
    padding: 14,
    borderRadius: 12,
  },

  emptyButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },

  paymentTypeLabel: {
    fontSize: 13,
    color: "#1F7A4D",
    fontWeight: "700",
    marginBottom: 6,
  },

  scrollView: {
    flex: 1,
    backgroundColor: "#F7F7F7",
  },

  urgentSectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#B45309",
    marginTop: 18,
    marginBottom: 12,
  },

  payNowCard: {
    backgroundColor: "#FFF7ED",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#FDBA74",
    marginBottom: 14,
  },

  paymentBreakdownBox: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 12,
  },

  paymentBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },

  paymentBreakdownLabel: {
    fontSize: 14,
    color: "#666",
  },

  paymentBreakdownValue: {
    fontSize: 14,
    color: "#111",
    fontWeight: "600",
  },

  paymentBreakdownTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#DDD",
    paddingTop: 8,
    marginTop: 4,
  },

  paymentBreakdownTotalLabel: {
    fontSize: 15,
    color: "#111",
    fontWeight: "800",
  },

  paymentBreakdownTotalValue: {
    fontSize: 15,
    color: "#1F7A4D",
    fontWeight: "800",
  },

  payNowHelperText: {
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    marginBottom: 12,
  },

  disabledButton: {
    opacity: 0.55,
  },

  hourlyReviewCard: {
    backgroundColor: "#F3F8F5",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CFE4D7",
    marginBottom: 12,
  },

  hourlyReviewTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1F7A4D",
    marginBottom: 12,
  },

  hourlySummaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  hourlySummaryItem: {
    width: "48%",
    alignItems: "center",
    marginBottom: 12,
  },

  hourlySummaryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111",
    textAlign: "center",
  },

  hourlySummaryLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 3,
    textAlign: "center",
  },

  workLogTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#222",
    marginBottom: 8,
  },

  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 11,
    marginBottom: 8,
  },

  sessionTextContainer: {
    flex: 1,
    marginRight: 10,
  },

  sessionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#222",
    marginBottom: 3,
  },

  sessionTimes: {
    fontSize: 12,
    color: "#666",
  },

  sessionDuration: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F7A4D",
  },

  adjustHoursButton: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#1F7A4D",
    padding: 12,
    borderRadius: 12,
    marginTop: 10,
  },

  adjustHoursButtonText: {
    color: "#1F7A4D",
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
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
    marginBottom: 8,
  },

  modalSubtitle: {
    fontSize: 15,
    color: "#666",
    lineHeight: 21,
    marginBottom: 18,
  },

  modalLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginBottom: 8,
  },

  estimateInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },

  currencySymbol: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },

  estimateInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontSize: 18,
    color: "#111",
  },

  modalSaveButton: {
    backgroundColor: "#1F7A4D",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  modalSaveButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  modalCancelButton: {
    padding: 12,
  },

  modalCancelButtonText: {
    color: "#555",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },

  adjustmentModeRow: {
    flexDirection: "row",
    marginHorizontal: -4,
    marginBottom: 18,
  },

  adjustmentModeButton: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DDD",
    backgroundColor: "#FFF",
    marginHorizontal: 4,
  },

  adjustmentModeButtonActive: {
    backgroundColor: "#1F7A4D",
    borderColor: "#1F7A4D",
  },

  adjustmentModeButtonText: {
    color: "#555",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },

  adjustmentModeButtonTextActive: {
    color: "#FFF",
  },

  hoursAdjustmentInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    fontSize: 17,
    color: "#111",
    marginBottom: 8,
  },

  adjustmentHelperText: {
    fontSize: 12,
    color: "#777",
    lineHeight: 18,
    marginBottom: 16,
  },

  currentAdjustmentCard: {
    backgroundColor: "#F3F8F5",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#CFE4D7",
  },

  currentAdjustmentLabel: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginBottom: 4,
  },

  currentAdjustmentValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F7A4D",
    textAlign: "center",
  },

  adjustmentNoteInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    minHeight: 90,
    fontSize: 15,
    color: "#111",
    marginBottom: 18,
  },

  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 18,
  },

  starText: {
    fontSize: 38,
    color: "#D1D5DB",
    marginHorizontal: 4,
  },

  starTextSelected: {
    color: "#FACC15",
  },

  reviewCommentInput: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 12,
    padding: 14,
    minHeight: 100,
    fontSize: 15,
    color: "#111",
    marginBottom: 18,
  },
});
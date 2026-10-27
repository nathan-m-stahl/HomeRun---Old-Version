import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function CustomerMessagesScreen() {
  const router = useRouter();

  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  async function loadCustomerConversations() {
    setIsLoadingMessages(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      Alert.alert("Not Signed In", "Please log in to view your messages.");
      setIsLoadingMessages(false);
      return;
    }

    const customerId = userData.user.id;

    const { data: agreementsData, error: agreementsError } = await supabase
      .from("agreements")
      .select(`
        id,
        task_id,
        customer_id,
        worker_id,
        agreement_status,
        created_at,
        tasks (
          id,
          title,
          preferred_date,
          preferred_time,
          address,
          status
        )
      `)
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false });

    if (agreementsError) {
      Alert.alert("Messages Error", agreementsError.message);
      setIsLoadingMessages(false);
      return;
    }

    const conversationsWithMessages = await Promise.all(
      (agreementsData || []).map(async (agreement: any) => {
        const task = Array.isArray(agreement.tasks)
          ? agreement.tasks[0]
          : agreement.tasks;

        const { data: workerProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", agreement.worker_id)
          .single();

        const { data: latestMessages } = await supabase
          .from("messages")
          .select("*")
          .eq("task_id", agreement.task_id)
          .or(
            `and(sender_id.eq.${customerId},receiver_id.eq.${agreement.worker_id}),and(sender_id.eq.${agreement.worker_id},receiver_id.eq.${customerId})`
          )
          .order("created_at", { ascending: false })
          .limit(1);

        const latestMessage = latestMessages?.[0];

        return {
          id: agreement.id,
          taskId: agreement.task_id,
          taskTitle: task?.title || "Task",
          taskDate: task?.preferred_date || "",
          taskTime: task?.preferred_time || "",
          workerId: agreement.worker_id,
          workerName: workerProfile?.full_name || "Worker",
          lastMessage:
            latestMessage?.body || "No messages yet. Start the conversation.",
          lastMessageTime: latestMessage
            ? new Date(latestMessage.created_at).toLocaleDateString()
            : "",
          status:
            agreement.agreement_status === "confirmed"
              ? "Confirmed"
              : "Pending Agreement",
          unread: false,
        };
      })
    );

    setConversations(conversationsWithMessages);
    setIsLoadingMessages(false);
  }

  useEffect(() => {
    loadCustomerConversations();
  }, []);

  function handleOpenConversation(conversation: any) {
    router.push({
      pathname: "/message-thread",
      params: {
        taskId: conversation.taskId,
        receiverId: conversation.workerId,
        receiverName: conversation.workerName,
        taskTitle: conversation.taskTitle,
      },
    });
  }

  const activeChats = conversations.length;
  const unreadCount = conversations.filter((conversation) => conversation.unread).length;
  const needsReviewCount = conversations.filter(
    (conversation) => conversation.status === "Pending Agreement"
  ).length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => router.push("/customer-home")}
      >
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Messages</Text>

      <Text style={styles.subtitle}>
        Review worker requests, ask questions, and manage task conversations.
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{unreadCount}</Text>
          <Text style={styles.summaryLabel}>Unread</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{activeChats}</Text>
          <Text style={styles.summaryLabel}>Active Chats</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{needsReviewCount}</Text>
          <Text style={styles.summaryLabel}>Needs Review</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.filterButtonActive}>
          <Text style={styles.filterButtonTextActive}>All</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filterButton}>
          <Text style={styles.filterButtonText}>Confirmed</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Inbox</Text>

      {isLoadingMessages ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Loading messages...</Text>
          <Text style={styles.emptyText}>
            Checking your task conversations.
          </Text>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Once you accept a worker and confirm an agreement, your conversation
            will appear here.
          </Text>
        </View>
      ) : (
        conversations.map((message) => (
          <TouchableOpacity
            key={message.id}
            style={[
              styles.messageCard,
              message.unread && styles.unreadMessageCard,
            ]}
            onPress={() => handleOpenConversation(message)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {message.workerName.charAt(0)}
              </Text>
            </View>

            <View style={styles.messageContent}>
              <View style={styles.messageTopRow}>
                <Text style={styles.workerName}>{message.workerName}</Text>
                <Text style={styles.messageTime}>{message.lastMessageTime}</Text>
              </View>

              <Text style={styles.taskName}>{message.taskTitle}</Text>

              <Text
                style={[
                  styles.lastMessage,
                  message.unread && styles.unreadLastMessage,
                ]}
                numberOfLines={2}
              >
                {message.lastMessage}
              </Text>

              <View style={styles.messageBottomRow}>
                <View
                  style={[
                    styles.statusPill,
                    message.status === "Worker Request" && styles.statusRequest,
                    message.status === "Pending Agreement" &&
                      styles.statusPending,
                    message.status === "Confirmed" && styles.statusConfirmed,
                    message.status === "Completed" && styles.statusCompleted,
                  ]}
                >
                  <Text style={styles.statusText}>{message.status}</Text>
                </View>

                {message.unread && <View style={styles.unreadDot} />}
              </View>
            </View>
          </TouchableOpacity>
        ))
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

  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 22,
  },

  summaryItem: {
    flex: 1,
    alignItems: "center",
  },

  summaryNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F7A4D",
  },

  summaryLabel: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
    textAlign: "center",
  },

  summaryDivider: {
    width: 1,
    height: 42,
    backgroundColor: "#E5E5E5",
  },

  filterRow: {
    flexDirection: "row",
    marginBottom: 22,
  },

  filterButtonActive: {
    backgroundColor: "#1F7A4D",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginRight: 8,
  },

  filterButton: {
    backgroundColor: "#FFF",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#DDD",
  },

  filterButtonTextActive: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },

  filterButtonText: {
    color: "#333",
    fontSize: 14,
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },

  messageCard: {
    backgroundColor: "#FFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    flexDirection: "row",
  },

  unreadMessageCard: {
    borderColor: "#1F7A4D",
    backgroundColor: "#F4FBF6",
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1F7A4D",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  avatarText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
  },

  messageContent: {
    flex: 1,
  },

  messageTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  workerName: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111",
  },

  messageTime: {
    fontSize: 12,
    color: "#777",
  },

  taskName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F7A4D",
    marginTop: 3,
    marginBottom: 6,
  },

  lastMessage: {
    fontSize: 14,
    color: "#666",
    lineHeight: 20,
  },

  unreadLastMessage: {
    color: "#222",
    fontWeight: "600",
  },

  messageBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },

  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#EFEFEF",
  },

  statusRequest: {
    backgroundColor: "#E8F0FE",
  },

  statusPending: {
    backgroundColor: "#FFF4D6",
  },

  statusConfirmed: {
    backgroundColor: "#EAF5EE",
  },

  statusCompleted: {
    backgroundColor: "#EFEFEF",
  },

  statusText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#333",
  },

  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#1F7A4D",
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
});
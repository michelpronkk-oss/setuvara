export type ChatInboxItem = {
  id: string;
  other_user_id: string;
  other_name: string;
  requester_id: string;
  status: "pending" | "accepted" | "declined";
  last_sequence: number;
  last_message_body: string | null;
  last_message_sender_id: string | null;
  last_activity_at: string;
  unread_count: number;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sequence: number;
  sender_id: string;
  client_id: string;
  body: string;
  is_request: boolean;
  created_at: string;
};

export type ChatTarget = { id: string; name: string; connectionId: string };

export function chatError(error: { message?: string } | null, fallback = "Something went wrong. Try again.") {
  const message = error?.message ?? "";
  if (message.includes("chat_rate_limited")) return "You’re moving a little fast. Please try again later.";
  if (message.includes("chat_connection_required")) return "This person is no longer in your Connections.";
  if (message.includes("chat_request_declined")) return "This request can’t be sent again.";
  if (message.includes("chat_request_pending")) return "Your request is waiting for a response.";
  if (message.includes("chat_acceptance_required")) return "Wait for your request to be accepted before sending more.";
  if (message.includes("chat_retry_mismatch")) return "This retry no longer matches your message. Write a new message.";
  if (message.includes("chat_unavailable")) return "Messaging isn’t available with this person right now.";
  return fallback;
}

export function chatTime(value: string) {
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

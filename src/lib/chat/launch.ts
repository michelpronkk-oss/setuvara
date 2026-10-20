import "server-only";

/** Keep the application closed until schema, safety operations and legal copy are approved. */
export function connectChatEnabled() {
  return process.env.CONNECT_CHAT_ENABLED === "true";
}

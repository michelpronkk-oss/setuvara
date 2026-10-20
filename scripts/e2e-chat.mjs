import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.CHAT_TEST_SUPABASE_URL;
const publishable = process.env.CHAT_TEST_PUBLISHABLE_KEY;
const secret = process.env.CHAT_TEST_SECRET_KEY;
if (process.env.CHAT_TEST_LOCAL !== "1" || !url || !publishable || !secret
  || !["127.0.0.1", "localhost"].includes(new URL(url).hostname)) {
  throw new Error("Chat E2E runs only against an explicitly configured local Supabase stack.");
}

const admin = createClient(url, secret, { auth: { persistSession: false } });
const runtime = await admin.rpc("chat_is_enabled");
assert.ifError(runtime.error);
assert.equal(runtime.data, true, "enable chat_runtime only in the isolated local test database first");
const run = randomUUID().slice(0, 8);
const users = [];
const password = `Test-${randomUUID()}-aA1!`;

async function member(name) {
  const email = `chat-${name.toLowerCase()}-${run}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: `chat_${name.toLowerCase()}_${run}`, display_name: name },
  });
  assert.ifError(error);
  assert.ok(data.user?.id);
  users.push(data.user.id);
  const client = createClient(url, publishable, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  assert.ifError(signed.error);
  return { id: data.user.id, client };
}

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  assert.ifError(error);
  return data;
}

async function connect(a, b) {
  const { data, error } = await admin.from("connections").insert({
    user_id: a.id, connected_user_id: b.id,
    user_display_name_snapshot: a.name ?? "Member", connected_display_name_snapshot: b.name ?? "Member",
  }).select("id").single();
  assert.ifError(error);
  return data.id;
}

try {
  const a = { ...(await member("Alice")), name: "Alice" };
  const b = { ...(await member("Bob")), name: "Bob" };
  const c = { ...(await member("Carol")), name: "Carol" };
  const abConnectionId = await connect(a, b);
  await connect(a, c);
  await connect(b, c);

  const first = await Promise.all([
    a.client.rpc("chat_start_request", { p_target_id: b.id, p_client_id: randomUUID(), p_body: "Hello from Alice" }),
    b.client.rpc("chat_start_request", { p_target_id: a.id, p_client_id: randomUUID(), p_body: "Hello from Bob" }),
  ]);
  assert.equal(first.filter((result) => !result.error).length, 1, "simultaneous requests have one winner");
  const winner = first[0].error ? b : a;
  const recipient = first[0].error ? a : b;
  const conversationId = first.find((result) => !result.error).data.conversation_id;
  const { data: before } = await admin.from("chat_conversations").select("status,last_sequence").eq("id", conversationId).single();
  assert.equal(before.status, "pending", "reciprocal request never auto-accepts");
  assert.equal(before.last_sequence, 1);
  const premature = await winner.client.rpc("chat_send", {
    p_conversation_id: conversationId, p_client_id: randomUUID(), p_body: "Too early",
  });
  assert.ok(premature.error, "reply requires acceptance");
  await rpc(recipient.client, "chat_decide_request", { p_conversation_id: conversationId, p_action: "accept" });

  const retryId = randomUUID();
  const [sentA, sentB] = await Promise.all([
    winner.client.rpc("chat_send", { p_conversation_id: conversationId, p_client_id: retryId, p_body: "Now we can talk" }),
    winner.client.rpc("chat_send", { p_conversation_id: conversationId, p_client_id: randomUUID(), p_body: "Ordered after acceptance" }),
  ]);
  assert.ifError(sentA.error); assert.ifError(sentB.error);
  assert.notEqual(sentA.data.sequence, sentB.data.sequence, "concurrent sends receive unique order");
  const replay = await rpc(winner.client, "chat_send", {
    p_conversation_id: conversationId, p_client_id: retryId, p_body: "Now we can talk",
  });
  assert.equal(replay.message_id, sentA.data.message_id, "retry returns same message");
  const { count } = await admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
  assert.equal(count, 3, "no duplicates after concurrent sends and replay");

  const removedConnection = await admin.from("connections").delete().eq("id", abConnectionId);
  assert.ifError(removedConnection.error);
  await rpc(winner.client, "chat_send", {
    p_conversation_id: conversationId, p_client_id: randomUUID(), p_body: "Our accepted chat continues",
  });

  await rpc(recipient.client, "chat_block", { p_user_id: winner.id });
  const blocked = await winner.client.rpc("chat_send", {
    p_conversation_id: conversationId, p_client_id: randomUUID(), p_body: "Should fail",
  });
  assert.ok(blocked.error, "block prevents delivery");
  const { data: leaked } = await winner.client.from("chat_blocks").select("blocker_id").eq("blocker_id", recipient.id);
  assert.equal(leaked?.length, 0, "blocked member cannot inspect blocker state");

  await rpc(b.client, "chat_set_requests_enabled", { p_enabled: false });
  const disallowed = await c.client.rpc("chat_start_request", {
    p_target_id: b.id, p_client_id: randomUUID(), p_body: "Should fail",
  });
  assert.ok(disallowed.error, "privacy setting blocks requests");

  const request = await rpc(c.client, "chat_start_request", {
    p_target_id: a.id, p_client_id: randomUUID(), p_body: "Hello Alice",
  });
  await rpc(a.client, "chat_decide_request", { p_conversation_id: request.conversation_id, p_action: "decline" });
  const repeat = await c.client.rpc("chat_start_request", {
    p_target_id: a.id, p_client_id: randomUUID(), p_body: "Again",
  });
  assert.ok(repeat.error, "decline prevents repeat requests");
  const reopened = await rpc(a.client, "chat_start_request", {
    p_target_id: c.id, p_client_id: randomUUID(), p_body: "I want to reopen",
  });
  assert.equal(reopened.conversation_id, request.conversation_id, "recipient may initiate explicitly");

  const { data: ownMessages } = await recipient.client.from("chat_messages")
    .select("id,sender_id").eq("conversation_id", conversationId);
  const reported = ownMessages.find((message) => message.sender_id === winner.id);
  assert.ok(reported);
  await rpc(recipient.client, "chat_report", {
    p_conversation_id: conversationId, p_message_id: reported.id, p_reason: "spam", p_details: null,
  });
  const { data: unauthorizedEvidence } = await c.client.from("chat_messages").select("id").eq("conversation_id", conversationId);
  assert.equal(unauthorizedEvidence.length, 0, "unrelated user cannot read the thread");

  const deleted = await admin.auth.admin.deleteUser(winner.id);
  assert.ifError(deleted.error);
  users.splice(users.indexOf(winner.id), 1);
  const { count: remaining } = await admin.from("chat_messages").select("id", { count: "exact", head: true }).eq("conversation_id", conversationId);
  assert.equal(remaining, 0, "account deletion removes shared conversation content");
  process.stdout.write("Connect Chat local multi-account E2E passed.\n");
} finally {
  await Promise.allSettled(users.map((id) => admin.auth.admin.deleteUser(id)));
}

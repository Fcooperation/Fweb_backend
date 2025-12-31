// fchat_send_message.js
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2VjZV9yb2xlIiwiaWF0IjoxNzUxOTI4Mzg3LCJleHAiOjIwNjc1MDQzODd9.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Send and save a chat message
 * @param {Object} msg - The message JSON from frontend
 * Should include: id, sender_id, receiver_id, message, linked (optional), linked_message_id (optional), sent_at
 */
export async function fchat_send_message(msg) {
  const { receiver_id, id, sender_id, message, linked, linked_message_id, sent_at } = msg;

  // Validate required fields
  if (!receiver_id || !id || !sender_id || !message || !sent_at) {
    throw new Error("Missing required fields for sending message");
  }

  // Fetch current messages from receiver
  const { data: receiverData, error: fetchErr } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", receiver_id)
    .maybeSingle();

  if (fetchErr) {
    console.error("❌ Receiver fetch error:", fetchErr);
    throw fetchErr;
  }

  // Parse existing messages or fallback
  let messagesArray = [];
  try {
    messagesArray = receiverData?.messages ? JSON.parse(receiverData.messages) : [];
  } catch {
    messagesArray = [];
  }

  // Create new message object
  const newMessage = {
    id,
    sender_id,
    message,
    linked: linked || "no",
    linked_message_id: linked_message_id || null,
    sent_at,
    status: "delivered" // backend always marks as delivered
  };

  // Append new message
  messagesArray.push(newMessage);

  // Update receiver's messages column
  const { error: updErr } = await supabase
    .from("fwebaccount")
    .update({ messages: JSON.stringify(messagesArray) })
    .eq("id", receiver_id);

  if (updErr) {
    console.error("❌ Failed to save message:", updErr);
    throw updErr;
  }

  console.log("✅ Message sent successfully:", newMessage);
  return { success: true, message: "Message sent", newMessage };
}

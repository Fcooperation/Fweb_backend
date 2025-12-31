// fchat_send_message.js
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Save a chat message to Supabase
 * @param {Object} msg - The message JSON
 * msg should have: sender_id, receiver_id, message, id, linked (optional), linked_message_id (optional), sent_at
 */
export async function fchat_send_message(msg) {
  // Validate required fields
  if (!msg || !msg.sender_id || !msg.receiver_id || !msg.message) {
    throw new Error("Incomplete message JSON");
  }

  // Fetch existing messages for the receiver
  const { data: userData, error: fetchError } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", msg.receiver_id)
    .single();

  if (fetchError) {
    console.error("❌ Error fetching receiver messages:", fetchError);
    throw fetchError;
  }

  // Parse existing messages or start a new array
  let messages = [];
  try {
    messages = userData?.messages ? JSON.parse(userData.messages) : [];
  } catch (e) {
    console.warn("⚠️ Existing messages corrupted, resetting:", e);
    messages = [];
  }

  // Append the new message
  messages.push(msg);

  // Update the receiver's messages column
  const { error: updateError } = await supabase
    .from("fwebaccount")
    .update({ messages: JSON.stringify(messages) })
    .eq("id", msg.receiver_id);

  if (updateError) {
    console.error("❌ Error saving message to Supabase:", updateError);
    throw updateError;
  }

  console.log("✅ Message saved successfully for receiver:", msg.receiver_id);
  return { status: "ok", message: "Message saved", msg };
         }

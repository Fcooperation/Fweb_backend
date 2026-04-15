if { createClient } from "@supabase/supabase-js";
import 'dotenv/config'; // ✅ This loads your variables

// Supabase client - Now pulled from the environment
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Missing Supabase Environment Variables!");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleFChat(body) {
  try {
    console.log("📩 FCHAT received:", body);
    const { action, email, password } = body;

    if (!action) return { error: "No action provided" };

     .from("fwebaccount")
  
    // --------------------  
// Dashboard / Account actions  
// --------------------  
if (
  [
    "check_status",
    "update_pic",
    "update_details",
    "delete_account",
    "check_fchat_access"
  ].includes(action)
) {
  // Fetch account
  const { data: account, error: accError } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (accError || !account) return { error: "Account not found" };

  // --------------------
  // Check status (banned/suspended)
  // --------------------
  let status = account.status || "active";
  let suspendedUntil = account.suspended_until ? new Date(account.suspended_until) : null;
  const now = new Date();

  if (status === "suspended" && suspendedUntil && suspendedUntil <= now) {
    // Reactivate expired suspension
    await supabase
      .from("fwebaccount")
      .update({ status: "active" })
      .eq("email", email);
    status = "active";
  }

  // --------------------
  // Handle specific actions
  // --------------------
  if (action === "check_status") {
    return {
      status,
      suspended_until: suspendedUntil,
      banned: status === "banned",
      message: "Account status checked",
    };
  }

      if (action === "update_status_text") {
  const { status_text } = body;

  if (!status_text || typeof status_text !== "string") {
    return { error: "No status text provided" };
  }

  // Update status_text for this email
  const { data: updatedAccount, error: updateError } = await supabase
    .from("fwebaccount")
    .update({ status_text })
    .eq("email", email)
    .select()
    .maybeSingle();

  if (updateError || !updatedAccount) {
    return { error: "Failed to update status text" };
  }

  return {
    success: true,
    message: "Status text updated successfully",
    status_text: updatedAccount.status_text,
    status // keep consistency with your other responses
  };
    }

  if (action === "update_broadcast") {
  const { broadcast } = body;

  // broadcast can be "yes" or null
  const broadcastValue = broadcast === "yes" ? "yes" : null;

  const { data: updatedAccount, error: updateError } = await supabase
    .from("fwebaccount")
    .update({ broadcast: broadcastValue })
    .eq("email", email)
    .select()
    .maybeSingle();

  if (updateError || !updatedAccount) {
    return { error: "Failed to update broadcast status" };
  }

  return {
    success: true,
    message: "Broadcast status updated successfully",
    broadcast: updatedAccount.broadcast,
    status // keep sending account status like your other actions
  };
  }

  if (action === "update_pic") {
    const { profile_pic } = body;
    if (!profile_pic) return { error: "No image provided" };

    const { data: updatedPic, error: picError } = await supabase
      .from("fwebaccount")
      .update({ profile_pic })
      .eq("email", email)
      .select()
      .maybeSingle();

    if (picError || !updatedPic) return { error: "Failed to update profile picture" };

    return {
      success: true,
      message: "Profile picture updated successfully",
      profile_pic: updatedPic.profile_pic,
      status // always send status
    };
  }

 if (action === "update_details") {
  const { username, password_hash, dob, bio, fchat } = body;
  const updates = {};
  if (username) updates.username = username;
  if (password_hash) updates.password_hash = password_hash;
  if (dob) updates.dob = dob;
  if (bio) updates.bio = bio;
  if (fchat) updates.fchat = fchat;

  if (Object.keys(updates).length === 0) return { error: "No details to update" };

  const { data: updatedDetails, error: updError } = await supabase
    .from("fwebaccount")
    .update(updates)
    .eq("email", email)
    .select()
    .maybeSingle();

  if (updError || !updatedDetails) return { error: "Failed to update details" };

  return {
    success: true,
    message: "Account details updated successfully",
    ...updatedDetails
  };
     }

  if (action === "delete_account") {
    const { error: delError } = await supabase
      .from("fwebaccount")
      .delete()
      .eq("email", email);

    if (delError) return { error: "Failed to delete account" };

    return { success: true, message: "Account deleted successfully" };
  }

  if (action === "check_fchat_access") {
    // Active status is required
    const canAccess = status === "active" && account.fchat?.toLowerCase() === "yes";
    return {
      fchat: canAccess ? "yes" : "no",
      status,
      banned: status === "banned",
      suspended_until: suspendedUntil
    };
  }
}


// Get only broadcast users
if (action === "get_broadcast_users") {
  const { data, error } = await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic, fchat, status_text, broadcast")
    .eq("broadcast", "yes");

  if (error) return { error: "Failed to load broadcast users" };
  return { data };
}

// Get ALL users (broadcast + non-broadcast)
if (action === "get_all_users") {
  try {
    // Fetch all users with friend_requests and fchat_messages included
    const { data: allUsers, error } = await supabase
      .from("fwebaccount")
      .select("id, username, profile_pic, fchat, status_text, broadcast, friend_requests, fchat_messages");

    if (error) return { error: "Failed to load all users" };

    // Simply return all users
    return { data: allUsers };

  } catch (err) {
    console.error("Error fetching all users:", err);
    return { error: "Something went wrong while fetching users" };
  }
  }
    // --------------------
// Add user / Verify users for FCHAT
// --------------------
if (action === "add_user") {
  const { invite_id, my_id } = body;
  if (!invite_id || !my_id) return { error: "invite_id or my_id missing" };

  // Fetch the target user
  const { data: targetUser, error: fetchError } = await supabase
    .from("fwebaccount")
    .select("id, friend_requests")
    .eq("id", invite_id)
    .maybeSingle();

  if (fetchError || !targetUser) return { error: "Target user not found" };

  // Initialize friend_requests string if missing
  let updatedRequests = targetUser.friend_requests || ""; // empty string if null

  // Convert to array to check duplicates
  const requestIds = updatedRequests ? updatedRequests.split(",") : [];

  if (!requestIds.includes(my_id.toString())) {
    requestIds.push(my_id.toString()); // add new ID
    updatedRequests = requestIds.join(","); // convert back to comma-separated string

    const { error: updateError } = await supabase
      .from("fwebaccount")
      .update({ friend_requests: updatedRequests })
      .eq("id", invite_id);

    if (updateError) return { error: "Failed to add friend request" };
  }

  return { message: "Friend request sent", friend_requests: updatedRequests };
        }

    // --------------------
// FCHAT FRIEND REQUESTS HANDLER
// --------------------
if (["get_requesters", "accept", "reject"].includes(action)) {
  const faccount = await supabase
    .from("fwebaccount")
    .select("id, friend_requests, fchat_messages")
    .eq("email", email)
    .maybeSingle();

  if (!faccount.data) return { error: "Account not found" };
  const myId = faccount.data.id;

  // Convert friend_requests string to array
  let requests = faccount.data.friend_requests
    ? faccount.data.friend_requests.split(",").map(s => s.trim()).filter(Boolean)
    : [];

  // -------------------- GET REQUESTERS --------------------
  if (action === "get_requesters") {
    if (requests.length === 0) return { data: [] };

    const { data: requestUsers, error: reqErr } = await supabase
      .from("fwebaccount")
      .select("id, username, profile_pic, status_text")
      .in("id", requests);

    if (reqErr) return { error: "Failed to fetch requesters" };

    return { data: requestUsers || [] };
  }

// -------------------- ACCEPT --------------------
if (action === "accept") {
  const { user_id } = body; // the ID of the requester
  if (!user_id) return { error: "user_id required for accept" };

  const myId = faccount.data.id.toString(); // YOUR ID as string

  // 1️⃣ Add accepted user's ID to my fchat_messages
  const fchatMessages = faccount.data.fchat_messages
    ? faccount.data.fchat_messages.split(",").map(s => s.trim()).filter(Boolean)
    : [];
  if (!fchatMessages.includes(user_id.toString())) fchatMessages.push(user_id.toString());

  // 2️⃣ Remove from friend_requests
  requests = requests.filter(id => id !== user_id.toString());

  // 3️⃣ Update my record
  const { error: updErr } = await supabase
    .from("fwebaccount")
    .update({
      fchat_messages: fchatMessages.join(","),
      friend_requests: requests.join(",")
    })
    .eq("email", email);
  if (updErr) return { error: "Failed to accept request" };

  // 4️⃣ Add MY ID to the other user's fchat_messages
  const { data: otherUser, error: otherErr } = await supabase
    .from("fwebaccount")
    .select("fchat_messages")
    .eq("id", user_id)
    .maybeSingle();

  if (otherErr) {
    console.error("Failed to fetch other user:", otherErr);
  } else {
    const otherFchat = otherUser?.fchat_messages
      ? otherUser.fchat_messages.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    if (!otherFchat.includes(myId)) otherFchat.push(myId);

    const { error: updateOtherErr } = await supabase
      .from("fwebaccount")
      .update({ fchat_messages: otherFchat.join(",") })
      .eq("id", user_id);

    if (updateOtherErr) console.error("Failed to add my ID to other user:", updateOtherErr);
  }

  return {
    message: "Accepted successfully",
    fchat_messages: fchatMessages,
    friend_requests: requests
  };
}
  // -------------------- REJECT --------------------
  if (action === "reject") {
    const { user_id } = body;
    if (!user_id) return { error: "user_id required for reject" };

    // Remove from friend_requests
    requests = requests.filter(id => id !== user_id.toString());

    const { error: rejErr } = await supabase
      .from("fwebaccount")
      .update({ friend_requests: requests.join(",") })
      .eq("email", email);

    if (rejErr) return { error: "Failed to reject request" };

    return { message: "Rejected successfully", friend_requests: requests };
  }
  }
// --------------------
// Get all FCHAT friends/chats
// --------------------
if (action === "get_all_fchatters") {
  if (!email) return { error: "Email required" };

  // 1️⃣ Get the user's fchat_messages
  const { data: myAccount, error: accErr } = await supabase
    .from("fwebaccount")
    .select("fchat_messages")
    .eq("email", email)
    .maybeSingle();

  if (accErr || !myAccount) return { error: "Account not found" };

  const fchatIds = myAccount.fchat_messages
    ? myAccount.fchat_messages.split(",").map(id => id.trim()).filter(Boolean)
    : [];

  if (fchatIds.length === 0) return { data: [] }; // no friends

  // 2️⃣ Fetch all the users in fchat_messages
  const { data: fchatUsers, error: usersErr } = await supabase
    .from("fwebaccount")
    .select("id, username, profile_pic, status_text")
    .in("id", fchatIds);

  if (usersErr) return { error: "Failed to fetch fchatters" };

  // 3️⃣ Return to frontend
  return { data: fchatUsers || [] };
}
    // --------------------
// Verify if account exists
// --------------------
if (action === "verify_account") {
  if (!email) return { error: "Email required" };
  const { data, error } = await supabase
    .from("fwebaccount")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { exists: false };
  return { exists: true };
    }
// --------------------
// Handle sending messages (WITH LINK SUPPORT)
// --------------------
if (action === "send_messages") {
  const { receiver_id, sender_id, text, id, linked, linked_message_id } = body;

  if (!receiver_id || !sender_id || !text) {
    return { error: "Missing required fields for sending message" };
  }

  // ✅ Insert into messages table (INCLUDING LINK DATA)
  const { data, error } = await supabase
    .from("messages")
    .insert({
      id,
      sender_id,
      receiver_id,
      message: text,
      linked: linked || false,
      linked_message_id: linked_message_id || null
    })
    .select()
    .single();

  if (error) {
    console.error("Insert error:", error);
    return { error: "Failed to send message" };
  }

  // ✅ Return full saved message (now includes linked fields)
  return {
    success: true,
    message: "Message sent",
    newMessage: data
  };
}

    // Hamdle votes 

    if (action === "vote_polls") {
  const { poll_id, sender_id, receiver_id, option_voted } = body;

  // Basic validation
  if (!poll_id || !sender_id || !receiver_id || !option_voted) {
    return {
      error: "Missing required fields for voting poll"
    };
  }

  // ✅ For now, we don't store anything
  // Just acknowledge the vote was received

  return {
    success: true,
    message: "Vote received successfully"
  };
         }
    

    // Messages Reaction Function
if (action === "react_to_messages") {

  const { receiver_id, reaction_payload } = body;

  if (!receiver_id || !reaction_payload) {
    return { error: "Missing required fields" };
  }

  // Add receiver_id into payload storage
  const newReaction = {
    ...reaction_payload,
    receiver_id
  };

  // 1️⃣ Get existing messages
  const { data, error: fetchError } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", receiver_id)
    .single();

  if (fetchError) return { error: "Failed to fetch existing messages" };

  // 2️⃣ Parse existing messages safely
  let existingMessages = [];

  try {
    existingMessages = data.messages ? JSON.parse(data.messages) : [];

    if (!Array.isArray(existingMessages)) {
      existingMessages = [];
    }

  } catch (e) {
    existingMessages = [];
  }

  // ===============================
  // ⭐ RE-REACTION OVERWRITE LOGIC
  // ===============================

  existingMessages = existingMessages.filter(msg => {

    // Keep message if:
    // NOT same message_id AND NOT same sender_id

    if (!msg || !msg.message_id || !msg.sender_id) return true;

    return !(
      msg.message_id === newReaction.message_id &&
      msg.sender_id === newReaction.sender_id
    );

  });

  // Add new reaction
  existingMessages.push(newReaction);

  // 4️⃣ Save back to Supabase
  const { error: updateError } = await supabase
    .from("fwebaccount")
    .update({
      messages: JSON.stringify(existingMessages)
    })
    .eq("id", receiver_id);

  if (updateError) return { error: "Failed to save reaction" };

  return { success: true };
    }
    
// --------------------
// Delete messages for a specific user (by ID)
// --------------------
if (action === "delete_messages") {
  if (!email) return { error: "You must be logged in" };

  const { ids, user_id } = body;

  if (!user_id) {
    return { error: "User ID is required" };
  }

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { error: "No message IDs provided" };
  }

  // 1️⃣ Confirm logged-in account exists (AUTH CHECK)
  const { data: authUser, error: authErr } = await supabase
    .from("fwebaccount")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (authErr || !authUser) {
    return { error: "Unauthorized account" };
  }

  // 2️⃣ Fetch messages of the TARGET user (by ID)
  const { data: targetUser, error: fetchErr } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", user_id)
    .maybeSingle();

  if (fetchErr || !targetUser) {
    return { error: "Target account not found" };
  }

  let messagesArray = [];
  try {
    messagesArray = targetUser.messages
      ? JSON.parse(targetUser.messages)
      : [];
  } catch {
    messagesArray = [];
  }

  // 3️⃣ Delete selected messages
  const deletedMessages = [];
  const remainingMessages = messagesArray.filter(msg => {
    if (ids.includes(msg.id)) {
      deletedMessages.push(msg);
      return false;
    }
    return true;
  });

  // 4️⃣ Update TARGET user's messages
  const { error: updErr } = await supabase
    .from("fwebaccount")
    .update({ messages: JSON.stringify(remainingMessages) })
    .eq("id", user_id);

  if (updErr) return { error: "Failed to delete messages" };

  return {
    success: true,
    message: "Messages deleted successfully",
    deleted: deletedMessages
  };
          }
    // --------------------
// Handle sending polls (UPDATED + CONSISTENT)
// --------------------
if (action === "send_polls") {

  // ✅ Accept both formats safely
  const {
    id,
    question,
    options,
    allowMultiple,
    sender_id,
    receiver_id,
    sent_at
  } = body;

  // 🚫 Strict validation
  if (
    !id ||
    !question ||
    !Array.isArray(options) ||
    typeof allowMultiple !== "boolean" ||
    !sender_id ||
    !receiver_id
  ) {
    console.log("❌ Missing required fields for poll:", body);
    return { error: "Missing required fields for sending poll" };
  }

  try {
    // 1️⃣ Fetch receiver account
    const { data: receiverData, error: fetchErr } = await supabase
      .from("fwebaccount")
      .select("polls")
      .eq("id", receiver_id)
      .maybeSingle();

    if (fetchErr || !receiverData) {
      console.log("❌ Receiver not found:", fetchErr);
      return { error: "Receiver not found" };
    }

    // 2️⃣ Parse existing polls
    let pollsArray = [];
    try {
      pollsArray = receiverData.polls
        ? JSON.parse(receiverData.polls)
        : [];
    } catch (e) {
      console.warn("⚠️ Polls JSON corrupted, resetting");
      pollsArray = [];
    }

    // 3️⃣ Create MESSAGE-SHAPED poll
    const newPoll = {
      id,
      sender_id,
      receiver_id,
      sent_at: sent_at || new Date().toISOString(),
      isPoll: true,
      pollData: {
        id,
        question,
        options,
        allowMultiple
      }
    };

    pollsArray.push(newPoll);

    // 4️⃣ Save back to DB
    const { error: updErr } = await supabase
      .from("fwebaccount")
      .update({ polls: JSON.stringify(pollsArray) })
      .eq("id", receiver_id);

    if (updErr) {
      console.error("❌ Failed to update polls:", updErr);
      return { error: "Failed to save poll" };
    }

    console.log("✅ Poll saved successfully");

    return {
      success: true,
      message: "Poll sent",
      poll: newPoll
    };

  } catch (err) {
    console.error("❌ send_polls error:", err);
    return { error: "send_polls failed", details: err.message };
  }
}
    // ================================
// FCHAT RECEIVER & SYNC ENGINE
// ================================
if (action === "get_all_fchatlogs") {
  const { id, chatwithid, typing, last_seen } = body;
  if (!id) {
    return { error: "Missing id" };
  }

  // ================================
// UPDATE USER ACTIVITY LOGS
// ================================

const logsObject = {
  status: "active",
  chat: chatwithid || null,
  typing: typing === "yes",
  time: last_seen || new Date().toISOString() // use frontend last_seen if available
};

await supabase
  .from("fwebaccount")
  .update({
    logs: JSON.stringify(logsObject),
    last_seen: last_seen || new Date().toISOString() // save frontend last_seen
  })
  .eq("id", id);
  try {
    
    // Fetch messages from messages table
const { data: messagesData, error: msgErr } = await supabase
  .from("messages")
  .select("*")
  .eq("receiver_id", id) // 🔥 THIS is your condition
  .order("created_at", { ascending: true });

if (msgErr) {
  return { error: "Failed to fetch messages" };
}

    // ================================
// FETCH CHAT PARTNER STATUS
// ================================
let partnerStatus = null;

if (chatwithid) {

  const { data: partnerData, error: partnerErr } = await supabase
  .from("fwebaccount")
  .select("logs, last_seen, seen")
  .eq("id", chatwithid)
  .maybeSingle();

  if (!partnerErr && partnerData) {

    try {
      partnerStatus = {
  logs: partnerData.logs ? JSON.parse(partnerData.logs) : null,
  last_seen: partnerData.last_seen,
  seen_messages: partnerData.seen ? JSON.parse(partnerData.seen) : []
};
    } catch (e) {
      console.error("Failed to parse partner logs:", e);
    }

  }

        }

    // 3️⃣ Fetch all users' polls & votes (SEPARATED)
const { data: usersData, error: usersErr } = await supabase
  .from("fwebaccount")
  .select("polls");

let allPolls = [];
let allVotes = [];

if (!usersErr && usersData) {
  usersData.forEach(user => {
    if (!user.polls) return;

    try {
      const parsed = JSON.parse(user.polls);

      parsed.forEach(item => {
        // ✅ REAL POLL
        if (item.pollData && item.id) {
          allPolls.push(item);
        }

        // ✅ VOTE OBJECT
        else if (item.poll_id && item.options && item.voted_at) {
          allVotes.push(item);
        }
      });

    } catch (e) {
      console.error("Failed to parse polls JSON for user:", e);
    }
  });
}
// 4️⃣ Return cleanly separated data
return {
  messages: messagesData || [],
reactions: [],
  polls: allPolls,
  votes: allVotes,
  partner_status: partnerStatus
};
    

  } catch (err) {
    console.error("Error fetching FCHAT logs:", err);
    return { error: "Failed to fetch chat logs" };
  }
}
    
// --------------------
// Handle poll voting (FORCE SAVE + LOGS + REWRITE)
// --------------------
if (action === "send_votes") {
  console.log("📩 Incoming vote payload:", body);

  const { poll_id, sender_id, receiver_id, options } = body;

  const votePayload = {
  poll_id,
  sender_id,
  receiver_id,
  options,
  voted_at: new Date().toISOString()
};

  console.log("🗳️ Vote object prepared:", votePayload);

  // 1️⃣ Fetch receiver polls
  const { data, error: fetchErr } = await supabase
    .from("fwebaccount")
    .select("polls")
    .eq("id", receiver_id)
    .maybeSingle();

  if (fetchErr) {
    console.error("❌ Failed to fetch receiver polls:", fetchErr);
    return { error: "Failed to fetch receiver data" };
  }

  let pollsArray = [];
  try {
    pollsArray = data?.polls ? JSON.parse(data.polls) : [];
  } catch (err) {
    console.warn("⚠️ Polls JSON corrupted, resetting:", err);
    pollsArray = [];
  }

  console.log("📦 Existing polls before rewrite:", pollsArray);

  // 2️⃣ Rewrite vote (delete old, insert new)
  pollsArray = pollsArray.filter(p =>
    !(p.poll_id === poll_id && p.sender_id === sender_id)
  );

  pollsArray.unshift(votePayload);

  console.log("♻️ Polls after rewrite:", pollsArray);

  // 3️⃣ Save back to receiver
  const { error: saveErr } = await supabase
    .from("fwebaccount")
    .update({
      polls: JSON.stringify(pollsArray)
    })
    .eq("id", receiver_id);

  if (saveErr) {
    console.error("❌ Failed to save vote:", saveErr);
    return { error: "Failed to save vote" };
  }

  console.log("✅ Vote rewritten successfully for receiver:", receiver_id);

  return {
    success: true,
    message: "Vote rewritten successfully",
    votePayload
  };
}
    //Received messages logic 
    if (action === "received_messages") {
      const { ids, status, sender_id, receiver_id } = body;

      if (!ids || !receiver_id) {
        return { error: "Missing required fields for received_messages" };
      }

      // 1️⃣ Fetch current seen logs for the receiver
      const { data, error: fetchErr } = await supabase
        .from("fwebaccount")
        .select("seen")
        .eq("id", receiver_id)
        .maybeSingle();

      if (fetchErr) {
        console.error("❌ Failed to fetch receiver seen logs:", fetchErr);
        return { error: "Failed to fetch receiver data" };
      }

      let seenArray = [];
      try {
        // Handle potential null or corrupted JSON
        seenArray = data?.seen ? JSON.parse(data.seen) : [];
      } catch (err) {
        console.warn("⚠️ Seen JSON corrupted, resetting:", err);
        seenArray = [];
      }

      // 2️⃣ Prepare ONLY latest seen log
const updatedSeen = [{
  message_id: ids[ids.length - 1],
  status: status || "seen",
  sender_id: sender_id,
  timestamp: Date.now()
}];

// 3️⃣ Save (overwrite)
const { error: saveErr } = await supabase
  .from("fwebaccount")
  .update({
    seen: JSON.stringify(updatedSeen)
  })
  .eq("id", receiver_id);

      if (saveErr) {
        console.error("❌ Failed to save seen status:", saveErr);
        return { error: "Failed to update seen column" };
      }

      console.log(`✅ Marked ${ids.length} messages as seen for receiver:`, receiver_id);
      return { success: true, count: ids.length };
      }

    // --------------------
// Delete for Everyone (Backend Handler)
// --------------------
if (action === "delete_for_everyone") {
  const { chat_id, message_ids, requested_by } = body;

  if (!chat_id || !message_ids || !Array.isArray(message_ids)) {
    return { error: "Missing required fields for delete for everyone" };
  }

  try {
    // 1️⃣ Fetch the TARGET user's account (the receiver)
    // In "Delete for Everyone", the chat_id is the person who should see the deletion
    const { data: targetUser, error: fetchErr } = await supabase
      .from("fwebaccount")
      .select("messages")
      .eq("id", chat_id)
      .maybeSingle();

    if (fetchErr || !targetUser) {
      return { error: "Target chat partner not found" };
    }

    // 2️⃣ Parse their existing messages
    let messagesArray = [];
    try {
      messagesArray = targetUser.messages ? JSON.parse(targetUser.messages) : [];
    } catch (e) {
      messagesArray = [];
    }

    // 3️⃣ Loop through and update the status of the specific messages
    // Instead of completely removing the JSON, we update it so the UI knows it was deleted
    const updatedMessages = messagesArray.map(msg => {
      if (message_ids.includes(msg.id)) {
        return {
  ...msg,
  text: "",
  status: "deleted",
  deleted: true,
  deleted_for: "everyone",
  requested_by: requested_by   // ✅ ADD THIS
};
      }
      return msg;
    });

    // 4️⃣ Save the updated messages back to the Target User's column
    const { error: updErr } = await supabase
      .from("fwebaccount")
      .update({ messages: JSON.stringify(updatedMessages) })
      .eq("id", chat_id);

    if (updErr) {
      console.error("❌ Failed to update target messages:", updErr);
      return { error: "Failed to sync deletion to partner" };
    }

    // 5️⃣ Send success back to the frontend
    return { 
      success: true, 
      message: "Messages deleted for everyone",
      deleted_ids: message_ids 
    };

  } catch (err) {
    console.error("❌ delete_for_everyone error:", err);
    return { error: "Internal server error during deletion" };
  }
  }
         
          
    return { message: "Action not supported yet" };

  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
      }        
}

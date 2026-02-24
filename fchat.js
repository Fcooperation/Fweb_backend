import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ"; // Replace with your hardcoded key or env variable
const supabase = createClient(supabaseUrl, supabaseKey);

export async function handleFChat(body) {
  try {
    console.log("📩 FCHAT received:", body);
    const { action, email, password } = body;

    if (!action) return { error: "No action provided" };

    if (action === "login") {
      if (!email || !password) {
        return { error: "Missing email or password" };
      }

      // Fetch account from Supabase
      const { data, error } = await supabase
        .from("fwebaccount")
        .select("*")
        .eq("email", email)
        .single();

      if (error || !data) {
        return { error: "Account not found" };
      }

      // Check password
      if (data.password_hash !== password) {
        return { error: "Invalid password" };
      }

      // Check account status
      const nowUTC = new Date();
      let responseStatus = data.status;

      if (data.status === "suspended") {
        const suspendedUntil = data.suspended_until ? new Date(data.suspended_until) : null;
        if (suspendedUntil && suspendedUntil <= nowUTC) {
          // Suspension expired → reactivate
          await supabase
            .from("fwebaccount")
            .update({ status: "active" })
            .eq("email", email);
          responseStatus = "active";
        }
      }

      // Return full account details including status
      return {
        message: "Login processed",
        status: responseStatus,
        user: data // full row from Supabase, frontend can save to localStorage
      };
    }
    if (action === "signup") {
const { username, full_name, secret } = body;

// Basic validation
if (!email || !password || !username || !full_name || !secret) {
return { error: "Please provide all required fields" };
}

// Check if email already exists
const { data: existingUser, error: checkError } = await supabase
.from("fwebaccount")
.select("*")
.eq("email", email)
.maybeSingle();

if (checkError) {
console.error("Error checking existing email:", checkError);
return { error: "Error checking email" };
}

if (existingUser) {
return { error: "Email already exists. Please login." };
}

// Generate a unique numeric ID (up to 15 digits)
let uniqueId;
while (true) {
uniqueId = Math.floor(Math.random() * 1e15);
const { data: idCheck } = await supabase
.from("fwebaccount")
.select("id")
.eq("id", uniqueId)
.maybeSingle();
if (!idCheck) break; // ID is unique
}

// Insert new account
const { data: newUser, error: insertError } = await supabase
.from("fwebaccount")
.insert([
{
id: uniqueId,
username,
full_name,
email,
password_hash: password,
secret,
status: "active"
}
])
.select()
.maybeSingle();

if (insertError || !newUser) {
console.error("Error creating account:", insertError);
return { error: "Failed to create account" };
}

// Return success message and full user details
return {
status: "success",
message: "Account created successfully. You can now login.",
user: newUser
};
  }
    // --------------------
// Forget Password: Step 1 - check email exists
// --------------------
if (action === "forgetpassword") {
  if (!email) return { error: "Email is required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { error: "Email not found" };

  // Don't send password, just acknowledge
  return { message: "Email exists. Please enter your secret code." };
}

// --------------------
// Verify secret code
// --------------------
if (action === "verifysecret") {
  const { secret } = body;
  if (!email || !secret) return { error: "Email and secret are required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error || !data) return { error: "Account not found" };
  if (data.secret !== secret) return { error: "Secret code does not match" };

  return { message: "Secret verified" };
}

// --------------------
// Change password
// --------------------
if (action === "changepassword") {
  const { new_password } = body;
  if (!email || !new_password) return { error: "Email and new password required" };

  const { data, error } = await supabase
    .from("fwebaccount")
    .update({ password_hash: new_password })
    .eq("email", email)
    .select()
    .maybeSingle();

  if (error || !data) return { error: "Failed to update password" };

  return { message: "Password changed successfully" };
}
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
// Handle sending messages
// --------------------
if (action === "send_messages") {
  const { receiver_id, id, sender_id, text, linked, linked_message_id, sent_at } = body;
  if (!receiver_id || !id || !sender_id || !text) {
    return { error: "Missing required fields for sending message" };
  }

  // Fetch current messages from receiver
  const { data: receiverData, error: fetchErr } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", receiver_id)
    .maybeSingle();

  if (fetchErr) return { error: "Receiver not found" };

  let messagesArray = [];
  try {
    messagesArray = receiverData?.messages ? JSON.parse(receiverData.messages) : [];
  } catch (e) {
    messagesArray = []; // fallback if corrupted
  }

  // Append new message
  const newMessage = {
  id,
  sender_id,
  receiver_id,       // <— add this
  text,
  linked: linked || false,
  linked_message_id: linked_message_id || null,
  sent_at,
  status: "delivered"
};
  messagesArray.push(newMessage);

  // Update receiver's messages column
  const { error: updErr } = await supabase
    .from("fwebaccount")
    .update({ messages: JSON.stringify(messagesArray) })
    .eq("id", receiver_id);

  if (updErr) return { error: "Failed to save message" };

  return { success: true, message: "Message sent", newMessage };
      }

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

  // 1️⃣ Get existing messages
  const { data, error: fetchError } = await supabase
    .from("fwebaccount")
    .select("messages")
    .eq("id", receiver_id)
    .single();

  if (fetchError) return { error: "Failed to fetch existing messages" };

  // 2️⃣ Parse existing messages safely
  let existingMessages = [];

  if (data.messages) {
    try {
      existingMessages = JSON.parse(data.messages);
      if (!Array.isArray(existingMessages)) {
        existingMessages = [];
      }
    } catch (e) {
      existingMessages = [];
    }
  }

  // 3️⃣ Add new reaction
  existingMessages.push(reaction_payload);

  // 4️⃣ Save back to Supabase
  const { error: updateError } = await supabase
    .from("fwebaccount")
    .update({ messages: JSON.stringify(existingMessages) })
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
  const { id } = body; // frontend sends ONLY account.id

  if (!id) {
    return { error: "Missing id" };
  }

  try {
    // 1️⃣ Fetch the account from Supabase
    const { data: accountData, error: accErr } = await supabase
      .from("fwebaccount")
      .select("messages")
      .eq("id", id)
      .maybeSingle();

    if (accErr || !accountData) {
      return { error: "Account not found" };
    }

    // 2️⃣ Parse messages safely
    let allMessages = [];
    try {
      allMessages = accountData.messages
        ? JSON.parse(accountData.messages)
        : [];
    } catch (e) {
      console.error("Failed to parse messages JSON:", e);
      allMessages = [];
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
  messages: allMessages,
  polls: allPolls,
  votes: allVotes
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
    return { message: "Action not supported yet" };

  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
      }        
}

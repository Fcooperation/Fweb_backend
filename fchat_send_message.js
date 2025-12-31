import { fchat_send_message } from "./fchat_send_message.js";

// Route to send message
app.post("/fchat_send_message", async (req, res) => {
  const msg = req.body;

  // Check if JSON is complete
  if (!msg || !msg.sender_id || !msg.receiver_id || !msg.message) {
    return res.status(400).json({ error: "Incomplete message payload" });
  }

  try {
    // Call the imported function
    const result = await fchat_send_message(msg);

    console.log("👋 Message processed successfully!");
    res.json({ success: true, result });
  } catch (err) {
    console.error("❌ Error processing message:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

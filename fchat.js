// fchat.js

export async function handleFChat(body) {
  try {
    // For now, just log the incoming JSON
    console.log("📩 FCHAT received:", body);

    // You can inspect action, email, password etc.
    const { action } = body;
    console.log("Action:", action);

    // For now, just respond "hi"
    return { message: "hi" };
  } catch (err) {
    console.error("❌ handleFChat error:", err);
    return { error: "Something went wrong" };
  }
}

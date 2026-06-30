export default async function fInbox(body) {

  console.log("📬 Inbox request received:", body);

  return {
    success: true,
    message: "Hi 👋",
    received: body
  };

}

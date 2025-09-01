import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

// Gmail credentials (hardcoded)
const GMAIL_USER = "fcooperationweb@gmail.com";
const GMAIL_PASS = "cablqfvaevscrooh"; // Gmail App Password

// Create transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

// Test connection to Gmail SMTP
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection failed:", error);
  } else {
    console.log("SMTP server is ready to send emails");
  }
});

// Endpoint to send test verification email
app.post("/send-verification", async (req, res) => {
  try {
    console.log("Received request to /send-verification");

    const mailOptions = {
      from: `"Fweb Verification" <${GMAIL_USER}>`,
      to: "thefcooperation@gmail.com",
      subject: "Fweb Email Verification Test",
      text: "This is a test verification email from Fweb. ✅",
      html: "<p>This is a <strong>test verification email</strong> from Fweb. ✅</p>",
    };

    console.log("Attempting to send email...");

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Preview URL (if using ethereal):", info.preview || "N/A");

    res.json({ success: true, message: "Verification email sent!", info });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Export app for Render / platform to handle the port automatically
export default app;

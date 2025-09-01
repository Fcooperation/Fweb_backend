import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Gmail credentials from .env
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_PASS = process.env.GMAIL_PASS;

// Create transporter
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // false for TLS
  requireTLS: true,
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

// Verify transporter
transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP verification failed:", error);
  } else {
    console.log("SMTP server is ready to send emails");
  }
});

// Endpoint to send verification email
app.post("/send-verification", async (req, res) => {
  const { toEmail } = req.body;
  if (!toEmail) return res.status(400).json({ success: false, error: "No recipient email provided" });

  try {
    console.log(`Preparing to send email to: ${toEmail}`);

    const mailOptions = {
      from: `"Fweb Verification" <${GMAIL_USER}>`,
      to: toEmail,
      subject: "Fweb Email Verification Test",
      text: "This is a test verification email from Fweb. ✅",
      html: "<p>This is a <strong>test verification email</strong> from Fweb. ✅</p>",
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Envelope:", info.envelope);

    res.json({ success: true, message: `Verification email sent to ${toEmail}`, info });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

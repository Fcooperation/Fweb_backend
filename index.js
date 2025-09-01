// index.js
import express from "express";
import nodemailer from "nodemailer";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Gmail credentials (hardcoded)
const GMAIL_USER = "fcooperationweb@gmail.com";
const GMAIL_PASS = "cablqfvaevscrooh"; // Use Gmail App Password

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

// Endpoint to send test verification email
app.post("/send-verification", async (req, res) => {
  try {
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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

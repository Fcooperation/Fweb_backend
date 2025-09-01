import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config(); // Load env variables

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

app.post("/send-verification", async (req, res) => {
  try {
    const mailOptions = {
      from: `"Fweb Verification" <${process.env.GMAIL_USER}>`,
      to: "thefcooperation@gmail.com",
      subject: "Fweb Email Verification Test",
      text: "This is a test verification email from Fweb. ✅",
      html: "<p>This is a <strong>test verification email</strong> from Fweb. ✅</p>",
    };

    const info = await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Verification email sent!", info });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

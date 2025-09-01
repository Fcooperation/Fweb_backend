import express from 'express';
import nodemailer from 'nodemailer';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Configure Gmail SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fcooperationweb@gmail.com',      // your sending Gmail
    pass: 'cablqfvaevscrooh'               // your Gmail app password
  }
});

// Send verification mail endpoint
app.post('/send-verification', async (req, res) => {
  try {
    const mailOptions = {
      from: '"Fweb" <fcooperationweb@gmail.com>',
      to: 'thefcooperation@gmail.com',      // recipient email
      subject: 'Fweb Email Verification',
      text: 'Hello! This is a test verification email from Fweb.'
    };

    await transporter.sendMail(mailOptions);
    console.log("Verification email sent!");
    res.json({ success: true, message: "Verification email sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

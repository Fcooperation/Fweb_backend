import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Hardcoded Gmail creds
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fcooperationweb@gmail.com',
    pass: 'cablqfvaevscrooh' // your app password
  }
});

app.post('/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, error: "No email provided" });

  try {
    // Here you could generate a token and save it for verification later
    const mailOptions = {
      from: '"Fweb" <fcooperationweb@gmail.com>',
      to: email,
      subject: 'Fweb Email Verification',
      text: `Hello! Click this link to verify your email: http://localhost:3000/verify?email=${encodeURIComponent(email)}`
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`Fweb backend running on port ${PORT}`));

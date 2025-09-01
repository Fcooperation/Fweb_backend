import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import nodemailer from "nodemailer";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "fcooperationweb@gmail.com",   // your Gmail
    pass: "cabl qfva evsc rooh",         // app password
  },
});

app.post("/send", async (req, res) => {
  const { to, subject, text } = req.body;

  try {
    const info = await transporter.sendMail({
      from: "fcooperationweb@gmail.com",
      to,
      subject,
      text,
    });
    res.json({ success: true, info });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(5000, () => console.log("SMTP server running on port 5000"));

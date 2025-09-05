// test-backend.js
import express from "express";
import cors from "cors";
import { signup } from "./faccount.js"; // make sure faccount.js exports signup

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Fweb test backend running 🚀");
});

// Test route to create your account
app.get("/create-test-account", async (req, res) => {
  try {
    const account = await signup({
      firstname: "Francis",
      lastname: "",
      email: "nwankwofrancis2009@gmail.com",
      password: "Onyedika",
    });

    res.json({ success: true, account });
  } catch (err) {
    console.error("❌ Test signup error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Test backend running on port ${PORT}`);
});

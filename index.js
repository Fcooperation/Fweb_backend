// test-backend.js
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

// Supabase setup
const supabaseUrl = "https://pwsxezhugsxosbwhkdvf.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3c3hlemh1Z3N4b3Nid2hrZHZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTkyODM4NywiZXhwIjoyMDY3NTA0Mzg3fQ.u7lU9gAE-hbFprFIDXQlep4q2bhjj0QdlxXF-kylVBQ";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Fweb Supabase test backend running 🚀");
});

// Route to save the test account
app.get("/create-test-account", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("fwebaccount")
      .insert([
        {
          username: "Francis",
          email: "nwankwofrancis2009@gmail.com",
          password_hash: "Onyedika",
          status: "active",
        },
      ])
      .select();

    if (error) throw error;

    res.json({ success: true, account: data[0] });
  } catch (err) {
    console.error("❌ Error saving test account:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Test backend running on port ${PORT}`);
});

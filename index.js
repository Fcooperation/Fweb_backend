// index.js
import express from "express";
import cors from "cors";
import { handleSearch } from "./fcrawler.js";
import { signup, login } from "./faccount.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json()); // ✅ to read JSON body

// Root route
app.get("/", (req, res) => {
res.send("Fweb backend is running 🚀");
});

// Search route
app.get("/search", async (req, res) => {
const query = req.query.q;

if (!query) {
return res.status(400).json({ error: "No query provided" });
}

try {
const results = await handleSearch(query);
res.json(results);
} catch (err) {
console.error("❌ Backend error:", err.message);
res.status(500).json({ error: "Internal server error", details: err.message });
}
});

// Signup route
app.post("/signup", async (req, res) => {
try {
const { firstname, lastname, email, password } = req.body;
if (!firstname || !lastname || !email || !password) {
return res.status(400).json({ error: "Missing fields" });
}

const account = await signup({ firstname, lastname, email, password });  
res.json({ success: true, account });

} catch (err) {
console.error("❌ Signup error:", err.message);
res.status(500).json({ error: err.message });
}
});

// Login route
app.post("/login", async (req, res) => {
try {
const { email, password } = req.body;
if (!email || !password) {
return res.status(400).json({ error: "Missing fields" });
}

const user = await login({ email, password });  
res.json({ success: true, user });

} catch (err) {
console.error("❌ Login error:", err.message);
res.status(401).json({ error: err.message });
}
});

// Start server
app.listen(PORT, () => {
console.log(✅ Server running on port ${PORT});
});


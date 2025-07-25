// index.js
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Fserver backend is live!");
});

// Endpoint to receive "user is online" ping
app.post("/online", (req, res) => {
  const ip = req.ip;
  const time = new Date().toISOString();
  console.log(`User online: ${ip} at ${time}`);
  // Optional: You can later trigger Gofile or backup here

  res.status(200).json({ message: "Online ping received" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Root
app.get("/", (req, res) => {
  res.send("Fweb backend is running 🚀");
});

// Health check (pingable by UptimeRobot)
app.get("/health", (req, res) => {
  res.status(200).send("ok");
});

// Search route
app.get("/search", async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: "No query provided" });

  try {
    const results = await handleSearch(query);
    res.json(results);
  } catch (err) {
    console.error("❌ Backend error:", err.message);
    res.status(500).json({ error: "Internal server error", details: err.message });
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Missing fields" });

    const user = await login({ email, password });
    res.json({ success: true, user });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(401).json({ error: err.message });
  }
});

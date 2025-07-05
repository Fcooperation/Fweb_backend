import express from 'express';

const app = express();
app.use(express.json());

app.post('/search', async (req, res) => {
  const query = req.body.query?.trim();
  if (!query) return res.status(400).json({ error: 'Please type something to search.' });

  try {
    // Simulate the original fetch you had in frontend
    const response = await fetch('https://fweb-backend.onrender.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    res.json({ status: 'ok', data });

  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔓 Open port 10000
const PORT = 10000;
app.listen(PORT, () => {
  console.log(`✅ Server proxy running on http://localhost:${PORT}`);
});

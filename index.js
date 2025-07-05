const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS so your frontend can call this API
app.use(cors());

// To parse JSON body
app.use(express.json());

// POST /search endpoint
app.post('/search', (req, res) => {
  const { query } = req.body;

  console.log('Received search query:', query);

  // Just send back a hello message for now
  res.json({ message: 'Hello from backend', yourQuery: query });
});

// Start server
app.listen(PORT, () => {
  console.log(`Fweb backend listening on port ${PORT}`);
});

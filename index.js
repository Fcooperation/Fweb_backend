const express = require('express');
const cors = require('cors'); // Allow requests from frontend

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors()); // Enable CORS so frontend can talk to backend
app.use(express.json()); // Parse JSON bodies

// Add a test endpoint
app.post('/search', (req, res) => {
  const { query } = req.body;
  console.log('Received query:', query);
  res.json({ message: 'Backend received', query });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

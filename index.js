const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/search', (req, res) => {
  const { query } = req.body;

  console.log('🧠 Received search query:', query);

  // Send it back to frontend as test response
  res.json({
    message: 'Query received!',
    yourQuery: query
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend ready at http://localhost:${PORT}`);
});

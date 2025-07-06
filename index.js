const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/search', (req, res) => {
  const { query } = req.body;
  console.log('📥 Received search query:', query);

  let reply;

  // Match specific messages
  if (query.toLowerCase() === 'hi') {
    reply = 'Hello';
  } else if (query.toLowerCase() === 'hello') {
    reply = 'Hi';
  } else if (query.toLowerCase() === 'how are you doing') {
    reply = "I'm fine";
  } else {
    reply = "I don't get you";
  }

  res.json({ response: reply });
});

app.listen(PORT, () => {
  console.log(`✅ Backend listening on port ${PORT}`);
});

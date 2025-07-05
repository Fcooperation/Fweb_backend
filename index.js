import express from 'express';
import cors from 'cors';
import { findAnswers } from './fAi.js'; // ✅ Import local fAi logic

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/search', async (req, res) => {
  const { query } = req.body;
  console.log('🔍 Received search query:', query);

  try {
    const result = await findAnswers(query);
    res.json(result);
  } catch (err) {
    console.error('❌ fAi error:', err.message);
    res.status(500).json({ error: 'fAi failed internally.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Fserver backend running on port ${PORT}`);
});

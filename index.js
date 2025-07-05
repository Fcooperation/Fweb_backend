import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const FAI_ENDPOINT = 'https://your-fai-service.onrender.com/search'; // replace with your deployed fAi endpoint

app.get('/search', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing search query.' });

  console.log('🔍 Received search query:', query);

  try {
    const faiResponse = await axios.post(FAI_ENDPOINT, { query });
    res.json(faiResponse.data);
  } catch (err) {
    console.error('❌ fAi error:', err.message);
    res.status(500).json({ error: 'fAi failed to respond properly.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Fserver backend running on port ${PORT}`);
});

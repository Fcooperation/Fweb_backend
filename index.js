import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.post('/search', (req, res) => {
  const { query } = req.body;
  console.log('Received search query:', query);
  res.json({ message: 'Backend received your query', yourQuery: query });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

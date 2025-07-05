import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

app.post('/search', (req, res) => {
  const { query } = req.body;
  console.log('Received query:', query);
  res.json({ message: 'Backend received', query });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.post('/fcards', (req, res) => {
  const query = req.body.query;
  console.log("Received query:", query);
  res.json({ fcards: [{ title: "Hi", link: "#", snippet: "Hello from backend!" }] });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

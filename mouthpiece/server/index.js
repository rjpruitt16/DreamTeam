

const express = require('express');
const app = express();
const port = 3000;

// Basic route for hello world
app.get('/', (req, res) => {
  res.send('Hello World!');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

const express = require("express");
const app = express();

// ROTA DE TESTE (OBRIGATÓRIA)
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});

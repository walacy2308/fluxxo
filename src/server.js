const express = require("express");
const app = express();

// ROTA DE TESTE (OBRIGATÓRIA)
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

// bot.startPolling();
// bot.on(...)

const PORT = process.env.PORT;

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});

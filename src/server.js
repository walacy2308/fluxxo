const express = require("express");

const app = express();

// ROTA DE TESTE
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Rodando na porta " + PORT);
});

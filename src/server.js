const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

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

const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const TelegramBot = require("node-telegram-bot-api");

dotenv.config();

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "user-id", "x-user-id"]
}));
app.use(express.json());

// ================= SUPABASE =================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ================= TELEGRAM =================
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });

console.log("🤖 Bot iniciado!");

// ================= HEALTH =================
app.get("/", (req, res) => {
  res.send("API ONLINE 🚀");
});

app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok" });
});

// Endpoint de debug adicionado
app.get("/teste/:codigo", async (req, res) => {
  const codigo = req.params.codigo;

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .ilike("telegram_code", codigo.trim())
    .maybeSingle();

  return res.json({
    recebido: codigo,
    encontrado: data,
    erro: error
  });
});

// ================= GASTOS =================
app.get("/api/v1/gastos", async (req, res) => {
  const { data, error } = await supabase
    .from("transactions")
    .select("*");

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.post("/api/v1/gastos", async (req, res) => {
  const { descricao, valor, user_id, tipo, parcelas, categoria } = req.body;

  const { data, error } = await supabase
    .from("transactions")
    .insert([{
      descricao,
      valor,
      user_id,
      tipo: tipo || "gasto",
      parcelas: parcelas || 1,
      categoria: categoria || detectarCategoria(descricao || "")
    }]);

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.delete("/api/v1/gastos/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"];
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "user-id não enviado" });
    }

    const { data, error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      return res.status(500).json({ error });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

// ================= HELPERS =================
function detectarCategoria(desc) {
  if (desc.includes("mercado")) return "Alimentação";
  if (desc.includes("uber")) return "Transporte";
  if (desc.includes("celular")) return "Tecnologia";
  if (desc.includes("salario")) return "Renda";
  return "Outros";
}

function interpretarMensagem(texto) {
  texto = texto.toLowerCase();

  let tipo = "gasto";
  let valorTotal = 0;
  let parcelas = 1;
  let descricao = texto;

  if (texto.includes("recebi") || texto.includes("ganhei")) {
    tipo = "entrada";
  }

  const parcelasMatch = texto.match(/(\d+)x/);
  if (parcelasMatch) {
    parcelas = parseInt(parcelasMatch[1]);
    texto = texto.replace(/(\d+)x/, "");
  }

  const valorMatch = texto.match(/(\d+[\.,]?\d*)/);
  if (valorMatch) {
    valorTotal = parseFloat(valorMatch[1].replace(",", "."));
  }

  const valorParcela = valorTotal / parcelas;

  descricao = texto
    .replace(/(\d+[\.,]?\d*)/g, "")
    .replace("comprei", "")
    .replace("por", "")
    .replace("de", "")
    .replace(/\s+/g, " ")
    .trim();

  const categoria = detectarCategoria(descricao);

  return { tipo, valor: valorTotal, valorParcela, parcelas, descricao, categoria };
}

// ================= TELEGRAM HANDLERS =================

bot.on("message", async (msg) => {
  const texto = msg.text?.trim();
  const chatId = msg.chat.id;

  if (!texto) return;

  console.log("Mensagem recebida:", texto);

  const textoUpper = texto.toUpperCase();

  // 🔥 1. VERIFICA CÓDIGO PRIMEIRO (ANTES DE TUDO)
  const isCodigo = /^FLUX\d{4}$/.test(textoUpper);
  console.log("É código:", isCodigo);

  if (isCodigo) {
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .ilike("telegram_code", textoUpper)
      .maybeSingle();

    if (!user) {
      bot.sendMessage(chatId, "❌ Código inválido");
      return; // 🚨 PARA AQUI
    }

    // 🔥 Limpa esse chat_id de outras contas (desloga os antigos)
    await supabase
      .from("users")
      .update({ telegram_chat_id: null })
      .eq("telegram_chat_id", chatId);

    const { error: updateError } = await supabase
      .from("users")
      .update({
        telegram_chat_id: chatId,
        telegram_code: null
      })
      .eq("id", user.id);

    if (updateError) {
       console.error("❌ Erro ao atualizar usuário:", updateError);
       bot.sendMessage(chatId, "⚠️ Ops! Tivemos um erro interno ao conectar sua conta. Tente novamente ou chame o suporte.");
       return;
    }

    bot.sendMessage(chatId, "✅ Conta conectada!");
    return; // 🚨 ESSENCIAL (impede virar gasto)
  }

  if (texto.startsWith("/start")) {
    bot.sendMessage(chatId, `🚀 Bem-vindo ao Fluuxxo!

Para conectar sua conta e começar a controlar seus gastos de forma inteligente 💸, siga o passo a passo:

1️⃣ Acesse o app:
https://fluuxxo.lovable.app/login

2️⃣ Faça seu login ou cadastro

3️⃣ Gere seu código de conexão

4️⃣ Volte aqui e envie o código (ex: FLUX1234)

✨ Pronto! Sua conta será conectada automaticamente.

Depois disso, é só enviar seus gastos assim:
👉 mercado 50
👉 uber 30

Vamos organizar sua vida financeira juntos! 📊🔥`);
    return;
  }

  if (texto.startsWith("/")) return; // ignora outros comandos

  // 🔹 2. SE NÃO FOR CÓDIGO → É GASTO
  const { data: user, error: fetchError } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("❌ Erro ao buscar usuário conectado:", fetchError);
  }

  if (!user) {
    bot.sendMessage(chatId, "👋 *Olá! Você ainda não conectou sua conta.*\n\nPara começar a registrar seus gastos, envie o seu *CÓDIGO* aqui.", { parse_mode: "Markdown" });
    return;
  }

  const { tipo, valor, valorParcela, parcelas, descricao, categoria } = interpretarMensagem(texto);

  if (!valor || isNaN(valor)) {
    bot.sendMessage(chatId, "⚠️ Formato inválido. Exemplo: `mercado 50`, `recebi 2000` ou `gastei 300 2x`", { parse_mode: "Markdown" });
    return;
  }

  const { error } = await supabase.from("transactions").insert([
    {
      descricao,
      valor,
      tipo,
      parcelas,
      categoria,
      user_id: user.id,
    },
  ]);

  if (error) {
    console.error("❌ ERRO SUPABASE:", error);
    bot.sendMessage(chatId, `❌ Erro ao registrar: ${error.message}`);
    return;
  }

  const icon = tipo === "entrada" ? "💰" : "💸";
  const msgTipo = tipo === "entrada" ? "*Entrada registrada!*" : "*Gasto registrado!*";

  let valorExibicao = `*R$ ${valor.toFixed(2)}*`;
  if (parcelas > 1) {
    valorExibicao = `*R$ ${valor.toFixed(2)}* (em ${parcelas}x de R$ ${valorParcela.toFixed(2)})`;
  }

  bot.sendMessage(
    chatId,
    `${icon} ${msgTipo}\n📝 *${descricao}*\n🏷️ Categoria: *${categoria}*\n💰 ${valorExibicao}`,
    { parse_mode: "Markdown" }
  );
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});

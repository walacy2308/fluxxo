import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import TelegramBot from "node-telegram-bot-api";

dotenv.config();

const app = express();
app.use(cors());
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
app.get("/api/v1/health", (req, res) => {
  res.json({ status: "ok" });
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

// ================= TELEGRAM HANDLERS =================

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

  // 1. Detectar tipo (entrada/gasto)
  if (texto.includes("recebi") || texto.includes("ganhei")) {
    tipo = "entrada";
  }

  // 2. Detectar parcelas PRIMEIRO (ex: "2x")
  const parcelasMatch = texto.match(/(\d+)x/);
  if (parcelasMatch) {
    parcelas = parseInt(parcelasMatch[1]);
    texto = texto.replace(/(\d+)x/, "");
  }

  // 3. Pegar o valor (considerado o TOTAL da compra/venda)
  const valorMatch = texto.match(/(\d+[\.,]?\d*)/);
  if (valorMatch) {
    valorTotal = parseFloat(valorMatch[1].replace(",", "."));
  }

  // 4. Calcular o valor de cada parcela
  const valorParcela = valorTotal / parcelas;

  // 5. Limpar a descrição
  descricao = texto
    .replace(/(\d+[\.,]?\d*)/g, "")
    .replace("comprei", "")
    .replace("por", "")
    .replace("de", "")
    .replace(/\s+/g, " ")
    .trim();

  // 6. Detectar categoria automaticamente
  const categoria = detectarCategoria(descricao);

  return { tipo, valor: valorTotal, valorParcela, parcelas, descricao, categoria };
}

// /start — boas-vindas sem código
bot.onText(/\/start$/, (msg) => {
  const chatId = msg.chat.id;

  console.log("Start recebido");

  bot.sendMessage(chatId, `🚀 Bem-vindo ao Fluuxy!

Envie um gasto assim:
👉 mercado 50

Ou conecte sua conta:
/start SEU_CODIGO`);
});

// /start <código> — vincula conta ao chat
bot.onText(/\/start (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const code = match[1].trim().toUpperCase();

  console.log("Código recebido:", code);

  // 1. Verificar se esse chatId já está vinculado a ALGUÉM
  const { data: alreadyLinked } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  if (alreadyLinked) {
    bot.sendMessage(chatId, `✅ Você já está conectado como *${alreadyLinked.email}*!`, { parse_mode: "Markdown" });
    return;
  }

  // 2. Tentar encontrar o usuário pelo código
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_code", code)
    .maybeSingle();

  console.log("Usuário encontrado:", user);

  if (!user) {
    bot.sendMessage(chatId, "❌ *Código inválido ou já utilizado.*\n\nVerifique o código no painel do Fluuxy ou gere um novo.", { parse_mode: "Markdown" });
    return;
  }

  // 3. Vincular
  await supabase
    .from("users")
    .update({
      telegram_chat_id: chatId,
      telegram_code: null,
    })
    .eq("id", user.id);

  bot.sendMessage(chatId, `✅ *Telegram conectado!*\nConta: ${user.email}`, { parse_mode: "Markdown" });
});

// Mensagens livres — ex: "mercado 50"
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();

  const texto = msg.text;
  if (!texto || texto.startsWith("/")) return;

  if (!user) {
    bot.sendMessage(chatId, "👋 *Olá! Você ainda não conectou sua conta.*\n\nPara começar a registrar seus gastos, use:\n`/start SEU_CODIGO`", { parse_mode: "Markdown" });
    return;
  }

  const { tipo, valor, valorParcela, parcelas, descricao, categoria } = interpretarMensagem(texto);

  if (!valor || isNaN(valor)) {
    bot.sendMessage(chatId, "⚠️ Formato inválido. Exemplo: `mercado 50`, `recebi 2000` ou `gastei 300 2x`", {
      parse_mode: "Markdown",
    });
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
  
  // Exibição: Valor Total primeiro, depois detalhe das parcelas
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
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Rodando na porta ${PORT}`);
});

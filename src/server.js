const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");
const TelegramBot = require("node-telegram-bot-api");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

dotenv.config();

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "user-id"]
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
  const userId = req.headers["user-id"];
  
  if (!userId) {
    return res.status(400).json({ error: "user-id não enviado" });
  }

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId);

  if (error) return res.status(500).json(error);

  res.json(data);
});

app.post("/api/v1/gastos", async (req, res) => {
  const { descricao, valor, parcelas = 1 } = req.body;
  const userId = req.headers["user-id"];

  const parcelId = uuidv4();
  const valorParcela = valor / parcelas;

  let inserts = [];

  for (let i = 1; i <= parcelas; i++) {
    const data = new Date();
    data.setMonth(data.getMonth() + (i - 1));

    inserts.push({
      user_id: userId,
      descricao,
      valor: valorParcela,
      tipo: "gasto",
      parcelas,
      parcel_id: parcelId,
      parcela_atual: i,
      total_parcelas: parcelas,
      data_vencimento: data
    });
  }

  const { error } = await supabase
    .from("transactions")
    .insert(inserts);

  if (error) return res.status(500).json({ error });

  res.json({ sucesso: true });
});

app.delete("/api/v1/gastos/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"];
    const { id } = req.params;
    const { parcel_id } = req.query; // Pega parcel_id da query se enviado

    if (!userId) {
      return res.status(400).json({ error: "user-id não enviado" });
    }

    let query = supabase.from("transactions").delete().eq("user_id", userId);

    if (parcel_id) {
      // Se tiver parcel_id, deleta tudo desse grupo
      query = query.eq("parcel_id", parcel_id);
    } else {
      // Caso contrário, deleta apenas uma parcela
      query = query.eq("id", id);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error });
    }

    return res.status(204).send();
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

app.put("/api/v1/gastos/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"];
    const { id } = req.params;
    const { descricao, valor, categoria, pago } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "user-id não enviado" });
    }

    // Build the update object dynamically
    const updateData = {};
    if (descricao !== undefined) updateData.descricao = descricao;
    if (valor !== undefined) updateData.valor = valor;
    if (categoria !== undefined) updateData.categoria = categoria;
    if (pago !== undefined) {
      updateData.pago = pago;
      updateData.data_pagamento = pago ? new Date() : null;
    }

    const { data, error } = await supabase
      .from("transactions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) {
      return res.status(500).json({ error });
    }

    return res.json(data[0] || {});
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

app.patch("/api/v1/gastos/:id", async (req, res) => {
  try {
    const userId = req.headers["user-id"];
    const { id } = req.params;
    const { pago } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "user-id não enviado" });
    }

    const { data, error } = await supabase
      .from("transactions")
      .update({ 
        pago: pago,
        data_pagamento: pago ? new Date() : null
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (error) {
      return res.status(500).json({ error });
    }

    return res.json(data[0] || {});
  } catch (err) {
    return res.status(500).json({ error: "Erro interno" });
  }
});

app.patch("/api/v1/gastos/:id/pagar", async (req, res) => {
  try {
    const userId = req.headers["user-id"];
    const { id } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "user-id não enviado" });
    }

    const { error } = await supabase
      .from("transactions")
      .update({ 
        pago: true,
        data_pagamento: new Date()
      })
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return res.status(500).json({ error });

    res.status(200).json({ ok: true });
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
  const originalTexto = texto;
  texto = texto.toLowerCase();

  let tipo = "gasto";
  let valorTotal = 0;
  let parcelas = 1;
  let descricao = texto;

  if (texto.includes("recebi") || texto.includes("ganhei")) {
    tipo = "entrada";
  }

  // Detecta parcelas: "10x" ou "10 parcelas" ou "em 10 vezes" ou "parcelado em 10"
  const parcelasMatch = texto.match(/(\d+)x/) || 
                       texto.match(/(\d+)\s*parcelas/) || 
                       texto.match(/(\d+)\s*vezes/) ||
                       texto.match(/parcelado\s*em\s*(\d+)/);
  
  if (parcelasMatch) {
    parcelas = parseInt(parcelasMatch[1]);
    // Remove a menção de parcelas do texto para limpar a descrição
    texto = texto.replace(/(\d+)x/, "")
                 .replace(/(\d+)\s*parcelas/, "")
                 .replace(/(\d+)\s*vezes/, "")
                 .replace(/parcelado\s*em\s*(\d+)/, "")
                 .replace(/parcelado/g, "");
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

  let error;

  if (parcelas > 1) {
    const parcelId = crypto.randomUUID();
    const registros = [];
    const dataInicial = new Date();

    for (let i = 1; i <= parcelas; i++) {
      const dataParcela = new Date(dataInicial);
      dataParcela.setMonth(dataParcela.getMonth() + (i - 1));

      registros.push({
        user_id: user.id,
        descricao,
        valor: valorParcela,
        tipo,
        categoria,
        parcelas,
        parcela_atual: i,
        total_parcelas: parcelas,
        parcel_id: parcelId,
        created_at: dataParcela.toISOString()
      });
    }

    const result = await supabase.from("transactions").insert(registros).select();
    error = result.error;
  } else {
    const result = await supabase.from("transactions").insert([
      {
        user_id: user.id,
        descricao,
        valor,
        tipo,
        parcelas: 1,
        parcela_atual: 1,
        total_parcelas: 1,
        categoria,
      },
    ]).select();
    error = result.error;
  }

  if (error) {
    console.error("❌ ERRO SUPABASE:", error);
    bot.sendMessage(chatId, `❌ Erro ao registrar: ${error.message}`);
    return;
  }

  const icon = tipo === "entrada" ? "💰" : "💸";
  const msgTipo = tipo === "entrada" ? "*Entrada registrada!*" : (parcelas > 1 ? "*Compra Parcelada registrada!* 🛒" : "*Gasto registrado!*");

  let valorExibicao = `*R$ ${valor.toFixed(2)}*`;
  if (parcelas > 1) {
    valorExibicao = `*R$ ${valor.toFixed(2)}* (dividido em ${parcelas} parcelas de R$ ${valorParcela.toFixed(2)})`;
  }

  bot.sendMessage(
    chatId,
    `${icon} ${msgTipo}\n\n📝 *${descricao}*\n🏷️ Categoria: *${categoria}*\n💰 Valor total: ${valorExibicao}\n📅 Data: *${new Date().toLocaleDateString("pt-BR")}*`,
    { parse_mode: "Markdown" }
  );
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Rodando na porta " + PORT);
});

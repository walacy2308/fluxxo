import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkColumns() {
  console.log("🔍 Verificando estrutura da tabela 'transactions'...");
  
  // Tenta buscar uma linha para ver as colunas retornadas
  const { data, error } = await supabase.from("transactions").select("*").limit(1);

  if (error) {
    console.error("❌ Erro ao acessar a tabela:", error.message);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log("✅ Colunas encontradas:", columns);
    
    const hasTipo = columns.includes("tipo");
    const hasParcelas = columns.includes("parcelas");

    console.log(`- Coluna 'tipo': ${hasTipo ? "EXISTE" : "NÃO EXISTE"}`);
    console.log(`- Coluna 'parcelas': ${hasParcelas ? "EXISTE" : "NÃO EXISTE"}`);
  } else {
    console.log("⚠️ A tabela está vazia. Tentando verificar via inserção de teste...");
    
    // Tentativa de inserção com as colunas novas para ver se o banco aceita
    const { error: insertError } = await supabase.from("transactions").insert([
      { descricao: "teste_colunas", valor: 0, tipo: "gasto", parcelas: 1 }
    ]);

    if (insertError && insertError.message.includes("column \"tipo\" does not exist")) {
      console.log("❌ Colunas 'tipo' e 'parcelas' NÃO existem no banco.");
    } else if (!insertError) {
      console.log("✅ Colunas 'tipo' e 'parcelas' EXISTEM (inserção de teste funcionou).");
      // Limpa o teste
      await supabase.from("transactions").delete().eq("descricao", "teste_colunas");
    } else {
      console.error("❌ Erro inesperado no teste:", insertError.message);
    }
  }
}

checkColumns();

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectUsers() {
  console.log("🔍 Inspecionando tabela 'users'...");
  
  const { data, error } = await supabase.from("users").select("*").limit(5);

  if (error) {
    console.error("❌ Erro ao acessar a tabela 'users':", error.message);
    return;
  }

  if (data && data.length > 0) {
    console.log("✅ Colunas encontradas:", Object.keys(data[0]));
    console.log("📝 Primeiros registros:");
    console.table(data);
  } else {
    console.log("⚠️ A tabela 'users' está vazia ou não retornou dados.");
  }
}

inspectUsers();

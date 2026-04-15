import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function syncUser() {
  const { error } = await supabase.from("users").insert([
    { 
      id: "92662ac1-89c8-4626-bba1-e2fe5f516c49", 
      email: "teste_1776129306223@exemplo.com",
      telegram_code: "ABC123" 
    }
  ]);

  if (error) {
    console.error("❌ Erro ao inserir usuário:", error.message);
    return;
  }

  console.log("✅ Usuário inserido na tabela pública com código ABC123!");
}

syncUser();

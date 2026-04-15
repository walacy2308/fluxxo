import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function resetTester() {
  console.log("🔄 Resetando usuário de teste...");
  
  // Pegamos o ID do usuário que já conhecemos
  const userId = "92662ac1-89c8-4626-bba1-e2fe5f516c49";

  const { error } = await supabase
    .from("users")
    .update({
      telegram_chat_id: null,
      telegram_code: "FLUX01"
    })
    .eq("id", userId);

  if (error) {
    console.error("❌ Erro ao resetar usuário:", error.message);
    return;
  }

  console.log("✅ Usuário resetado!");
  console.log("👉 Novo código para teste: FLUX01");
}

resetTester();

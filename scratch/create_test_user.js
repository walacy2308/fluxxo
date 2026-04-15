import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function createTestUser() {
  const email = `teste_${Date.now()}@exemplo.com`;
  const password = "SenhaForte123!";

  console.log(` tentando criar usuário: ${email}...`);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error("❌ Erro ao criar usuário:", error.message);
    return;
  }

  console.log("✅ Usuário criado com sucesso!");
  console.log("ID:", data.user?.id);
  console.log("E-mail:", data.user?.email);
  console.log("\n⚠️ IMPORTANTE: Por padrão, o Supabase exige confirmação por e-mail.");
  console.log("Você pode desativar isso em: Authentication -> Providers -> Email -> 'Confirm email'");
}

createTestUser();

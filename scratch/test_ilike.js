import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const codigo = "FLUX01";
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .ilike("telegram_code", codigo.trim())
    .maybeSingle();

  console.log("Resultado da query test_ilike:", user);
  if (error) console.log("ERRO:", error);
}

run();

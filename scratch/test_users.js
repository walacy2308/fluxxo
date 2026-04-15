import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testUsers() {
  const { data, error } = await supabase.from("users").select("*");
  
  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return;
  }
  
  console.log("TODOS USERS:", data);
}

testUsers();

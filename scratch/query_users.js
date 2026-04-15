import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  const { data: allUsers } = await supabase.from("users").select("*");
  console.log("TODOS USERS:", allUsers);
}

run();

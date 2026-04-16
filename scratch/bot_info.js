import dotenv from "dotenv";
dotenv.config();

const url = `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getMe`;

fetch(url)
  .then(res => res.json())
  .then(data => console.log("Bot:", data))
  .catch(err => console.error("Error:", err));

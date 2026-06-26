const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass'
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT id, email, chatbot_id FROM chatbot_admin WHERE email LIKE '%sunandar%'");
  console.table(res.rows);
  await client.end();
}

run();

const { Client } = require('pg');
const client = new Client('postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass');

async function run() {
  await client.connect();
  const msgs = await client.query('SELECT chatbot_id, COUNT(*) as c FROM messages GROUP BY chatbot_id');
  console.table(msgs.rows);
  await client.end();
}
run();

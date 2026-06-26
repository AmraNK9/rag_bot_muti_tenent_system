const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT c.id as chatbot_id, c.name, c.business_id, b.id as b_id FROM chatbot c LEFT JOIN business b ON c.business_id = b.id');
  console.table(res.rows);
  await client.end();
}

run();

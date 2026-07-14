const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass'
});

async function run() {
  try {
    await client.connect();
    const adminsRes = await client.query('SELECT id, name, email, chatbot_id FROM chatbot_admin');
    console.log('--- ChatbotAdmins ---');
    console.table(adminsRes.rows);

    const botsRes = await client.query('SELECT id, name, business_id FROM chatbot');
    console.log('--- ChatBots ---');
    console.table(botsRes.rows);

    const busRes = await client.query('SELECT id, name FROM business');
    console.log('--- Businesses ---');
    console.table(busRes.rows);

    await client.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();

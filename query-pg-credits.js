const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass'
});

async function run() {
  try {
    await client.connect();
    const busRes = await client.query('SELECT id, name, active_messages_count FROM business');
    console.log('--- Businesses ---');
    console.table(busRes.rows);

    await client.end();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();

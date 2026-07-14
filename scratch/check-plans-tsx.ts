import { Plan } from '../src/infrastructure/db/models/index';
import { SequelizeService } from '../src/infrastructure/db/sequelize.service';

async function run() {
  process.env.DB_HOST = '127.0.0.1';
  process.env.DB_PORT = '5434';
  process.env.DB_USER = 'postgres';
  process.env.DB_PASSWORD = 'postgres_password';
  process.env.DB_NAME = 'chat-bot-sass';
  
  const sequelize = SequelizeService.getClient();
  try {
    const plans = await Plan.findAll();
    console.log('Plans in DB:', JSON.stringify(plans, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await sequelize.close();
  }
}

run();

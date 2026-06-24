import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/db',
  {
    dialect: 'postgres',
    logging: console.log,
  }
);

async function run() {
  try {
    console.log('Starting DB ENUM migration...');
    
    // Add new columns (just in case sync isn't triggered yet)
    await sequelize.query(`ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "max_chat_history" INTEGER NOT NULL DEFAULT 10;`).catch(e => console.log('max_chat_history already exists?'));
    await sequelize.query(`ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "services" JSONB NOT NULL DEFAULT '[]'::jsonb;`).catch(e => console.log('services already exists?'));

    // Convert ENUMs to VARCHAR
    await sequelize.query(`ALTER TABLE "business" ALTER COLUMN "subscription_plan" TYPE VARCHAR(255);`).catch(e => console.log('Business alter failed:', e.message));
    
    await sequelize.query(`ALTER TABLE "plan_request" ALTER COLUMN "plan_name" TYPE VARCHAR(255);`).catch(e => console.log('PlanRequest alter failed:', e.message));

    // Drop the leftover ENUM types from Postgres memory
    await sequelize.query(`DROP TYPE IF EXISTS "enum_business_subscription_plan" CASCADE;`);
    await sequelize.query(`DROP TYPE IF EXISTS "enum_plan_request_plan_name" CASCADE;`);
    console.log('Dropped ENUM types successfully.');

  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    await sequelize.close();
  }
}

run();

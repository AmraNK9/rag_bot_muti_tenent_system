import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { initModels, Plan, SystemSetting } from './models';

declare const process: {
  env: {
    DATABASE_URL?: string;
    NODE_ENV?: string;
  };
};

export class SequelizeService {
  private static instance: Sequelize;

  /**
   * Retrieves the singleton Sequelize instance (PostgreSQL).
   */
  public static getClient(): Sequelize {
    if (!SequelizeService.instance) {
      const dbUrl = process.env.DATABASE_URL;

      console.log('dbUrl: ->', dbUrl);
      if (!dbUrl) {
        throw new Error('DATABASE_URL is not set. Please configure a PostgreSQL connection string.');
      }

      SequelizeService.instance = new Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
        define: {
          timestamps: false,
        },
        dialectOptions: {
          // SSL support for cloud PostgreSQL (e.g., Supabase, Neon, Railway)
          // ssl: { require: true, rejectUnauthorized: false },
        },
      });

      // Initialize models and associations
      initModels(SequelizeService.instance);
    }
    return SequelizeService.instance;
  }

  /**
   * Establishes database connection, enables pgvector extension, and syncs model schema.
   */
  public static async connect(): Promise<void> {
    try {
      const sequelize = SequelizeService.getClient();
      await sequelize.authenticate();

      // Enable pgvector extension (must exist before syncing models)
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS vector;');
      console.log('pgvector extension enabled.');

      // Sync models with the database (development/demo migration helper)
      try {
        await sequelize.sync({ alter: true });
        console.log('Database synced with alter: true.');
      } catch (err) {
        console.warn('Sequelize sync alter failed (likely due to Postgres constraint bugs), falling back to safe sync:', err);
        await sequelize.sync();
        console.log('Database synced safely.');
      }

      // Ensure chatbot_id in chatbot_admin is nullable in DB (resolves not-null constraint error on registration)
      try {
        await sequelize.query('ALTER TABLE "chatbot_admin" ALTER COLUMN "chatbot_id" DROP NOT NULL;');
        console.log('Successfully dropped NOT NULL constraint on chatbot_admin.chatbot_id.');
      } catch (err) {
        console.warn('Could not drop NOT NULL constraint on chatbot_admin.chatbot_id (may already be nullable):', err instanceof Error ? err.message : err);
      }

      // Seed defaults
      await SequelizeService.seedDefaults();
    } catch (error) {
      console.error('Failed to authenticate and sync database with Sequelize:', error);
      throw error;
    }
  }

  /**
   * Seeds default system settings and pricing plans if tables are empty.
   */
  public static async seedDefaults(): Promise<void> {
    try {
      const settingsCount = await SystemSetting.count();
      if (settingsCount === 0) {
        await SystemSetting.create({
          referrer_first_month_rate: 30.00,
          referrer_recurring_rate: 10.00,
          approver_fee_rate: 10.00,
        });
        console.log('Seeded default system settings.');
      }

      const plansCount = await Plan.count();
      if (plansCount === 0) {
        await Plan.bulkCreate([
          { name: 'lite', price: 3000.00, query_limit: 500, duration_days: 30, is_active: true },
          { name: 'basic', price: 15000.00, query_limit: 3000, duration_days: 30, is_active: true },
          { name: 'pro', price: 30000.00, query_limit: 10000, duration_days: 30, is_active: true },
        ]);
        console.log('Seeded default plan profiles (lite, basic, pro).');
      }
    } catch (error) {
      console.error('Error seeding defaults:', error);
    }
  }

  /**
   * Closes the database connection.
   */
  public static async disconnect(): Promise<void> {
    if (SequelizeService.instance) {
      await SequelizeService.instance.close();
    }
  }
}

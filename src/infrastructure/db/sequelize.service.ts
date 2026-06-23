import 'dotenv/config';
import { Sequelize } from 'sequelize';
import { initModels } from './models';

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
      await sequelize.sync({ alter: true });
    } catch (error) {
      console.error('Failed to authenticate and sync database with Sequelize:', error);
      throw error;
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

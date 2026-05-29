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
   * Retrieves the singleton Sequelize instance.
   */
  public static getClient(): Sequelize {
    if (!SequelizeService.instance) {
      const dbUrl = process.env.DATABASE_URL;

      console.log("dbUrl: ->", dbUrl);
      if (!dbUrl || process.env.NODE_ENV === 'test') {
        console.warn('DATABASE_URL is not set or in test mode. Falling back to an in-memory SQLite instance for verification.');
        SequelizeService.instance = new Sequelize({
          dialect: 'sqlite',
          storage: ':memory:',
          logging: false,
          define: {
            timestamps: false,
          },
        });
      } else if (dbUrl.startsWith('sqlite:')) {
        const storagePath = dbUrl.replace(/^sqlite:\/\/|^sqlite:/, '');
        console.log(`Using file-based SQLite database at: ${storagePath || 'database.sqlite'}`);
        SequelizeService.instance = new Sequelize({
          dialect: 'sqlite',
          storage: storagePath || 'database.sqlite',
          logging: false,
          define: {
            timestamps: false,
          },
        });
      } else {
        SequelizeService.instance = new Sequelize(dbUrl, {
          dialect: 'mysql',
          logging: false,
          define: {
            timestamps: false,
          },
        });
      }

      // Initialize models and associations
      initModels(SequelizeService.instance);
    }
    return SequelizeService.instance;
  }

  /**
   * Establishes database connection and syncs model schema.
   */
  public static async connect(): Promise<void> {
    try {
      const sequelize = SequelizeService.getClient();
      await sequelize.authenticate();
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

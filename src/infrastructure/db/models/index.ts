import { Sequelize, Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';

export class Business extends Model<InferAttributes<Business>, InferCreationAttributes<Business>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare detail_info: string;
  declare created_at: CreationOptional<Date>;
}

export class ChatBot extends Model<InferAttributes<ChatBot>, InferCreationAttributes<ChatBot>> {
  declare id: CreationOptional<number>;
  declare business_id: ForeignKey<Business['id']>;
  declare name: string;
  declare knoweledge_key: CreationOptional<number | null>;
  declare token: string;
  declare api_id: CreationOptional<string | null>;
  declare api_hash: CreationOptional<string | null>;
  declare type: 'telegram' | 'facebook';

  // Relationship definitions
  declare business?: Business;
}

export class Messages extends Model<InferAttributes<Messages>, InferCreationAttributes<Messages>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare sender_id: number;
  declare message: string;
  declare sent_date: CreationOptional<Date>;
}

export class SummerizeMessages extends Model<InferAttributes<SummerizeMessages>, InferCreationAttributes<SummerizeMessages>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare sender_id: number;
  declare summary: string;
  declare created_at: CreationOptional<Date>;
}

export function initModels(sequelize: Sequelize) {
  Business.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      detail_info: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'business',
      timestamps: false,
    }
  );

  ChatBot.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      business_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      knoweledge_key: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      api_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      api_hash: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      type: {
        type: DataTypes.ENUM('telegram', 'facebook'),
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'chatbot',
      timestamps: false,
    }
  );

  Messages.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      sent_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'messages',
      timestamps: false,
    }
  );

  SummerizeMessages.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'summarize_messages',
      timestamps: false,
    }
  );

  // Setup Associations
  Business.hasMany(ChatBot, { foreignKey: 'business_id', as: 'chatbots' });
  ChatBot.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

  ChatBot.hasMany(Messages, { foreignKey: 'chatbot_id', as: 'messages' });
  Messages.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot' });

  ChatBot.hasMany(SummerizeMessages, { foreignKey: 'chatbot_id', as: 'summarizedMessages' });
  SummerizeMessages.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot' });
}

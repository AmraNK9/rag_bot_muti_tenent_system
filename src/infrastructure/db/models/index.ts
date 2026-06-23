import { Sequelize, Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes, ForeignKey } from 'sequelize';

// ─── Business Model ─────────────────────────────────────────────────────────
export class Business extends Model<InferAttributes<Business>, InferCreationAttributes<Business>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare detail_info: string;
  declare password: string; // bcrypt hashed
  declare plan: CreationOptional<'free' | 'prepaid_credits' | 'subscription'>;
  declare active_messages_count: CreationOptional<number>; // remaining message credits
  declare subscription_end_date: CreationOptional<Date | null>;
  declare subscription_plan: CreationOptional<'basic' | 'pro' | 'enterprise' | null>;
  declare total_chatbots: CreationOptional<number>; // max allowed chatbots for current plan
  declare created_at: CreationOptional<Date>;
}

// ─── ChatBot Model ───────────────────────────────────────────────────────────
export class ChatBot extends Model<InferAttributes<ChatBot>, InferCreationAttributes<ChatBot>> {
  declare id: CreationOptional<number>;
  declare business_id: ForeignKey<Business['id']>;
  declare name: string;
  declare description: CreationOptional<string | null>;
  declare knoweledge_key: CreationOptional<number | null>;
  declare token: string;
  declare api_id: CreationOptional<string | null>;
  declare api_hash: CreationOptional<string | null>;
  declare type: 'telegram' | 'facebook';
  declare bot_role: CreationOptional<'sales' | 'faq' | 'support' | 'custom'>;
  declare custom_system_prompt: CreationOptional<string | null>;

  // Relationship definitions
  declare business?: Business;
  declare admins?: ChatbotAdmin[];
}

// ─── ChatbotAdmin Model ─────────────────────────────────────────────────────
export class ChatbotAdmin extends Model<InferAttributes<ChatbotAdmin>, InferCreationAttributes<ChatbotAdmin>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare name: string;
  declare email: string;
  declare password: string; // bcrypt hashed
  declare is_standalone: CreationOptional<boolean>;
  declare can_manage_knowledge: CreationOptional<boolean>;
  declare can_manage_system_prompt: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;

  // Relationship definitions
  declare chatbot?: ChatBot;
}

// ─── Messages Model ─────────────────────────────────────────────────────────
export class Messages extends Model<InferAttributes<Messages>, InferCreationAttributes<Messages>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare sender_id: string;
  declare message: string;
  declare sender_type: CreationOptional<'user' | 'bot'>;
  declare sent_date: CreationOptional<Date>;
}

// ─── SummerizeMessages Model ─────────────────────────────────────────────────
export class SummerizeMessages extends Model<InferAttributes<SummerizeMessages>, InferCreationAttributes<SummerizeMessages>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare sender_id: string;
  declare summary: string;
  declare created_at: CreationOptional<Date>;
}

// ─── TopUpHistory Model ──────────────────────────────────────────────────────
export class TopUpHistory extends Model<InferAttributes<TopUpHistory>, InferCreationAttributes<TopUpHistory>> {
  declare id: CreationOptional<number>;
  declare business_id: ForeignKey<Business['id']>;
  declare transaction_id: string;
  declare price: number; // decimal(10,2)
  declare billing_type: 'kpay' | 'cash' | 'none';
  declare topup_type: 'prepaid_credits' | 'subscription' | 'promotion';
  declare receipt_file_url: CreationOptional<string | null>;
  declare status: CreationOptional<'pending' | 'approved' | 'rejected'>;
  declare billing_date: CreationOptional<Date>;
  declare message_count: number; // credits added by this top-up

  // Relationship
  declare business?: Business;
}

// ─── Model Initialization ────────────────────────────────────────────────────
export function initModels(sequelize: Sequelize) {
  Business.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      detail_info: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      plan: {
        type: DataTypes.ENUM('free', 'prepaid_credits', 'subscription'),
        allowNull: false,
        defaultValue: 'free',
      },
      active_messages_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50, // Free plan gets 50 credits
      },
      subscription_end_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
      subscription_plan: {
        type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
        allowNull: true,
        defaultValue: null,
      },
      total_chatbots: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1, // Free plan: 1 chatbot
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
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      business_id: {
        type: DataTypes.INTEGER,
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
      bot_role: {
        type: DataTypes.ENUM('sales', 'faq', 'support', 'custom'),
        allowNull: false,
        defaultValue: 'sales',
      },
      custom_system_prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'chatbot',
      timestamps: false,
    }
  );

  ChatbotAdmin.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      is_standalone: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      can_manage_knowledge: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      can_manage_system_prompt: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'chatbot_admin',
      timestamps: false,
    }
  );

  Messages.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      sender_type: {
        type: DataTypes.ENUM('user', 'bot'),
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
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      chatbot_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.STRING(255),
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

  TopUpHistory.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      business_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      transaction_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      billing_type: {
        type: DataTypes.ENUM('kpay', 'cash', 'none'),
        allowNull: false,
      },
      topup_type: {
        type: DataTypes.ENUM('prepaid_credits', 'subscription', 'promotion'),
        allowNull: false,
      },
      receipt_file_url: {
        type: DataTypes.STRING(500),
        allowNull: true,
        defaultValue: null,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      billing_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      message_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'topup_history',
      timestamps: false,
    }
  );

  // ─── Associations ────────────────────────────────────────────────────────
  Business.hasMany(ChatBot, { foreignKey: 'business_id', as: 'chatbots' });
  ChatBot.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

  ChatBot.hasMany(Messages, { foreignKey: 'chatbot_id', as: 'messages' });
  Messages.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot' });

  ChatBot.hasMany(SummerizeMessages, { foreignKey: 'chatbot_id', as: 'summarizedMessages' });
  SummerizeMessages.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot' });

  Business.hasMany(TopUpHistory, { foreignKey: 'business_id', as: 'topUpHistory' });
  TopUpHistory.belongsTo(Business, { foreignKey: 'business_id', as: 'business' });

  ChatBot.hasMany(ChatbotAdmin, { foreignKey: 'chatbot_id', as: 'admins' });
  ChatbotAdmin.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot' });
}

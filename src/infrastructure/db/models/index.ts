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
  declare plan_id: CreationOptional<number | null>;
  declare subscription_plan: CreationOptional<string | null>;
  declare total_chatbots: CreationOptional<number>; // max allowed chatbots for current plan
  declare referred_by_reseller_id: CreationOptional<number | null>; // referrer tracking
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
  declare chatbot_id: ForeignKey<ChatBot['id']> | null;
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

// ─── Reseller Model ──────────────────────────────────────────────────────────
export class Reseller extends Model<InferAttributes<Reseller>, InferCreationAttributes<Reseller>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare password: string; // bcrypt hashed
  declare commission_percentage: CreationOptional<number>; // e.g. 10.00%
  declare balance: CreationOptional<number>; // commission wallet balance
  declare can_collect_payments: CreationOptional<boolean>; // flag to accept cash collection
  declare reliability_score: CreationOptional<number>; // trust rating (0 - 100)
  declare total_collected: CreationOptional<number>; // collected payments cash today
  declare kpay_no: string;
  declare kpay_name: string;
  declare custom_referrer_first_rate: CreationOptional<number | null>;
  declare custom_referrer_recurring_rate: CreationOptional<number | null>;
  declare custom_approver_rate: CreationOptional<number | null>;
  declare trust_score_factor: CreationOptional<number>;
  declare created_at: CreationOptional<Date>;
}

// ─── PlanRequest Model ────────────────────────────────────────────────────────
export class PlanRequest extends Model<InferAttributes<PlanRequest>, InferCreationAttributes<PlanRequest>> {
  declare id: CreationOptional<number>;
  declare business_id: ForeignKey<Business['id']>;
  declare reseller_id: ForeignKey<Reseller['id']> | null;
  declare plan_id: CreationOptional<number | null>;
  declare plan_name: string;
  declare screenshot_url: string; // URL file path, NO base64
  declare status: CreationOptional<'pending' | 'approved' | 'rejected'>;
  declare price: number;
  declare referrer_id: ForeignKey<Reseller['id']> | null;
  declare referrer_commission_rate: CreationOptional<number | null>;
  declare referrer_commission_amount: CreationOptional<number>;
  declare approver_commission_rate: CreationOptional<number | null>;
  declare approver_commission_amount: CreationOptional<number>;
  declare is_first_payment: CreationOptional<boolean>;
  declare created_at: CreationOptional<Date>;

  // Relationships
  declare business?: Business;
  declare reseller?: Reseller;
  declare referrer?: Reseller;
}

// ─── ChatbotActivity Model ───────────────────────────────────────────────────
export class ChatbotActivity extends Model<InferAttributes<ChatbotActivity>, InferCreationAttributes<ChatbotActivity>> {
  declare id: CreationOptional<number>;
  declare chatbot_id: ForeignKey<ChatBot['id']>;
  declare activity_date: string; // YYYY-MM-DD
  declare query_count: CreationOptional<number>;
  declare api_cost: CreationOptional<number>;
  declare active_duration_seconds: CreationOptional<number>;

  // Relationship
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

// ─── ResellerTopUp Model ─────────────────────────────────────────────────────
export class ResellerTopUp extends Model<InferAttributes<ResellerTopUp>, InferCreationAttributes<ResellerTopUp>> {
  declare id: CreationOptional<number>;
  declare reseller_id: ForeignKey<Reseller['id']>;
  declare amount_paid: number;
  declare credit_amount: number;
  declare screenshot_url: string;
  declare status: CreationOptional<'pending' | 'approved' | 'rejected'>;
  declare created_at: CreationOptional<Date>;

  // Relationships
  declare reseller?: Reseller;
}

// ─── Plan Model ──────────────────────────────────────────────────────────────
export class Plan extends Model<InferAttributes<Plan>, InferCreationAttributes<Plan>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare price: number;
  declare query_limit: number;
  declare duration_days: number;
  declare is_active: CreationOptional<boolean>;
  declare max_chat_history: CreationOptional<number>;
  declare services: CreationOptional<string[]>;
}

// ─── SystemSetting Model ─────────────────────────────────────────────────────
export class SystemSetting extends Model<InferAttributes<SystemSetting>, InferCreationAttributes<SystemSetting>> {
  declare id: CreationOptional<number>;
  declare referrer_first_month_rate: number;
  declare referrer_recurring_rate: number;
  declare approver_fee_rate: number;
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
      plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      subscription_plan: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: null,
      },
      total_chatbots: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1, // Free plan: 1 chatbot
      },
      referred_by_reseller_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
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
        allowNull: true,
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

  // ─── New Model Initializations ─────────────────────────────────────────────
  Reseller.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
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
      commission_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.00,
      },
      balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 5000.00,
      },
      can_collect_payments: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reliability_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      total_collected: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      kpay_no: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      kpay_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      custom_referrer_first_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
      custom_referrer_recurring_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
      custom_approver_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
      trust_score_factor: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.00,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'reseller',
      timestamps: false,
    }
  );

  PlanRequest.init(
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
      reseller_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      plan_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      plan_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      screenshot_url: {
        type: DataTypes.STRING(500),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      referrer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null,
      },
      referrer_commission_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
      referrer_commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      approver_commission_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null,
      },
      approver_commission_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      is_first_payment: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'plan_request',
      timestamps: false,
    }
  );

  Plan.init(
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
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      query_limit: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      max_chat_history: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
      },
      services: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      duration_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: 'plans',
      timestamps: false,
    }
  );

  SystemSetting.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      referrer_first_month_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 30.00,
      },
      referrer_recurring_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.00,
      },
      approver_fee_rate: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 10.00,
      },
    },
    {
      sequelize,
      tableName: 'system_settings',
      timestamps: false,
    }
  );

  ChatbotActivity.init(
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
      activity_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      query_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      api_cost: {
        type: DataTypes.DECIMAL(10, 5),
        allowNull: false,
        defaultValue: 0.00000,
      },
      active_duration_seconds: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    },
    {
      sequelize,
      tableName: 'chatbot_activity',
      timestamps: false,
    }
  );

  // ─── New Model Associations ────────────────────────────────────────────────
  Business.belongsTo(Reseller, { foreignKey: 'referred_by_reseller_id', as: 'referrer', constraints: false });
  Reseller.hasMany(Business, { foreignKey: 'referred_by_reseller_id', as: 'referredClients', constraints: false });

  PlanRequest.belongsTo(Business, { foreignKey: 'business_id', as: 'business', constraints: false });
  Business.hasMany(PlanRequest, { foreignKey: 'business_id', as: 'planRequests', constraints: false });

  PlanRequest.belongsTo(Reseller, { foreignKey: 'reseller_id', as: 'reseller', constraints: false });
  Reseller.hasMany(PlanRequest, { foreignKey: 'reseller_id', as: 'receivedRequests', constraints: false });

  PlanRequest.belongsTo(Reseller, { foreignKey: 'referrer_id', as: 'referrer', constraints: false });
  Reseller.hasMany(PlanRequest, { foreignKey: 'referrer_id', as: 'referredRequests', constraints: false });

  ChatbotActivity.belongsTo(ChatBot, { foreignKey: 'chatbot_id', as: 'chatbot', constraints: false });
  ChatBot.hasMany(ChatbotActivity, { foreignKey: 'chatbot_id', as: 'activities', constraints: false });

  ResellerTopUp.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      reseller_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      amount_paid: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      credit_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      screenshot_url: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'reseller_topup',
      timestamps: false,
    }
  );

  ResellerTopUp.belongsTo(Reseller, { foreignKey: 'reseller_id', as: 'reseller', constraints: false });
  Reseller.hasMany(ResellerTopUp, { foreignKey: 'reseller_id', as: 'topups', constraints: false });
}

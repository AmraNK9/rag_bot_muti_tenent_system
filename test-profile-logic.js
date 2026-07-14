const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize('postgresql://postgres:mysecretpassword@127.0.0.1:5434/chat-bot-sass', { logging: false });

const ChatbotAdmin = sequelize.define('chatbot_admin', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  chatbot_id: DataTypes.INTEGER,
}, { timestamps: false, freezeTableName: true });

const ChatBot = sequelize.define('chatbot', {
  name: DataTypes.STRING,
  business_id: DataTypes.INTEGER,
}, { timestamps: false, freezeTableName: true });

const Business = sequelize.define('business', {
  name: DataTypes.STRING,
  active_messages_count: DataTypes.INTEGER,
}, { timestamps: false, freezeTableName: true });

async function run() {
  await sequelize.authenticate();

  for (const email of ['sunandar@gmail.com', 'naymyo-1@gmail.com']) {
    console.log(`\n--- Test for ${email} ---`);
    const admin = await ChatbotAdmin.findOne({ where: { email } });
    if (!admin) {
        console.log('Admin not found');
        continue;
    }

    let chatbot = null;
    let credits = 0;

    if (admin.chatbot_id) {
        chatbot = await ChatBot.findByPk(admin.chatbot_id);
    }

    const business = chatbot
        ? await Business.findByPk(chatbot.business_id)
        : await Business.findOne({ where: { name: `Standalone_${admin.email}` } });

    if (!chatbot && business) {
        const possibleBot = await ChatBot.findOne({ where: { business_id: business.id } });
        if (possibleBot) {
            chatbot = possibleBot;
        }
    }

    if (business) {
        credits = business.active_messages_count;
    }

    console.log('Chatbot:', chatbot ? chatbot.toJSON() : null);
    console.log('Credits:', credits);
    console.log('Business:', business ? business.toJSON() : null);
  }

  process.exit(0);
}
run();

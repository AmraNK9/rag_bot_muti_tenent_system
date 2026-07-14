const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite'),
  logging: false
});

const ChatbotAdmin = sequelize.define('ChatbotAdmin', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  chatbot_id: DataTypes.INTEGER,
}, { timestamps: false });

const ChatBot = sequelize.define('ChatBot', {
  name: DataTypes.STRING,
}, { timestamps: false });

async function run() {
  const admins = await ChatbotAdmin.findAll();
  console.log('Admins:');
  admins.forEach(a => console.log(`ID: ${a.id}, Email: ${a.email}, ChatbotID: ${a.chatbot_id}`));
  
  const bots = await ChatBot.findAll();
  console.log('\nBots:');
  bots.forEach(b => console.log(`ID: ${b.id}, Name: ${b.name}`));
}

run();

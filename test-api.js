const jwt = require('jsonwebtoken');

const JWT_SECRET = 'your-jwt-secret-change-in-production';

async function run() {
  const token = jwt.sign({
    adminId: 5,
    chatbotId: null,
    name: 'hello thae',
    isStandalone: true,
    canManageKnowledge: true,
    canManageSystemPrompt: true,
  }, JWT_SECRET, { expiresIn: '7d' });

  try {
    const res = await fetch('http://localhost:3000/api/v1/chatbot-admin/profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    console.log('Profile Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}
run();

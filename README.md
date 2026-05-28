# 🤖 AI-Powered Chatbot Management Platform (MVP Backend)

A high-performance SaaS Chatbot Platform MVP Backend built using Node.js, TypeScript, Express, and Sequelize. The platform enables businesses to spin up AI-driven customer service agents on Telegram and Facebook Messenger, loaded with custom knowledge bases via RAG (Retrieval-Augmented Generation), billing/credit restrictions, custom prompts, and hybrid search capabilities.

---

## 🚀 Key Features

*   **👥 Multi-Tenant SaaS Structure:** Businesses can register accounts, sign up for subscription packages, check available message credits, and deploy multiple chatbots matching their quota limits.
*   **🧠 RAG-Powered AI Engine:** Integrates **DeepSeek LLM** and **Voyage AI Embeddings** coupled with **ChromaDB** vector storage to retrieve contextually accurate answers for customer inquiries.
*   **🇲🇲 Smart Myanmar Chunker:** Custom built chunking algorithm specifically optimized for Myanmar language text spacing and sentence structure to ensure clean text representation in ChromaDB.
*   **🛠️ Predefined & Custom Bot Roles:** 
    *   `sales` (Sales assistant mode)
    *   `faq` (Frequently Asked Questions bot)
    *   `support` (Customer support agent)
    *   `custom` (Fully custom system prompt provided by the business owner)
*   **🔍 Advanced Hybrid Search (Optional):** Supports pure Vector Cosine Similarity Search, or Hybrid Search combining vector proximity (70%) with Keyword Overlap ranking (30%).
*   **🏷️ Keyword Extraction:** Local regex-based keyword parser (default/fast) or LLM-driven query tool calling to retrieve context keys.
*   **⚡ Async Processing & Streaming:** Messages from Telegram are acknowledged immediately (200 OK), then processed asynchronously in the background. Supports real-time LLM streaming for minimal latency.
*   **💳 Billing & Top-Up System:** Inbuilt payment transaction verification. Businesses can request top-ups (prepaid credits or subscription upgrades) by entering KP-Pay transaction codes and receipt proof.
*   **🔐 Production-Grade Auth:** Secure JWT-based password authentication using bcrypt and jsonwebtoken, guarding `/api/v1/*` endpoints.
*   **📡 Automated Webhook Tunneling:** Instantly exposes the local server to a secure HTTPS public tunnel (via ngrok/Cloudflared) on dev startup, enabling direct Telegram webhook connection.
*   **🪵 Colored Debug Logger:** Granular console logs categorized by tags (`[KEYWORDS]`, `[VECTOR_SEARCH]`, `[KEYWORD_MATCH]`, `[STREAM]`, `[CREDITS]`) for active workflow debugging.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Runtime & Language** | Node.js (v20+), TypeScript (`tsx` for dev watch) |
| **Web Server** | Express.js |
| **Database ORM** | Sequelize (SQLite for dev, MySQL-ready for production) |
| **Vector DB** | ChromaDB |
| **AI / Embeddings** | DeepSeek (LLM), Voyage AI (Embeddings) |
| **APIs Exposed** | Production v1 API (`/api/v1/*`), Test Endpoint/UI (`/api/test/*` and dev UI) |

---

## 📂 Project Structure

```
├── src
│   ├── core                     # Global utilities (logger, error handlers)
│   ├── index.ts                 # Application bootstrap entry point
│   ├── infrastructure           # Core server connections & providers
│   │   ├── db                   # Sequelize instance & models
│   │   ├── embeddings           # Voyage AI service integration
│   │   ├── llm                  # DeepSeek LLM chat/streaming service
│   │   ├── registry             # LLM tool-calling registries
│   │   ├── prompt               # System prompt strategies & factory
│   │   ├── telegram             # Telegram Bot API connection wrapper
│   │   ├── tunnel               # Ngrok/Cloudflared web tunnels
│   │   └── vectorstore          # ChromaDB API actions
│   ├── modules                  # Business features & endpoints
│   │   ├── auth                 # Register/login services
│   │   ├── business             # Chatbot creation, listings
│   │   ├── chat                 # Memory management, RAG processor, Telegram webhooks
│   │   ├── knowledge            # Myanmar chunker & doc ingesters
│   │   └── subscription         # Credit deduction & KPay top-up history
│   └── presentation             # Routing, Middleware, and Dev Server
│       ├── api                  # Production routes (/api/v1)
│       ├── middleware           # Authorization headers & tokens
│       ├── public               # Development testing UI dashboard files
│       ├── testing              # Dev/test route hooks (/api/test)
│       └── server.ts            # Server orchestration logic
```

---

## ⚙️ Installation & Setup

### 1. Prerequisites
Ensure you have the following installed on your machine:
*   [Node.js](https://nodejs.org/) (v18 or higher)
*   [ChromaDB Vector Store](https://docs.trychroma.com/getting-started) (Running locally on port `8000`)
*   A database (SQLite is integrated by default, but you can configure MySQL/PostgreSQL in `.env`)
*   An active Telegram Bot token (Get one from [@BotFather](https://t.me/BotFather))

### 2. Install Dependencies
Clone the repository and run:
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory. You can copy the template from `.env.example`:
```bash
cp .env.example .env
```
Fill out the required values:
*   `DEEPSEEK_API_KEY` - Your DeepSeek API Token.
*   `VOYAGE_API_KEY` - Your Voyage AI Embedding Token.
*   `TELEGRAM_BOT_TOKEN` - The bot token for test integrations.
*   `JWT_SECRET` - Random secret key for signing user tokens.

### 4. Running the Project

#### Development Mode
Launches the server in dev mode with watch support, automatically starting the testing UI and tunneling service:
```bash
npm run dev
```

#### Production Build & Start
Compile the TypeScript code and start the compiled JS bundle:
```bash
npm run build
npm start
```
*Note: In production mode (`NODE_ENV=production`), testing routes and the local testing HTML dashboard UI are completely disabled for security.*

---

## 📑 API Integration Reference

All production endpoints require a secure JSON Web Token (JWT) provided in the headers:
```http
Authorization: Bearer <token_string>
```

For the complete API route specs, request schemas, Axios setup, and React TypeScript interface declarations, check:
👉 **[API Documentation / Integration Guide](C:\Users\USER\.gemini\antigravity\brain\514f925c-f8a7-4c32-b300-7da32e0d4374\api_documentation.md)**

---

## 🧪 Testing Dashboard
When running in `development` mode, you can open your browser to:
`http://localhost:3000` (or the configured `PORT`)

This dashboard provides visual UI widgets to:
1.  Manage businesses, chatbots, and upload custom prompts.
2.  Ingest custom Myanmar RAG text files directly into ChromaDB.
3.  Simulate user chats to verify RAG responses instantly.
4.  Submit dummy payment receipts and monitor KPay topups.

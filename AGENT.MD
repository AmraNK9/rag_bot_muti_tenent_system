# AI Agent Instructions for Chatbot Management Prototype

## 1. Project Overview
This is a SaaS backend for a multi-tenant Chatbot Management System. It handles subscription plans, Telegram webhook processing, and AI chatbot responses using RAG (Retrieval-Augmented Generation).
- **Tech Stack:** Node.js, Express, TypeScript, Sequelize (Postgres), Redis, Socket.io.

## 2. Architecture & File Structure
- `src/presentation/`: Controllers, Express Routes, Middleware.
- `src/modules/`: Business logic, services (e.g., chat, subscription, system-bot).
- `src/infrastructure/`: External integrations (Telegram, Database Models, VectorStore, LLM).
- `chatbot-admin-app/`: Frontend code for Tenant Admins (React/Vite).
- `total-admin-app/`: Frontend code for Super Admin (React/Vite).

## 3. Coding Guidelines
- Always write explicit return types for functions.
- Do not use `any`. Use proper interfaces.
- Prefer `async/await` over raw Promises.
- For dependency injection, we currently use a manual container (`src/presentation/container.ts`).

## 4. Operational Rules (CRITICAL)
- **APPROVAL REQUIRED BEFORE CODE MODIFICATION:** Before making any code changes, you MUST:
  1. Explain the current code logic flow.
  2. Explain the pros (advantages) and cons (disadvantages) of the proposed changes.
  3. Explain the potential consequences or side effects of the changes.
  4. Explicitly ask the user for permission to proceed with the code modification.
- Before modifying Database Models (`src/infrastructure/db/models`), always inform the user.
- Do NOT modify existing webhooks unless requested.
- Always use `debugLogger` for logging pipeline processes.
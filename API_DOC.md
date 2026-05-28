# Chatbot Management Prototype: API Documentation

Welcome to the API Documentation for the **Chatbot Management System**. This document is prepared specifically for frontend developers building a React (or React Native) client application to integrate seamlessly with the production-ready API.

---

## ─── 1. General API & Integration Conventions ───

### Base URL
- **Development / Local**: `http://localhost:<PORT>/api/v1`
- **Production**: `https://your-api-domain.com/api/v1`
- **Telegram Incoming Webhook Base** (for third-party webhooks): `http://localhost:<PORT>/webhook`

### HTTP Headers
For all endpoints requiring authentication, you must supply the JWT token inside the `Authorization` header:
```http
Content-Type: application/json
Authorization: Bearer <your_jwt_token_here>
```

### Global Response Wrapper
Every API response follows a consistent wrapper design:

#### Success Response Shape
```json
{
  "success": true,
  // endpoint-specific data fields go here
}
```

#### Error Response Shape
```json
{
  "success": false,
  "error": "Detailed error message explanation"
}
```

### Axios Interceptor Client Example (React)
Save this inside your React project (e.g., `src/api/client.ts`) to manage authentication headers and token expiration gracefully:

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Inject bearer token automatically
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Redirect to login on 401 Unauthorized
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expired. Redirecting to login...');
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

---

## ─── 2. Auth Endpoints ───

### 2.1 Register Business Account
Sign up a new business profile. Upon success, a JWT is returned.

- **Method**: `POST`
- **Path**: `/auth/register`
- **Auth Required**: ❌ No
- **Request Body**:
  ```json
  {
    "name": "Unique Business Name",
    "detailInfo": "Detailed description of the business profile (used for chatbot RAG context).",
    "password": "securepassword123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "business": {
      "id": 1,
      "name": "Unique Business Name",
      "plan": "free"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing required fields: "name", "detailInfo", and "password".
  - `500 Internal Server Error`: Business name already exists or database failure.

---

### 2.2 Login Business Account
Authenticate credentials to fetch a new JWT token.

- **Method**: `POST`
- **Path**: `/auth/login`
- **Auth Required**: ❌ No
- **Request Body**:
  ```json
  {
    "name": "Unique Business Name",
    "password": "securepassword123"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "business": {
      "id": 1,
      "name": "Unique Business Name",
      "plan": "free",
      "active_messages_count": 50
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing required fields: "name" and "password".
  - `401 Unauthorized`: Invalid credentials / account not found.

---

## ─── 3. Business Profile ───

### 3.1 Get Profile Information
Fetch full account details, subscription information, chatbot quotas, and limits.

- **Method**: `GET`
- **Path**: `/profile`
- **Auth Required**: ✅ Yes
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "profile": {
      "id": 1,
      "name": "Unique Business Name",
      "plan": "free",
      "activeMessagesCount": 50,
      "subscriptionPlan": null,
      "subscriptionEndDate": null,
      "totalChatbots": 1,
      "currentChatbotCount": 0
    }
  }
  ```
  > [!NOTE]
  > The key `plan` determines the billing structure: `'free' | 'prepaid_credits' | 'subscription'`.
  > `activeMessagesCount` indicates remaining AI message response credits available.
  - **Error Responses**:
    - `401 Unauthorized`: Invalid or missing token.
    - `500 Internal Server Error`: Server retrieval error.

---

## ─── 4. Chatbot Management ───

### 4.1 Create Chatbot
Provision a new AI Agent for Telegram or Facebook Messenger.

- **Method**: `POST`
- **Path**: `/chatbots`
- **Auth Required**: ✅ Yes
- **Request Body**:
  ```json
  {
    "name": "Shop Helper Bot",
    "token": "1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ",
    "type": "telegram",
    "botRole": "sales",
    "customSystemPrompt": "Optional custom system instructions for LLM behavior",
    "apiId": "12345",
    "apiHash": "abcdef0123456789abcdef0123456789"
  }
  ```
  > [!IMPORTANT]
  > - `type` must be exactly `"telegram"` or `"facebook"`.
  > - `botRole` must be one of: `"sales" | "faq" | "support" | "custom"`.
  > - `apiId` and `apiHash` are optional string fields (specifically for Telegram userbot integrations if applicable).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "chatbot": {
      "id": 5,
      "business_id": 1,
      "name": "Shop Helper Bot",
      "token": "1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ",
      "type": "telegram",
      "bot_role": "sales",
      "custom_system_prompt": "Optional custom system instructions for LLM behavior",
      "api_id": "12345",
      "api_hash": "abcdef0123456789abcdef0123456789",
      "knoweledge_key": null
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing required fields: "name", "token", and "type" / Invalid type value.
  - `403 Forbidden`: Chatbot limit reached. The business subscription quota (e.g. `total_chatbots` limit) restricts creating more chatbots.
  - `401 Unauthorized`: Token error.

---

### 4.2 List Chatbots
Fetch all chatbots created by the authenticated business account.

- **Method**: `GET`
- **Path**: `/chatbots`
- **Auth Required**: ✅ Yes
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "chatbots": [
      {
        "id": 5,
        "business_id": 1,
        "name": "Shop Helper Bot",
        "token": "1234567890:ABC...",
        "type": "telegram",
        "bot_role": "sales",
        "custom_system_prompt": null,
        "api_id": null,
        "api_hash": null,
        "knoweledge_key": 102
      }
    ]
  }
  ```

---

### 4.3 Delete Chatbot
Delete a chatbot configuration.

- **Method**: `DELETE`
- **Path**: `/chatbots/:id`
- **Auth Required**: ✅ Yes
- **URL Parameters**:
  - `id`: Chatbot database ID (number)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "message": "ChatBot 5 deleted successfully."
  }
  ```
- **Error Responses**:
  - `404 Not Found`: ChatBot with ID not found.
  - `403 Forbidden`: Access denied (this chatbot belongs to another business profile).

---

## ─── 5. Knowledge Management ───

### 5.1 Ingest Knowledge Document
Provide raw text data (documents, FAQs, product listings) to embed and store in ChromaDB for Retrieval-Augmented Generation (RAG).

- **Method**: `POST`
- **Path**: `/knowledge/ingest`
- **Auth Required**: ✅ Yes
- **Request Body**:
  ```json
  {
    "chatbotId": 5,
    "documentText": "Samsung S24 Ultra features a highly advanced 200MP camera and Snapdragon 8 Gen 3 chipset. Retail price is 1,200 USD.",
    "maxChunkSize": 300,
    "overlap": 50
  }
  ```
  > [!TIP]
  > `maxChunkSize` (default: 500 characters) and `overlap` (default: 50 characters) control RAG parsing parameters and are optional.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "chatbotId": 5,
    "chunksCount": 1,
    "status": "success",
    "message": "Knowledge ingestion completed successfully."
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing "chatbotId" or "documentText".
  - `403 Forbidden`: Chatbot ID not found or doesn't belong to your business.

---

## ─── 6. Telegram Webhook Controls ───

Registering webhooks connects your Telegram bots directly to the system's message processing flow.

### 6.1 Register & Start Telegram Webhook
Automatically starts a local HTTP tunnel (for development environments) or binds the production URL, and registers it as a Telegram Bot API webhook.

- **Method**: `POST`
- **Path**: `/chatbots/:id/webhook`
- **Auth Required**: ✅ Yes
- **URL Parameters**:
  - `id`: Chatbot database ID (number)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "webhookUrl": "https://active-tunnel-url.ngrok-free.app/webhook/1/5",
    "telegram": {
      "ok": true,
      "result": true,
      "description": "Webhook was set"
    }
  }
  ```

---

### 6.2 Get Webhook Status
Checks Telegram's server configuration status for this bot.

- **Method**: `GET`
- **Path**: `/chatbots/:id/webhook`
- **Auth Required**: ✅ Yes
- **URL Parameters**:
  - `id`: Chatbot database ID (number)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "webhookInfo": {
      "url": "https://active-tunnel-url.ngrok-free.app/webhook/1/5",
      "has_custom_certificate": false,
      "pending_update_count": 0,
      "max_connections": 40
    }
  }
  ```

---

### 6.3 Delete Webhook
Removes/unregisters the webhook configuration from Telegram.

- **Method**: `DELETE`
- **Path**: `/chatbots/:id/webhook`
- **Auth Required**: ✅ Yes
- **URL Parameters**:
  - `id`: Chatbot database ID (number)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "telegram": {
      "ok": true,
      "result": true,
      "description": "Webhook was deleted"
    }
  }
  ```

---

## ─── 7. Credits & Billing (KPay Payments) ───

The system relies on message credits (`active_messages_count`) to pay for incoming AI queries. Accounts can request top-ups by submitting transactions and uploading receipt receipts (mostly KBZPay / Cash).

### 7.1 Check Credits Balance
Get detailed plan structure and remaining token credits.

- **Method**: `GET`
- **Path**: `/credits`
- **Auth Required**: ✅ Yes
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "plan": "prepaid_credits",
    "activeMessagesCount": 750,
    "subscriptionPlan": null,
    "subscriptionEndDate": null,
    "totalChatbots": 2
  }
  ```

---

### 7.2 Submit Top-Up Request
Submit a payment transaction for approval (prepaid message credits or subscription upgrades).

- **Method**: `POST`
- **Path**: `/topup`
- **Auth Required**: ✅ Yes
- **Request Body**:
  ```json
  {
    "transactionId": "KP-983021948",
    "price": 15000,
    "billingType": "kpay",
    "topupType": "prepaid_credits",
    "receiptFileUrl": "https://storage.provider.com/receipts/KP-983021948.png",
    "messageCount": 1000
  }
  ```
  > [!IMPORTANT]
  > - `billingType` must be one of: `"kpay" | "cash" | "none"`.
  > - `topupType` must be one of: `"prepaid_credits" | "subscription" | "promotion"`.
  > - `price` and `messageCount` must be numbers.
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "topUp": {
      "id": 14,
      "business_id": 1,
      "transaction_id": "KP-983021948",
      "price": 15000,
      "billing_type": "kpay",
      "topup_type": "prepaid_credits",
      "receipt_file_url": "https://storage.provider.com/receipts/KP-983021948.png",
      "status": "pending",
      "message_count": 1000,
      "billing_date": "2026-05-28T10:44:16.000Z"
    }
  }
  ```

---

### 7.3 Get Top-up History
Retrieve past top-ups and check approval status.

- **Method**: `GET`
- **Path**: `/topup/history`
- **Auth Required**: ✅ Yes
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "history": [
      {
        "id": 14,
        "business_id": 1,
        "transaction_id": "KP-983021948",
        "price": 15000,
        "billing_type": "kpay",
        "topup_type": "prepaid_credits",
        "receipt_file_url": "https://storage.provider.com/receipts/KP-983021948.png",
        "status": "pending",
        "message_count": 1000,
        "billing_date": "2026-05-28T10:44:16.000Z"
      }
    ]
  }
  ```

---

## ─── 8. Direct Webhook Endpoint (For Telegram API) ───

While not directly queried by the React UI, this is the callback endpoint configured on Telegram's side.

### 8.1 Incoming Chat Webhook (Raw Update)
- **Method**: `POST`
- **Path**: `/webhook/:businessId/:chatbotId`
- **Auth Required**: ❌ No (Secure token verification is managed internally via matching URLs)
- **URL Parameters**:
  - `businessId`: business owner ID
  - `chatbotId`: Chatbot ID
- **Body**: Standard JSON Update payload from the Telegram Bot API.
- **Immediate Response**: `200 OK` (immediately dispatched, messages are processed asynchronously in the background).

---

## ─── 9. TypeScript Types Reference ───

For frontend apps utilizing TypeScript, define these interfaces in your React project (e.g. `src/types/api.ts`) to enforce correct structure compile-time:

```typescript
// Shared Types & Enums
export type PlanType = 'free' | 'prepaid_credits' | 'subscription';
export type BotType = 'telegram' | 'facebook';
export type BotRole = 'sales' | 'faq' | 'support' | 'custom';
export type BillingType = 'kpay' | 'cash' | 'none';
export type TopUpType = 'prepaid_credits' | 'subscription' | 'promotion';
export type TopUpStatus = 'pending' | 'approved' | 'rejected';

// Models
export interface BusinessProfile {
  id: number;
  name: string;
  plan: PlanType;
  activeMessagesCount: number;
  subscriptionPlan: 'basic' | 'pro' | 'enterprise' | null;
  subscriptionEndDate: string | null; // ISO Date String
  totalChatbots: number;
  currentChatbotCount: number;
}

export interface ChatBot {
  id: number;
  business_id: number;
  name: string;
  token: string;
  type: BotType;
  bot_role: BotRole;
  custom_system_prompt: string | null;
  api_id: string | null;
  api_hash: string | null;
  knoweledge_key: number | null;
}

export interface TopUpRecord {
  id: number;
  business_id: number;
  transaction_id: string;
  price: number;
  billing_type: BillingType;
  topup_type: TopUpType;
  receipt_file_url: string | null;
  status: TopUpStatus;
  message_count: number;
  billing_date: string; // ISO Date String
}

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  error?: string;
  data?: T; // For custom wrappers
}

export interface AuthResponse {
  success: boolean;
  token: string;
  business: {
    id: number;
    name: string;
    plan: PlanType;
    active_messages_count?: number;
  };
}

export interface ProfileResponse {
  success: boolean;
  profile: BusinessProfile;
}

export interface CreateChatbotResponse {
  success: boolean;
  chatbot: ChatBot;
}

export interface ListChatbotsResponse {
  success: boolean;
  chatbots: ChatBot[];
}

export interface IngestKnowledgeResponse {
  success: boolean;
  chatbotId: number;
  chunksCount: number;
  status: 'success';
  message: string;
}

export interface WebhookRegisterResponse {
  success: boolean;
  webhookUrl: string;
  telegram: {
    ok: boolean;
    result: boolean;
    description: string;
  };
}

export interface WebhookInfoResponse {
  success: boolean;
  webhookInfo: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    max_connections: number;
  };
}

export interface TopUpResponse {
  success: boolean;
  topUp: TopUpRecord;
}

export interface TopUpHistoryResponse {
  success: boolean;
  history: TopUpRecord[];
}
```

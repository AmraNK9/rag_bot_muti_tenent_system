import { Messages, SummerizeMessages, ChatBot, Business, Plan } from '../../../infrastructure/db/models';
import { ILLMService } from '../../../core/interfaces/llm.interface';
import { Op } from 'sequelize';
import { redisService } from '../../../infrastructure/redis/redis.service';

export class ChatMemoryService {
  constructor(private llmService: ILLMService) {}

  /**
   * Saves a message to the database. If the count of unsummarized messages reaches 20,
   * triggers background summarization and writes to SummerizeMessages.
   */
  async saveMessage(
    chatbotId: number,
    senderId: string,
    messageContent: string,
    isUser = true
  ): Promise<Messages> {
    // 1. Save the new message with sender_type.
    const message = await Messages.create({
      chatbot_id: chatbotId,
      sender_id: senderId,
      message: messageContent,
      sender_type: isUser ? 'user' : 'bot',
      reply_source: isUser ? null : 'ai',
      sent_date: new Date(),
    });

    // 1.5 Sync to Redis Chat Session Cache (Fire-and-forget for speed)
    const sessionKey = `chat_history:${chatbotId}:${senderId}`;
    const serializedMessage = JSON.stringify({
      id: message.id,
      sender_type: message.sender_type,
      message: message.message,
      reply_source: message.reply_source,
      sent_date: message.sent_date
    });
    
    void (async () => {
      try {
        const limitKey = `chatbot:${chatbotId}:history_limit`;
        let historyLimit = 10;
        const cachedLimit = await redisService.get(limitKey);
        if (cachedLimit) historyLimit = parseInt(cachedLimit, 10);
        
        await redisService.rPush(sessionKey, serializedMessage);
        // Keep only the latest N messages (-N to -1)
        await redisService.lTrim(sessionKey, -historyLimit, -1);
        // Set TTL to 12 hours (43200 seconds)
        await redisService.expire(sessionKey, 43200);
      } catch (err) {
        console.error('[ChatMemory] Redis chat session sync failed:', err);
      }
    })();

    // 2. Fire-and-forget: trigger background summarization check.
    //    This does NOT block the message save — the caller gets the result immediately.
    if (process.env.USE_HISTORY_SUMMARIZATION === 'true') {
      void this.checkAndSummarize(chatbotId, senderId).catch(err => {
        console.error('Background summarization failed (non-blocking):', err);
      });
    }

    return message;
  }

  /**
   * Checks if unsummarized message count has reached the threshold (20)
   * and triggers LLM summarization if needed. Runs in the background.
   */
  private async checkAndSummarize(chatbotId: number, senderId: string): Promise<void> {
    // Fetch the latest summary to determine the time window
    const latestSummary = await SummerizeMessages.findOne({
      where: {
        chatbot_id: chatbotId,
        sender_id: senderId,
      },
      order: [['created_at', 'DESC']],
    });

    // Count messages since the last summary
    const unsummarizedCount = await Messages.count({
      where: {
        chatbot_id: chatbotId,
        sender_id: senderId,
        ...(latestSummary ? { sent_date: { [Op.gt]: latestSummary.created_at } } : {}),
      },
    });

    // Summarize history if threshold (20 messages) is reached
    if (unsummarizedCount >= 20) {
      const messagesToSummarize = await Messages.findAll({
        where: {
          chatbot_id: chatbotId,
          sender_id: senderId,
          ...(latestSummary ? { sent_date: { [Op.gt]: latestSummary.created_at } } : {}),
        },
        order: [['sent_date', 'ASC']],
      });

      const historyPayload = messagesToSummarize.map(m => ({
        sender: m.sender_type === 'user' ? 'User' : 'Assistant',
        text: m.message,
      }));

      const newSummary = await this.llmService.summarizeChatHistory(
        latestSummary ? latestSummary.summary : null,
        historyPayload
      );

      await SummerizeMessages.create({
        chatbot_id: chatbotId,
        sender_id: senderId,
        summary: newSummary,
        created_at: new Date(),
      });

      console.log(`[ChatMemory] Background summarization completed for chatbot=${chatbotId}, sender=${senderId}`);
    }
  }

  /**
   * Retrieves context delivery: last 10 messages + the latest SummerizeMessage.
   */
  async getContextForChat(
    chatbotId: number,
    senderId: string
  ): Promise<{
    summary: string | null;
    recentMessages: Messages[];
  }> {
    // 1. Fetch latest summary (Only if enabled)
    let latestSummary = null;
    if (process.env.USE_HISTORY_SUMMARIZATION === 'true') {
      latestSummary = await SummerizeMessages.findOne({
        where: {
          chatbot_id: chatbotId,
          sender_id: senderId,
        },
        order: [['created_at', 'DESC']],
      });
    }

    // 2. Determine max history limit from the Business's Plan with Redis Caching
    let historyLimit = 10;
    const cacheKey = `chatbot:${chatbotId}:history_limit`;

    try {
      // Check cache first
      const cachedLimit = await redisService.get(cacheKey);
      if (cachedLimit) {
        historyLimit = parseInt(cachedLimit, 10);
        console.log(`[ChatMemory] Fetched historyLimit (${historyLimit}) from Redis Cache for chatbot=${chatbotId}`);
      } else {
        // Cache Miss: Query DB (Heavy Join)
        const chatbot = await ChatBot.findByPk(chatbotId, {
          include: [{ model: Business, as: 'business' }]
        });
        
        if (chatbot && chatbot.business) {
          if (chatbot.business.plan_id) {
            const plan = await Plan.findByPk(chatbot.business.plan_id);
            if (plan && plan.max_chat_history) historyLimit = plan.max_chat_history;
          } else if (chatbot.business.subscription_plan) {
            // Fallback to string name matching
            const plan = await Plan.findOne({ where: { name: chatbot.business.subscription_plan } });
            if (plan && plan.max_chat_history) historyLimit = plan.max_chat_history;
          }
        }

        // Save to cache with TTL (Time-To-Live). 
        // 604800 seconds = 7 days. This acts as a safety net even if cache invalidation fails.
        await redisService.set(cacheKey, historyLimit.toString(), { EX: 604800 });
        console.log(`[ChatMemory] Queried DB and cached historyLimit (${historyLimit}) for chatbot=${chatbotId} with 7d TTL`);
      }
    } catch (err) {
      console.error('[ChatMemory] Error fetching dynamic history limit:', err);
    }

    // 3. Fetch recent messages (Redis Chat Session Cache)
    const sessionKey = `chat_history:${chatbotId}:${senderId}`;
    let recentMessages: Messages[] = [];

    try {
      const cachedMessages = await redisService.lRange(sessionKey, 0, -1);
      if (cachedMessages && cachedMessages.length > 0) {
        // Cache Hit!
        recentMessages = cachedMessages.map(msgStr => JSON.parse(msgStr) as Messages);
        console.log(`[ChatMemory] Fetched ${recentMessages.length} messages from Redis Session for chatbot=${chatbotId}`);
      } else {
        // Cache Miss! Fetch from DB
        const dbMessages = await Messages.findAll({
          where: {
            chatbot_id: chatbotId,
            sender_id: senderId,
          },
          order: [['sent_date', 'DESC']],
          limit: historyLimit,
        });

        // Reverse to ascending chronological order
        dbMessages.reverse();
        recentMessages = dbMessages;

        // Populate Cache
        if (dbMessages.length > 0) {
          void (async () => {
            try {
              for (const msg of dbMessages) {
                const serialized = JSON.stringify({
                  id: msg.id, sender_type: msg.sender_type, message: msg.message,
                  reply_source: msg.reply_source, sent_date: msg.sent_date
                });
                await redisService.rPush(sessionKey, serialized);
              }
              await redisService.expire(sessionKey, 43200); // 12 hours
              console.log(`[ChatMemory] DB Miss: Populated ${dbMessages.length} messages to Redis Session for chatbot=${chatbotId}`);
            } catch(e) {
              console.error('[ChatMemory] Failed to populate Redis Session:', e);
            }
          })();
        }
      }
    } catch (err) {
      console.error('[ChatMemory] Redis Session fetch error, falling back to DB:', err);
      const dbMessages = await Messages.findAll({
        where: { chatbot_id: chatbotId, sender_id: senderId },
        order: [['sent_date', 'DESC']],
        limit: historyLimit,
      });
      dbMessages.reverse();
      recentMessages = dbMessages;
    }

    return {
      summary: latestSummary ? latestSummary.summary : null,
      recentMessages,
    };
  }
}

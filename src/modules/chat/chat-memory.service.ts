import { Messages, SummerizeMessages, ChatBot, Business, Plan } from '../../infrastructure/db/models';
import { ILLMService } from '../../core/interfaces/llm.interface';
import { Op } from 'sequelize';

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
      sent_date: new Date(),
    });

    // 2. Fire-and-forget: trigger background summarization check.
    //    This does NOT block the message save — the caller gets the result immediately.
    void this.checkAndSummarize(chatbotId, senderId).catch(err => {
      console.error('Background summarization failed (non-blocking):', err);
    });

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
    // 1. Fetch latest summary
    const latestSummary = await SummerizeMessages.findOne({
      where: {
        chatbot_id: chatbotId,
        sender_id: senderId,
      },
      order: [['created_at', 'DESC']],
    });

    // 2. Determine max history limit from the Business's Plan
    let historyLimit = 10;
    try {
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
    } catch (err) {
      console.error('[ChatMemory] Error fetching dynamic history limit:', err);
    }

    // 3. Fetch recent messages based on dynamic limit
    const recentMessages = await Messages.findAll({
      where: {
        chatbot_id: chatbotId,
        sender_id: senderId,
      },
      order: [['sent_date', 'DESC']],
      limit: historyLimit,
    });

    // Reverse to ascending chronological order
    recentMessages.reverse();

    return {
      summary: latestSummary ? latestSummary.summary : null,
      recentMessages,
    };
  }
}

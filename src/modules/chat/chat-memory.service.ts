import { Messages, SummerizeMessages } from '../../infrastructure/db/models';
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
    senderId: number,
    messageContent: string,
    isUser = true
  ): Promise<Messages> {
    // 1. Save the new message.
    const message = await Messages.create({
      chatbot_id: chatbotId,
      sender_id: senderId,
      message: messageContent,
      sent_date: new Date(),
    });

    try {
      // 2. Fetch the latest summary to determine the time window
      const latestSummary = await SummerizeMessages.findOne({
        where: {
          chatbot_id: chatbotId,
          sender_id: senderId,
        },
        order: [['created_at', 'DESC']],
      });

      // 3. Count messages since the last summary
      const unsummarizedCount = await Messages.count({
        where: {
          chatbot_id: chatbotId,
          sender_id: senderId,
          ...(latestSummary ? { sent_date: { [Op.gt]: latestSummary.created_at } } : {}),
        },
      });

      // 4. Summarize history if threshold (20 messages) is reached
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
          sender: m.sender_id === senderId ? 'User' : 'Assistant',
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
      }
    } catch (err) {
      console.error('Failed executing automatic background summary:', err);
    }

    return message;
  }

  /**
   * Retrieves context delivery: last 10 messages + the latest SummerizeMessage.
   */
  async getContextForChat(
    chatbotId: number,
    senderId: number
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

    // 2. Fetch last 10 messages
    const recentMessages = await Messages.findAll({
      where: {
        chatbot_id: chatbotId,
        sender_id: senderId,
      },
      order: [['sent_date', 'DESC']],
      limit: 10,
    });

    // Reverse to ascending chronological order
    recentMessages.reverse();

    return {
      summary: latestSummary ? latestSummary.summary : null,
      recentMessages,
    };
  }
}

import { ITool } from '../../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../../core/interfaces/llm.interface';
import { ChatBot, Business, Messages, ActionRequest } from '../../../infrastructure/db/models';
import { Op } from 'sequelize';
import { SystemBotService } from '../../system-bot/system-bot.service';

export interface RequestHumanAgentArgs {
  action_type: 'human_chat' | 'order_req' | 'discount_req' | 'checkout_req' | 'other';
  summary: string;
}

export class RequestHumanAgentTool implements ITool {
  definition: ToolDefinition = {
    name: 'RequestHumanAgentTool',
    description: 'Triggers an action banner for the human admin. Use this when the customer wants to buy an item, asks for a discount,asks for a checkout or explicitly asks for human staff support.',
    parameters: {
      type: 'object',
      properties: {
        action_type: {
          type: 'string',
          enum: ['human_chat', 'order_req', 'discount_req', 'checkout_req', 'other'],
          description: 'The type of action required by the admin.',
        },
        summary: {
          type: 'string',
          description: 'Brief description of what the customer is requesting (e.g. "Customer wants to buy 1 iPhone 14", "Customer requested 10% discount").Provide with Myanmar Language',
        },
      },
      required: ['action_type', 'summary'],
    },
  };

  async execute(args: RequestHumanAgentArgs, context?: { chatbotId?: number; senderId?: string }): Promise<{ status: string; message: string }> {
    const action_type = args.action_type || 'other';
    const summary = args.summary || 'Customer requested staff intervention.';
    const chatbotId = context?.chatbotId;
    const senderId = context?.senderId || 'Customer';

    console.log(`[RequestHumanAgentTool] Executing for chatbotId=${chatbotId}, senderId=${senderId}, action_type="${action_type}", summary="${summary}"`);
    if (chatbotId) {
      try {
        const chatbot = await ChatBot.findByPk(chatbotId);
        if (chatbot && chatbot.business_id) {
          // 0. Debounce: Prevent spamming if already requested in the last 2 minutes
          const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
          const recentRequest = await Messages.findOne({
            where: {
              chatbot_id: chatbotId,
              sender_id: senderId,
              sender_type: 'bot',
              message: { [Op.like]: '[ACTION_REQUIRED:%' },
              sent_date: { [Op.gte]: twoMinsAgo }
            }
          });

          if (recentRequest) {
            console.log(`[RequestHumanAgentTool] Debounced: Action already requested recently for ${senderId}.`);
            return {
              status: 'success',
              message: `Admin is already notified recently. Tell the customer to wait patiently.`,
            };
          }

          // 1. Create in-app system message for admin (Action Banner trigger)
          try {
            // Create the ActionRequest DB record for persistence
            const newReq = await ActionRequest.create({
              chatbot_id: chatbotId,
              sender_id: senderId,
              action_type: action_type,
              summary: summary,
              status: 'pending'
            });

            const sysMsg = await Messages.create({
              chatbot_id: chatbotId,
              sender_id: senderId,
              message: `[ACTION_REQUIRED:${action_type}] ${summary}`,
              sender_type: 'bot',
              reply_source: 'ai'
            });
            const { SocketService } = await import('../../../infrastructure/socket/socket.service');
            SocketService.io.to(chatbotId.toString()).emit('new_message', sysMsg.toJSON());
            // Emit new action request event
            SocketService.io.to(chatbotId.toString()).emit('new_action_request', newReq.toJSON());
            console.log(`[RequestHumanAgentTool] In-app action banner notification created.`);
          } catch (mErr) {
            console.error('[RequestHumanAgentTool In-App Msg Error]', mErr);
          }

          // 2. Telegram Alert to Business Owner
          const business = await Business.findByPk(chatbot.business_id);
          if (business) {
            console.log(`[RequestHumanAgentTool] Business #${business.id} (${business.name}), telegram_chat_id: ${business.telegram_chat_id || 'NOT LINKED'}`);
            if (business.telegram_chat_id) {
              const systemBotService = new SystemBotService();
              await systemBotService.notifyBusinessHumanAgentNeeded(business.telegram_chat_id, {
                chatbotName: chatbot.name,
                senderId: senderId,
                reason: `[${action_type}] ${summary}`,
              });
              console.log(`[RequestHumanAgentTool] Sent Telegram alert to ChatID ${business.telegram_chat_id}`);
            }
          }
        }
      } catch (err) {
        console.error('[RequestHumanAgentTool Error]', err);
      }
    }

    return {
      status: 'success',
      message: `Successfully notified the admin regarding ${action_type}. Tell the customer that you have notified the admin and they should wait for the admin's response.`,
    };
  }
}

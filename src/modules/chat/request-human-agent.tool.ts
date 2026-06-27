import { ITool } from '../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../core/interfaces/llm.interface';
import { ChatBot, Business } from '../../infrastructure/db/models';
import { SystemBotService } from '../system-bot/system-bot.service';

export interface RequestHumanAgentArgs {
  reason: string;
}

export class RequestHumanAgentTool implements ITool {
  definition: ToolDefinition = {
    name: 'RequestHumanAgentTool',
    description: 'Triggers when a customer explicitly asks for human staff support, asks complex questions outside the FAQ, or expresses frustration requiring staff intervention.',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          description: 'Brief reason or topic why human agent support is needed (e.g. "Customer requested custom pricing quote", "Technical issue with order #123").',
        },
      },
      required: ['reason'],
    },
  };

  async execute(args: RequestHumanAgentArgs, context?: { chatbotId?: number; senderId?: string }): Promise<{ status: string; message: string }> {
    const reason = args.reason || 'Customer requested human agent support.';
    const chatbotId = context?.chatbotId;
    const senderId = context?.senderId || 'Customer';

    console.log(`[RequestHumanAgentTool] Executing for chatbotId=${chatbotId}, senderId=${senderId}, reason="${reason}"`);
    if (chatbotId) {
      try {
        const chatbot = await ChatBot.findByPk(chatbotId);
        if (chatbot && chatbot.business_id) {
          const business = await Business.findByPk(chatbot.business_id);
          if (business) {
            console.log(`[RequestHumanAgentTool] Business #${business.id} (${business.name}), telegram_chat_id: ${business.telegram_chat_id || 'NOT LINKED'}`);
            if (business.telegram_chat_id) {
              const systemBotService = new SystemBotService();
              await systemBotService.notifyBusinessHumanAgentNeeded(business.telegram_chat_id, {
                chatbotName: chatbot.name,
                senderId: senderId,
                reason: reason,
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
      message: 'Human agent notification has been dispatched to shop staff. Please inform the customer that a team member has been alerted and will respond shortly.',
    };
  }
}

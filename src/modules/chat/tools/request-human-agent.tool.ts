import { ITool } from '../../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../../core/interfaces/llm.interface';
import { ChatBot, Business, Messages } from '../../../infrastructure/db/models';
import { SystemBotService } from '../../system-bot/system-bot.service';

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
          // 1. Create in-app system message in customer chat thread
          try {
            const custMsg = await Messages.create({
              chatbot_id: chatbotId,
              sender_id: senderId,
              message: `🙋‍♂️ [SYSTEM ALERT] လူကြီးမင်း၏ အကြောင်းကြားစာကို ဆိုင်ဝန်ထမ်းထံ ပေးပို့လိုက်ပါပြီ။ ခေတ္တစောင့်ဆိုင်းပေးပါခင်ဗျာ။`,
              sender_type: 'system',
            });
            const sysMsg = await Messages.create({
              chatbot_id: chatbotId,
              sender_id: 'system',
              message: `🙋‍♂️ [STAFF REQUEST] Customer User #${senderId} requested staff intervention. Reason: ${reason}`,
              sender_type: 'system',
            });
            const { SocketService } = await import('../../../infrastructure/socket/socket.service');
            SocketService.io.to(chatbotId.toString()).emit('new_message', custMsg.toJSON());
            SocketService.io.to(chatbotId.toString()).emit('new_message', sysMsg.toJSON());
            console.log(`[RequestHumanAgentTool] In-app system notifications created and emitted via WebSocket.`);
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

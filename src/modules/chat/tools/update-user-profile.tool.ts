import { ITool } from '../../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../../core/interfaces/llm.interface';
import { ChatbotUser } from '../../../infrastructure/db/models';
import { redisService } from '../../../infrastructure/redis/redis.service';

export interface UpdateUserProfileArgs {
  key: string;
  value: string | number | boolean;
}

export class UpdateUserProfileTool implements ITool {
  definition: ToolDefinition = {
    name: 'UpdateUserProfileTool',
    description: 'Updates the user profile with important facts, preferences, or personal details mentioned by the user (e.g. name, phone number, language, interests, address). Trigger this when the user states a fact about themselves.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The attribute name (e.g. "name", "phone", "address", "language", "favorite_color", "shoe_size"). Keep it short and snake_case.',
        },
        value: {
          type: 'string',
          description: 'The value for the attribute (e.g. "John Doe", "09...", "Yangon", "Myanmar").',
        },
      },
      required: ['key', 'value'],
    },
  };

  /**
   * Action handler called when the tool is executed.
   */
  async execute(args: UpdateUserProfileArgs, context?: any): Promise<any> {
    const { key, value } = args;
    
    // We expect chatbotId and senderId to be passed in the context from retrieval-generation.service
    if (!context || !context.chatbotId || !context.senderId) {
      console.warn('[UpdateUserProfileTool] Missing context (chatbotId or senderId). Cannot save profile.');
      return { success: false, reason: 'Missing context' };
    }

    try {
      // Find or create the user profile
      let user = await ChatbotUser.findOne({
        where: {
          chatbot_id: context.chatbotId,
          sender_id: context.senderId,
        },
      });

      if (!user) {
        user = await ChatbotUser.create({
          chatbot_id: context.chatbotId,
          sender_id: context.senderId,
          profile_data: {},
        });
      }

      // Merge the new fact into the existing profile JSON
      const currentProfile = user.profile_data || {};
      currentProfile[key] = value;

      user.profile_data = currentProfile;
      user.changed('profile_data', true);
      await user.save();

      // Invalidate the Redis cache so the new fact is fetched on the next message
      try {
        await redisService.del(`user_profile:${context.chatbotId}:${context.senderId}`);
      } catch (err) {
        console.warn('[UpdateUserProfileTool] Failed to invalidate Redis cache:', err);
      }

      console.log(`[UpdateUserProfileTool] Saved fact to DB: { ${key}: ${value} } for Sender ${context.senderId}`);

      return {
        success: true,
        message: `Successfully saved ${key} = ${value} to user profile.`,
        profile: currentProfile,
      };
    } catch (error) {
      console.error('[UpdateUserProfileTool] Failed to save profile:', error);
      return { success: false, reason: 'Database error' };
    }
  }
}

export interface SystemPromptContext {
  botName: string;
  businessName: string;
  businessDetailInfo: string;
  botType: string; // e.g. "sales", "faq", "custom"
  defaultLanguage?: string;
  additionalContext?: Record<string, any>;
}

export interface ISystemPromptStrategy {
  /**
   * Generates the domain-specific system prompt based on the bot/business details.
   */
  generate(context: SystemPromptContext): string;
}

export interface ISystemPromptFactory {
  /**
   * Registers a prompt strategy for a specific bot type.
   */
  registerStrategy(botType: string, strategy: ISystemPromptStrategy): void;

  /**
   * Generates the prompt using the registered strategy for the specified bot type.
   */
  getPrompt(botType: string, context: SystemPromptContext): string;
}

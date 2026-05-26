import { ISystemPromptFactory, ISystemPromptStrategy, SystemPromptContext } from '../../core/interfaces/prompt.interface';

export class SalesPromptStrategy implements ISystemPromptStrategy {
  generate(context: SystemPromptContext): string {
    return `You are a professional, highly engaging Sales Assistant for "${context.businessName}".
Business Profile & Inventory Details:
${context.businessDetailInfo}

Your goals:
1. Help customers discover relevant items/services.
2. Provide pricing and specifications clearly.
3. Help checkout and confirm payments if they indicate readiness.
Maintain a warm, professional, sales-driven attitude.`;
  }
}

export class FaqPromptStrategy implements ISystemPromptStrategy {
  generate(context: SystemPromptContext): string {
    return `You are a precise Customer Support FAQ Bot for "${context.businessName}".
Business Information:
${context.businessDetailInfo}

Your goals:
1. Answer standard business queries (hours, address, policies) accurately based on the context.
2. Avoid speculating. If context doesn't have the answer, politely offer to escalate to human staff.
Be concise, friendly, and structured.`;
  }
}

export class CustomPromptStrategy implements ISystemPromptStrategy {
  generate(context: SystemPromptContext): string {
    return `You are a custom assistant named "${context.botName}" representing "${context.businessName}".
Business Information:
${context.businessDetailInfo}

Answer user questions accurately and politely using the available context and facts.`;
  }
}

export class SystemPromptFactory implements ISystemPromptFactory {
  private strategies: Map<string, ISystemPromptStrategy> = new Map();

  constructor() {
    // Pre-register core strategies
    this.registerStrategy('sales', new SalesPromptStrategy());
    this.registerStrategy('faq', new FaqPromptStrategy());
    this.registerStrategy('custom', new CustomPromptStrategy());
  }

  registerStrategy(botType: string, strategy: ISystemPromptStrategy): void {
    this.strategies.set(botType.toLowerCase(), strategy);
  }

  getPrompt(botType: string, context: SystemPromptContext): string {
    const key = botType.toLowerCase();
    const strategy = this.strategies.get(key) || this.strategies.get('custom');
    if (!strategy) {
      throw new Error(`Prompt strategy not found for type: "${botType}" and fallback 'custom' is missing.`);
    }
    return strategy.generate(context);
  }
}

import { ILLMService, ChatMessage, CompletionOptions, ToolDefinition, ToolCallResult } from '../../core/interfaces/llm.interface';
declare const process: { env: { DEEPSEEK_API_KEY?: string; DEEPSEEK_BASE_URL?: string } };
export class DeepSeekService implements ILLMService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl?: string) {
    this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || 'mock-key';
    this.baseUrl = baseUrl || process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  }

  async generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<string> {
    const systemPromptMessage = options?.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }]
      : [];

    const requestBody = {
      model: 'deepseek-chat',
      messages: [...systemPromptMessage, ...messages],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      response_format: options?.responseFormat || undefined,
    };

    try {
      const response = await this.makeApiRequest('/v1/chat/completions', requestBody);
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('DeepSeek API generation error:', error);
      throw new Error(`DeepSeek completion failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async executeToolCalling(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: CompletionOptions
  ): Promise<ToolCallResult | null> {
    const systemPromptMessage = options?.systemPrompt
      ? [{ role: 'system' as const, content: options.systemPrompt }]
      : [];

    const requestBody = {
      model: 'deepseek-chat',
      messages: [...systemPromptMessage, ...messages],
      temperature: options?.temperature ?? 0.0, // Low temperature for extraction accuracy
      tools: tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }
      })),
      tool_choice: 'auto'
    };

    try {
      const response = await this.makeApiRequest('/v1/chat/completions', requestBody);
      const message = response.choices[0].message;

      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0];
        return {
          toolName: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
        };
      }
      return null;
    } catch (error) {
      console.error('DeepSeek API tool calling error:', error);
      throw new Error(`DeepSeek tool calling failure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async summarizeChatHistory(
    previousSummary: string | null,
    newMessages: { sender: string; text: string }[]
  ): Promise<string> {
    const formattedMessages = newMessages
      .map(m => `${m.sender}: ${m.text}`)
      .join('\n');

    const prompt = `You are an AI assistant. Summarize the following conversation history compactly, capturing key user interests/questions, bot responses, and ongoing contexts:
${previousSummary ? `Previous Summary:\n${previousSummary}\n` : ''}
New Messages:
${formattedMessages}

Provide only the updated concise summary. Do not output anything else.`;

    return this.generateCompletion(
      [{ role: 'user', content: prompt }],
      { temperature: 0.3 }
    );
  }

  private async makeApiRequest(endpoint: string, body: Record<string, any>): Promise<any> {
    if (this.apiKey === 'mock-key') {
      return this.getMockResponse(endpoint, body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error (${response.status}): ${errText}`);
    }

    return response.json();
  }

  private getMockResponse(endpoint: string, body: Record<string, any>): any {
    if (endpoint === '/v1/chat/completions') {
      if (body.tools) {
        // Emulate keyword extraction tool call
        const userMsg = body.messages[body.messages.length - 1].content;
        const keywords = userMsg.split(/\s+/).filter((w: string) => w.length > 2);
        return {
          choices: [{
            message: {
              tool_calls: [{
                function: {
                  name: 'QueryExtractionTool',
                  arguments: JSON.stringify({ exact_keywords: keywords.slice(0, 3) })
                }
              }]
            }
          }]
        };
      }
      return {
        choices: [{
          message: {
            content: `Mocked response. Context contains: ${body.messages[0]?.content?.substring(0, 60) || ''}`
          }
        }]
      };
    }
    throw new Error('Unsupported mocked endpoint');
  }
}

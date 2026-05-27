export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  responseFormat?: { type: 'json_object' } | null;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ToolCallResult<T = any> {
  toolName: string;
  arguments: T;
}

export interface ILLMService {
  /**
   * Generates a chat completion based on the given conversation messages.
   */
  generateCompletion(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): Promise<string>;

  /**
   * Generates a chat completion as a stream of text chunks.
   * Each yielded string is a partial token/content delta from the LLM.
   */
  generateCompletionStream(
    messages: ChatMessage[],
    options?: CompletionOptions
  ): AsyncIterable<string>;

  /**
   * Calls the LLM with tool schemas and returns the structured tool arguments if triggered,
   * or a fallback text response.
   */
  executeToolCalling(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    options?: CompletionOptions
  ): Promise<ToolCallResult | null>;

  /**
   * Summarizes the conversation history combining the previous summary and new messages.
   */
  summarizeChatHistory(
    previousSummary: string | null,
    newMessages: { sender: string; text: string }[]
  ): Promise<string>;
}

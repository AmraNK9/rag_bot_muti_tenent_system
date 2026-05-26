import { ToolDefinition } from './llm.interface';

export interface ITool {
  /**
   * Metadata defining the name, description, and parameter JSON Schema of the tool.
   */
  definition: ToolDefinition;

  /**
   * Executes the tool's backend logic when triggered by the LLM.
   */
  execute(args: any, context?: any): Promise<any>;
}

export interface IToolCallingRegistry {
  /**
   * Registers a tool.
   */
  registerTool(tool: ITool): void;

  /**
   * Gets a tool by its unique name.
   */
  getTool(name: string): ITool | undefined;

  /**
   * Retrieves list of all registered tool definitions for the LLM payload.
   */
  getDefinitions(): ToolDefinition[];
}

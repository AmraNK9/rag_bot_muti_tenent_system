import { ITool, IToolCallingRegistry } from '../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../core/interfaces/llm.interface';

export class ToolCallingRegistry implements IToolCallingRegistry {
  private tools: Map<string, ITool> = new Map();

  registerTool(tool: ITool): void {
    const name = tool.definition.name;
    if (this.tools.has(name)) {
      throw new Error(`Tool "${name}" is already registered in the registry.`);
    }
    this.tools.set(name, tool);
  }

  getTool(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => t.definition);
  }
}

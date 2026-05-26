import { ITool } from '../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../core/interfaces/llm.interface';

export interface QueryExtractionArgs {
  exact_keywords: string[];
}

export class QueryExtractionTool implements ITool {
  definition: ToolDefinition = {
    name: 'QueryExtractionTool',
    description: 'Extracts critical keywords, model names, brand names, product terms, and key entities from the user message in English or Myanmar language.',
    parameters: {
      type: 'object',
      properties: {
        exact_keywords: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'A list of exact keywords extracted from the text (e.g., ["Samsung", "ဖုန်း"]).',
        },
      },
      required: ['exact_keywords'],
    },
  };

  /**
   * Action handler called when the tool is executed.
   */
  async execute(args: QueryExtractionArgs): Promise<QueryExtractionArgs> {
    return {
      exact_keywords: args.exact_keywords || [],
    };
  }
}

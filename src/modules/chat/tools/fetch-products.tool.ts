import { ITool } from '../../../core/interfaces/tool.interface';
import { ToolDefinition } from '../../../core/interfaces/llm.interface';
import { KnowledgeAsset, ChatBot } from '../../../infrastructure/db/models';
import { Op } from 'sequelize';

export interface FetchProductsArgs {
  keyword?: string;
}

export class FetchProductsTool implements ITool {
  definition: ToolDefinition = {
    name: 'FetchProductsTool',
    description: 'Fetches the list of available products from the store inventory. Use this when the user asks "what do you sell", "what phones do you have", or asks for a list of items.',
    parameters: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Optional keyword to filter products (e.g., "phone", "laptop", "iPhone"). Leave empty to fetch all products.',
        },
      },
    },
  };

  async execute(args: FetchProductsArgs, context?: { chatbotId?: number; senderId?: string }): Promise<any> {
    const chatbotId = context?.chatbotId;
    if (!chatbotId) {
      return { status: 'error', message: 'Chatbot ID not provided.' };
    }

    try {
      const whereClause: any = {
        tenant_id: chatbotId,
        item_type: 'product',
      };

      if (args.keyword) {
        whereClause[Op.or] = [
          { title: { [Op.iLike]: `%${args.keyword}%` } },
          { content: { [Op.iLike]: `%${args.keyword}%` } },
        ];
      }

      // Fetch all matching products (limit to 50 to avoid massive prompt injection)
      const products = await KnowledgeAsset.findAll({
        where: whereClause,
        limit: 50,
      });

      if (products.length === 0) {
        return {
          status: 'success',
          message: args.keyword 
            ? `No products found matching "${args.keyword}".` 
            : 'No products are currently listed in the inventory.',
        };
      }

      let productListStr = '--- START OF PRODUCT INVENTORY ---\n';
      products.forEach((p, index) => {
        const priceStr = p.price ? `${p.price} MMK` : 'Price not set';
        const stockStr = p.stock_count !== null ? `Stock: ${p.stock_count}` : 'Stock unknown';
        productListStr += `${index + 1}. **${p.title}** - ${priceStr} (${stockStr})\n`;
        if (p.content && p.content.length > 0 && p.content.length < 100) {
           productListStr += `   Detail: ${p.content}\n`;
        }
      });
      productListStr += '--- END OF PRODUCT INVENTORY ---';

      return {
        status: 'success',
        message: 'Successfully fetched products.',
        data: productListStr,
        rawProducts: products.map(p => ({ title: p.title, price: p.price, stock: p.stock_count, detail: p.content })),
      };

    } catch (error) {
      console.error('[FetchProductsTool Error]', error);
      return { status: 'error', message: 'Failed to fetch products from database.' };
    }
  }
}

import axios from 'axios';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: {
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

class LLMService {
  private apiKey: string;
  private baseURL: string = 'https://api.openai.com/v1';
  private model: string = 'gpt-4-turbo-preview'; // You can change the model as needed

  constructor(apiKey: string) {
    // Fix to use the provided apiKey parameter first, then fall back to env variable
    this.apiKey = apiKey || process.env.REACT_APP_OPENAI_API_KEY || '';
    
    // Add a warning if no API key is available
    if (!this.apiKey) {
      console.warn('No API key provided for LLMService');
    }
  }

  /**
   * Send a message to the ChatGPT API
   * @param messages Array of message objects with role and content
   * @param temperature Controls randomness (0-2, lower is more deterministic)
   * @returns The AI's response text
   */
  async sendMessage(messages: ChatMessage[], temperature: number = 0.7): Promise<string> {
    try {
      const response = await axios.post<ChatCompletionResponse>(
        `${this.baseURL}/chat/completions`,
        {
          model: this.model,
          messages,
          temperature,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('API Error:', error.response?.data || error.message);
        throw new Error(`ChatGPT API Error: ${error.response?.data?.error?.message || error.message}`);
      }
      console.error('Unexpected Error:', error);
      throw error;
    }
  }

  /**
   * Helper method to generate suggestions for Kanban tasks
   * @param context Information about current board/tasks
   * @returns AI-generated task suggestions
   */
  async generateAcceptanceCriteriaSuggestions(context: string): Promise<string> {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant that writes detailed, practical, and testable acceptance criteria for user stories on a Kanban board. Always format your output as a bulleted list using hyphens. Each bullet should define a clear condition of satisfaction that aligns with agile best practices.'
    };
  
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Here is a card from my Kanban board. Based on its context, write 3-5 high-quality acceptance criteria that define when the work on this card can be considered complete. Use simple and unambiguous language:\n\n${context}`
    };
  
    return this.sendMessage([systemMessage, userMessage]);
  }

  async generateTaskSuggestions(context: string): Promise<string> {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a helpful assistant that provides concise task suggestions for Kanban boards. Keep suggestions practical, clear, and relevant to the project context.'
    };
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Based on my current Kanban board context, suggest 3-5 new tasks I might want to add:\n\n${context}`
    };

    return this.sendMessage([systemMessage, userMessage]);
  }

  /**
   * Helper method to analyze a Kanban board
   * @param boardData JSON data representing the board
   * @returns AI analysis of the board state
   */
  async analyzeBoard(boardData: any): Promise<string> {
    const systemMessage: ChatMessage = {
      role: 'system',
      content: 'You are a project management assistant that analyzes Kanban boards to provide insights on project progress, bottlenecks, and suggestions for improvement.'
    };
    
    const userMessage: ChatMessage = {
      role: 'user',
      content: `Analyze this Kanban board data and provide a brief summary of progress, any potential bottlenecks, and 1-2 suggestions:\n\n${
        typeof boardData === 'string' ? boardData : JSON.stringify(boardData)
      }`
    };

    return this.sendMessage([systemMessage, userMessage]);
  }
}

// Export an instance creation function rather than the instance itself
// to allow consumers to provide their own API key
export const createLLMService = (apiKey: string): LLMService => {
  return new LLMService(apiKey);
};

export default LLMService;
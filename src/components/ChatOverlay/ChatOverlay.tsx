import React, { useState, useRef, useEffect } from 'react';
import { createLLMService } from '../../services/LLMService';
import './ChatOverlay.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  boardData: any;
  apiKey: string;
}

const ChatOverlay: React.FC<ChatOverlayProps> = ({ isOpen, onClose, boardData, apiKey }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize LLM service
  const llmService = createLLMService(apiKey);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Add user message to chat
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare context about the board for the LLM
      const boardContext = prepareBoardContext(boardData);
      
      // Send message to LLM with board context
      const systemMessage = {
        role: 'system' as const,
        content: `You are a helpful assistant that analyzes Kanban board data and answers questions about it.
        
        The board data is structured as follows:
        - columns: Array of columns on the board, each with:
          - id: Unique identifier
          - title: Column name (e.g., "To Do", "In Progress", "Done")
          - wipLimit: Work-in-progress limit for the column
          - cards: Array of cards in this column
        
        - cards: Each card has:
          - id: Unique identifier
          - title: Card title
          - description: Detailed description
          - tags: Array of tags/labels
          - dueDate: When the card is due
          - priority: Card priority (high, medium, low)
          - assignedTo: People assigned to the card
          - acceptanceCriteria: Requirements for completion
          - comments: Discussion about the card
          - expedite: Whether this is a high-priority card
        
        - archivedCards: Cards that have been completed and archived
        
        Here is the current board data: ${boardContext}
        
        When answering questions, provide specific examples from the board data to support your analysis.`
      };
      
      const response = await llmService.sendMessage([
        systemMessage,
        ...messages.map(m => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.content })),
        { role: 'user' as const, content: input }
      ]);

      // Add assistant response to chat
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      console.error('Error getting response from LLM:', error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error processing your request. Please check your API key or try again later.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare a more comprehensive context of the board for the LLM
  const prepareBoardContext = (board: any) => {
    if (!board || !board.columns || !board.cards) {
      return 'No board data available.';
    }

    try {
      // Create a detailed representation of the board
      const simplifiedBoard = {
        columns: board.columns.map((column: any) => ({
          id: column.id,
          title: column.title,
          wipLimit: column.wipLimit || 'No limit',
          cards: column.cardIds
            .filter((cardId: string) => board.cards[cardId] && !board.cards[cardId].archived)
            .map((cardId: string) => {
              const card = board.cards[cardId];
              return {
                id: card.id,
                title: card.title,
                description: card.description || '',
                tags: card.tags || [],
                dueDate: card.dueDate || null,
                priority: card.priority || 'medium',
                assignedTo: card.assignedTo || [],
                acceptanceCriteria: card.acceptanceCriteria || '',
                comments: (card.comments || []).map((comment: any) => ({
                  text: comment.text,
                  author: comment.author,
                  timestamp: comment.timestamp
                })),
                createdAt: card.createdAt || null,
                updatedAt: card.updatedAt || null,
                expedite: card.expedite || false
              };
            })
        })),
        archivedCards: Object.values(board.cards)
          .filter((card: any) => card.archived)
          .map((card: any) => ({
            id: card.id,
            title: card.title,
            description: card.description || '',
            tags: card.tags || [],
            previousColumn: card.previousColumn || 'Unknown'
          }))
      };

      return JSON.stringify(simplifiedBoard, null, 2);
    } catch (error) {
      console.error('Error preparing board context:', error);
      return 'Error preparing board data.';
    }
  };

  // Handle textarea resize and Enter key submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="chat-overlay">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <p>Ask me anything about your Kanban board!</p>
            <p className="examples">Examples:</p>
            <ul>
              <li>"What cards are due this week?"</li>
              <li>"How many high priority tasks are in the 'In Progress' column?"</li>
              <li>"What bottlenecks do you see in my workflow?"</li>
              <li>"Summarize the distribution of tasks across columns"</li>
              <li>"Which cards have been assigned to team members?"</li>
            </ul>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="message assistant">
            <div className="message-content loading">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={handleSubmit} className="chat-input-form">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your board..."
          rows={1}
          className="chat-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? 
            <span className="spinner"></span> : 
            <span className="send-icon">➤</span>
          }
        </button>
      </form>
    </div>
  );
};

export default ChatOverlay; 
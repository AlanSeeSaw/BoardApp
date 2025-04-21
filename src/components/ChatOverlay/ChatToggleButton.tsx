import React from 'react';
import './ChatToggleButton.css';

interface ChatToggleButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

const ChatToggleButton: React.FC<ChatToggleButtonProps> = ({ onClick, isOpen }) => {
  return (
    <button 
      className={`chat-toggle-button ${isOpen ? 'active' : ''}`} 
      onClick={onClick}
      aria-label="Toggle AI Assistant"
    >
      <span className="chat-icon">💬</span>
      <span className="chat-label">AI Assistant</span>
    </button>
  );
};

export default ChatToggleButton; 
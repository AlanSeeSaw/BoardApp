import React from 'react';
import { Card as CardType } from '../types';
import ReactMarkdown from 'react-markdown';

interface ArchivedCardsProps {
  archivedCards: CardType[];
  onRestore: (cardId: string) => void;
}

const ArchivedCards: React.FC<ArchivedCardsProps> = ({ archivedCards, onRestore }) => {
  if (archivedCards.length === 0) {
    return <div className="archived-empty">No archived cards</div>;
  }

  return (
    <div className="archived-container">
      <h2>Archived Cards</h2>
      <div className="archived-cards">
        {archivedCards.map(card => (
          <div key={card.id} className="archived-card">
            <div className="archived-card-header">
              <h3>{card.title}</h3>
              <button 
                onClick={() => onRestore(card.id)} 
                className="restore-button"
              >
                Restore
              </button>
            </div>
            <div className="archived-card-content">
              <ReactMarkdown>{card.description}</ReactMarkdown>
              
              {card.labels && card.labels.length > 0 && (
                <div className="card-labels">
                  {card.labels.map(label => (
                    <span 
                      key={label.id} 
                      className="card-label" 
                      style={{ backgroundColor: label.color }}
                    >
                      {label.name}
                    </span>
                  ))}
                </div>
              )}
              
              {card.dueDate && (
                <div className="card-due-date">
                  Due: {new Date(card.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArchivedCards; 
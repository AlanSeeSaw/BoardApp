import React, { useCallback, useMemo, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card as CardType, Board } from '../../types';
import Card from '../Cards/Card';
import './ExpeditePane.css'; // Add a separate CSS file for the pane

interface ExpediteProps {
  columnId: string; // Add columnId prop
  cards: CardType[];
  board: Board;
  toggleCardSelection: (cardId: string, isSelected: boolean) => void;
  selectedCards: string[];
  activeDragId?: string | null;
  columnTitle: string; // Add column title for display
}

// Define the component without memo first, then wrap it
const ExpeditePane: React.FC<ExpediteProps> = ({ 
  columnId,
  cards, 
  board, 
  toggleCardSelection,
  selectedCards,
  activeDragId,
  columnTitle
}) => {
  // Update droppable ID to be column-specific
  const { isOver, setNodeRef } = useDroppable({
    id: `expedite:${columnId}`,
    data: {
      columnId,
      isExpediteZone: true
    }
  });

  // Better debugging - verify cards have emergency priority
  useEffect(() => {
    const emergencyCount = cards.filter(c => c.priority === 'emergency').length;
    // Log warning if non-emergency cards are present
    if (emergencyCount !== cards.length) {
      console.warn(`Column ${columnTitle} has ${cards.length - emergencyCount} non-emergency cards in expedite pane`);
      cards.forEach(c => {
        if (c.priority !== 'emergency') {
          console.warn(`Non-emergency card in expedite pane: ${c.id}, ${c.title}, priority: ${c.priority}`);
        }
      });
    }
  }, [cards, columnTitle]);

  // Explicitly only render cards with emergency priority for safety
  const filteredCards = useMemo(() => {
    // Filter for only emergency cards to ensure consistency
    return cards.filter(card => card.priority === 'emergency');
  }, [cards]);

  // Memoize this function to prevent it from changing on each render
  const isSelected = useCallback((cardId: string) => {
    return selectedCards.includes(cardId);
  }, [selectedCards]);

  // IMPORTANT: Remove this condition so empty expedite panes still render
  // if (cards.length === 0) {
  //   return null;
  // }

  return (
    <div 
      ref={setNodeRef}
      className={`column-expedite-lane ${isOver ? 'dropping-zone' : ''}`}
    >
      <div className="expedite-header">
        <h3>🚨 EXPEDITE</h3>
        <div className="expedite-info">
          <span className="expedite-count">{cards.length} card(s)</span>
        </div>
      </div>
      
      <div className="expedite-cards">
        {cards.map((card, index) => (
          <Card 
            key={card.id}
            card={card}
            index={index}
            columnId={columnId}
            board={board}
            isSelected={isSelected(card.id)}
            toggleSelection={toggleCardSelection}
            isExpedited={true}
            activeDragId={activeDragId}
          />
        ))}
      </div>
    </div>
  );
};

// Replace the complex comparison function with a simpler one
const MemoizedExpeditePane = React.memo(ExpeditePane, (prevProps, nextProps) => {
  // Only re-render if cards array or selectedCards has changed
  const cardsEqual = 
    prevProps.cards === nextProps.cards || 
    (prevProps.cards.length === 0 && nextProps.cards.length === 0);
    
  const selectionEqual = 
    prevProps.selectedCards === nextProps.selectedCards ||
    !prevProps.cards.some(card => 
      prevProps.selectedCards.includes(card.id) !== nextProps.selectedCards.includes(card.id)
    );
    
  return cardsEqual && selectionEqual;
});

// Export the memoized version
export default MemoizedExpeditePane;
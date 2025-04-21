import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { getAuth } from 'firebase/auth';
import { BoardType, CardType } from '../types';
import { recordCardMovement } from '../utils/CardMovement';

export const useDragAndDrop = (
  board: BoardType,
  setBoard: React.Dispatch<React.SetStateAction<BoardType>>,
  saveBoard: () => void,
  saveCardMovementHistory: (cardId: string, movements: any[] | undefined) => Promise<void>,
  logActivity: (cardId: string, action: string) => void
) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardType | null>(null);

  const findCardById = (cardId: string): CardType | undefined => {
    // First check in cards map directly
    if (board.cards && board.cards[cardId]) {
      return board.cards[cardId];
    }
    return undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id.toString();
    
    if (activeId.startsWith('card:')) {
      const cardId = activeId.replace('card:', '');
      
      // Find the card data
      const cardData = findCardById(cardId);
      if (cardData) {
        setActiveDragId(cardId);
        setActiveCard(cardData);
        
        // Add a class to body to indicate active dragging
        document.body.classList.add('dragging-active');
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    // Reset state
    setActiveDragId(null);
    setActiveCard(null);
    document.body.classList.remove('dragging-active');
    
    // Cleanup any ghost elements
    document.querySelectorAll('.dragging-ghost').forEach(el => {
      el.remove();
    });
    
    if (!event.active || !event.over) return;
    
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = String(over.id);
    
    // Handle card dropped on a column
    if (activeId.startsWith('card:') && overId.startsWith('column:')) {
      const cardId = activeId.replace('card:', '');
      const targetColumnId = overId.replace('column:', '');
      
      // Find source column
      let sourceColumnId = '';
      for (const column of board.columns) {
        if (column.cardIds.includes(cardId)) {
          sourceColumnId = column.id;
          break;
        }
      }
      
      // Only process moves between different columns
      if (sourceColumnId && sourceColumnId !== targetColumnId) {
        console.log(`Moving card ${cardId} from ${sourceColumnId} to ${targetColumnId}`);
        
        // Get the current card data
        const currentCard = board.cards[cardId];
         
        // Add more robust error handling when processing card moves
        if (!currentCard) {
          console.error(`Cannot move card ${cardId}: Card not found in board data`);
          return;
        }

        if (!currentCard.movementHistory || !Array.isArray(currentCard.movementHistory)) {
          console.warn(`Card ${cardId} has no movement history array, creating one`);
          currentCard.movementHistory = [];
        }
        
        // Get current user before using it
        const now = new Date();
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        // Create movement record
        const updatedBoard = recordCardMovement(
          board,
          cardId,
          sourceColumnId, 
          targetColumnId, 
          currentUser?.email || 'unknown'
        );
        
        // Update board state
        setBoard(updatedBoard);
        
        // Log activity
        logActivity(cardId, `Moved from ${sourceColumnId} to ${targetColumnId}`);

        // After the board is updated and movement is recorded
        if (updatedBoard.cards[cardId].movementHistory) {
          console.log("FORCE SAVING TO FIREBASE WITH MOVEMENT HISTORY");
          
          // Use only ONE save approach - the main saveBoard function
          if (saveBoard) {
            console.log("Saving board with regular save function");
            saveBoard();
          }
          
          // We can keep the failsafe but with a slight delay to avoid conflict
          setTimeout(async () => {
            console.log("Saving movement history with direct function as backup (delayed)");
            await saveCardMovementHistory(cardId, updatedBoard.cards[cardId].movementHistory);
          }, 500);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragId(null);
    setActiveCard(null);
    document.body.classList.remove('dragging-active');
  };

  return {
    activeDragId,
    activeCard,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    findCardById
  };
}; 
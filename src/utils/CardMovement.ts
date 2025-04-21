import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { BoardType, CardType, Priority, Card, CardMovement, CardTimeInColumn, Board } from '../types';
import { getAuth } from 'firebase/auth';
import { User } from 'firebase/auth';

interface CardMovementProps {
  board: BoardType;
  setBoard: React.Dispatch<React.SetStateAction<BoardType>>;
  setActiveDragId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveCard: React.Dispatch<React.SetStateAction<CardType | null>>;
  findCardById: (cardId: string) => CardType | undefined;
  logActivity: (cardId: string, action: string) => void;
  updateBoardInFirebase: (board: Board) => void;
}

export const useCardMovement = ({
  board,
  setBoard,
  setActiveDragId,
  setActiveCard,
  findCardById,
  logActivity,
  updateBoardInFirebase
}: CardMovementProps) => {
  
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

  const handleDragEnd = (event: DragEndEvent) => {
    // Reset state
    setActiveDragId(null);
    setActiveCard(null);
    document.body.classList.remove('dragging-active');
    
    if (!event.active || !event.over) return;
    
    const { active, over } = event;
    const activeId = String(active.id);
    const overId = String(over.id);
    
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
      
      // Only track if columns are different
      if (sourceColumnId && sourceColumnId !== targetColumnId) {
        // Use recordCardMovement to handle both tracking and column updates
        const updatedBoard = recordCardMovement(board, cardId, sourceColumnId, targetColumnId) as BoardType;
        
        // Update board state and save to Firebase
        if (updateBoardInFirebase) {
          updateBoardInFirebase(updatedBoard);
        } else {
          setBoard(updatedBoard);
        }
        
        // Log activity
        logActivity(cardId, `Moved from ${sourceColumnId} to ${targetColumnId}`);
      }
    }
  };

  const handleDragCancel = () => {
    // Important: Reset state when drag is cancelled
    setActiveDragId(null);
    setActiveCard(null);
    
    // Remove dragging class
    document.body.classList.remove('dragging-active');
  };

  return {
    handleDragStart,
    handleDragEnd,
    handleDragCancel
  };
};

/**
 * Records a card movement from one column to another
 * @param card The card to move
 * @param fromColumnId Source column ID
 * @param toColumnId Target column ID
 * @param movedBy User who moved the card (email or ID)
 */
export const recordCardMovement = (
  board: BoardType,
  cardId: string,
  fromColumnId: string, 
  toColumnId: string,
  currentUser?: User | string
): BoardType => {
  console.log("=== CARD MOVEMENT TRACKING DEBUG ===");
  console.log(`Recording movement for card ${cardId}`);
  
  // Get the card data
  const card = board.cards[cardId];
  
  if (!card) {
    console.error(`Card ${cardId} not found in board data`);
    return board;
  }
  
  console.log(`Before update, card has ${card.movementHistory?.length || 0} movements`);
  
  // Only record movement if columns are actually different
  if (fromColumnId !== toColumnId) {
    // Create movement record
    const now = new Date();
    const movement: CardMovement = {
      cardId,
      fromColumnId,
      toColumnId,
      movedAt: now,
      movedBy: typeof currentUser === 'string' ? currentUser : (currentUser?.email || 'unknown')
    };
    
    // IMPORTANT: Create a new array to preserve existing history
    // Make a deep copy of existing history to prevent reference issues
    let movementHistory = [];
    if (Array.isArray(card.movementHistory)) {
      // Use deep copy to avoid reference issues
      movementHistory = JSON.parse(JSON.stringify(card.movementHistory));
    }
    
    // Add the new movement
    movementHistory.push(movement);
    
    // Create updated card
    const updatedCard: CardType = {
      ...card,
      currentColumnId: toColumnId,
      movementHistory: movementHistory,
      timeInColumns: updateTimeTracking(card, fromColumnId, toColumnId, now)
    };
    
    console.log(`After update, card has ${updatedCard.movementHistory?.length || 0} movements`);
    
    // Update columns by moving the card ID between them
    const updatedColumns = board.columns.map(column => {
      if (column.id === fromColumnId) {
        // Remove card from source column
        return {
          ...column,
          cardIds: column.cardIds.filter(id => id !== cardId)
        };
      }
      if (column.id === toColumnId) {
        // Add card to target column if it's not already there
        if (!column.cardIds.includes(cardId)) {
          return {
            ...column,
            cardIds: [...column.cardIds, cardId]
          };
        }
      }
      return column;
    });
    
    // Update the board with the updated card and columns
    const updatedBoard = {
      ...board,
      columns: updatedColumns,
      cards: {
        ...board.cards,
        [cardId]: updatedCard
      },
      lastMoveTimestamp: Date.now()
    };
    
    return updatedBoard;
  }
  
  return board;
};

/**
 * Updates the time tracking for a card when it moves between columns
 */
export const updateTimeTracking = (
  card: Card,
  fromColumnId: string,
  toColumnId: string,
  timestamp: Date | number = new Date()
): CardTimeInColumn[] => {
  // Convert timestamp to Date if it's a number
  const moveTime = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  // Initialize or get existing timeInColumns
  let timeInColumns = card.timeInColumns || [];
  
  // Fix any invalid entries first (where enteredAt is an empty object)
  timeInColumns = timeInColumns.map(record => {
    // If enteredAt is an empty object or invalid
    if (!record.enteredAt || typeof record.enteredAt === 'object' && 
        !(record.enteredAt instanceof Date) && Object.keys(record.enteredAt).length === 0) {
      // Set it to the card creation time or current time as fallback
      return {
        ...record,
        enteredAt: card.created instanceof Date ? card.created : 
                  (typeof card.created === 'number' || typeof card.created === 'string') ? 
                  new Date(card.created) : new Date()
      };
    }
    return record;
  });
  
  // Find the latest record for the source column
  const sourceIndex = timeInColumns.findIndex(
    record => record.columnId === fromColumnId && !record.exitedAt
  );
  
  // If we found an open record for the source column, close it
  let updatedTimeInColumns = [...timeInColumns];
  
  if (sourceIndex >= 0) {
    const sourceRecord = timeInColumns[sourceIndex];
    let enteredAt;
    
    // Ensure enteredAt is a proper Date
    if (sourceRecord.enteredAt instanceof Date) {
      enteredAt = sourceRecord.enteredAt;
    } else if (typeof sourceRecord.enteredAt === 'string' || typeof sourceRecord.enteredAt === 'number') {
      enteredAt = new Date(sourceRecord.enteredAt);
    } else {
      // Fallback if enteredAt is still invalid
      enteredAt = new Date(card.created || Date.now());
    }
    
    // Calculate duration
    const durationMs = moveTime.getTime() - enteredAt.getTime();
    
    // Update the record
    updatedTimeInColumns[sourceIndex] = {
      ...sourceRecord,
      exitedAt: moveTime,
      durationMs
    };
  }
  
  // Add a new record for the destination column
  const newRecord: CardTimeInColumn = {
    columnId: toColumnId,
    enteredAt: moveTime
  };
  
  return [...updatedTimeInColumns, newRecord];
};

/**
 * Calculates the total time spent in all columns
 */
export const calculateTotalTimeInColumns = (card: Card): number => {
  if (!card.timeInColumns || card.timeInColumns.length === 0) return 0;
  
  const now = new Date().getTime();
  
  return card.timeInColumns.reduce((total, record) => {
    // If we have a pre-calculated duration, use it
    if (typeof record.durationMs === 'number') {
      return total + record.durationMs;
    }
    
    // Calculate duration based on entry and exit times
    const enteredAt = record.enteredAt instanceof Date ? 
      record.enteredAt.getTime() : 
      typeof record.enteredAt === 'number' ? record.enteredAt : new Date(record.enteredAt).getTime();
    
    const exitedAt = record.exitedAt ? 
      (record.exitedAt instanceof Date ? record.exitedAt.getTime() : 
      typeof record.exitedAt === 'number' ? record.exitedAt : new Date(record.exitedAt).getTime()) : 
      now;
    
    return total + (exitedAt - enteredAt);
  }, 0);
};

/**
 * Formats the time duration (in milliseconds) as a human-readable string
 */
export const formatTimeDuration = (durationMs: number): string => {
  const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

/**
 * Initializes tracking data for cards that don't have it
 */
export const initializeCardTracking = (board: Board): Board => {
  const updatedCards = { ...board.cards };
  let hasUpdates = false;
  
  // Process each card
  Object.keys(board.cards).forEach(cardId => {
    const card = board.cards[cardId];
    let cardUpdated = false;
    let updatedCard = { ...card };
    
    // Find current column if not set
    if (!card.currentColumnId) {
      for (const column of board.columns) {
        if (column.cardIds.includes(cardId)) {
          updatedCard.currentColumnId = column.id;
          cardUpdated = true;
          break;
        }
      }
    }
    
    // Initialize timeInColumns if it doesn't exist
    if (!card.timeInColumns || card.timeInColumns.length === 0) {
      const currentColumnId = updatedCard.currentColumnId;
      if (currentColumnId) {
        // Ensure enteredAt is a proper Date object
        updatedCard.timeInColumns = [{
          columnId: currentColumnId,
          enteredAt: card.created instanceof Date ? card.created : new Date(card.created || Date.now())
        }];
        cardUpdated = true;
      }
    }
    
    // Initialize movementHistory if not set
    if (!card.movementHistory) {
      updatedCard.movementHistory = [];
      cardUpdated = true;
    }
    
    // Update the card if changes were made
    if (cardUpdated) {
      updatedCards[cardId] = updatedCard;
      hasUpdates = true;
    }
  });
  
  return hasUpdates ? { ...board, cards: updatedCards } : board;
};

// Add this utility function
export function isValidMovementRecord(movement: any): boolean {
  return movement 
    && typeof movement.cardId === 'string'
    && typeof movement.fromColumnId === 'string' 
    && typeof movement.toColumnId === 'string'
    && (movement.movedAt instanceof Date || typeof movement.movedAt === 'string')
    && typeof movement.movedBy === 'string';
}

/**
 * Fixes invalid timeInColumns entries in all cards
 * @param board The board to fix
 * @returns Updated board with fixed timeInColumns
 */
export const fixInvalidTimeTracking = (board: BoardType): BoardType => {
  let hasUpdates = false;
  const updatedCards = { ...board.cards };
  
  // Process each card
  Object.keys(board.cards).forEach(cardId => {
    const card = board.cards[cardId];
    if (!card) return;
    
    // Skip cards with no timeInColumns
    if (!card.timeInColumns || !Array.isArray(card.timeInColumns) || card.timeInColumns.length === 0) {
      // Initialize if missing
      updatedCards[cardId] = {
        ...card,
        timeInColumns: [{
          columnId: card.currentColumnId || '',
          enteredAt: card.created instanceof Date ? card.created : new Date(card.created || Date.now())
        }]
      };
      hasUpdates = true;
      return;
    }
    
    // Check for invalid entries
    let needsUpdate = false;
    const fixedTimeInColumns = card.timeInColumns.map(entry => {
      // Check if enteredAt is an empty object or invalid
      if (!entry.enteredAt || (
          typeof entry.enteredAt === 'object' && 
          !(entry.enteredAt instanceof Date) && 
          Object.keys(entry.enteredAt).length === 0
        )) {
        needsUpdate = true;
        return {
          ...entry,
          enteredAt: card.created instanceof Date ? card.created : 
                    (typeof card.created === 'string' || typeof card.created === 'number') ? 
                    new Date(card.created) : new Date()
        };
      }
      return entry;
    });
    
    if (needsUpdate) {
      updatedCards[cardId] = {
        ...card,
        timeInColumns: fixedTimeInColumns
      };
      hasUpdates = true;
    }
  });
  
  return hasUpdates ? { ...board, cards: updatedCards } : board;
};

/**
 * Calculates time since the card was last moved between columns
 * @param card The card to check
 * @returns Time in milliseconds since last movement, or null if no movement history exists
 */
export const calculateTimeSinceLastMove = (card: Card): number => {
  if (!card.movementHistory || card.movementHistory.length === 0) {
    return calculateTotalTimeInColumns(card);
  }
  
  // Find the most recent movement
  const lastMove = card.movementHistory.reduce((latest, current) => {
    const currentMoveTime = current.movedAt instanceof Date ? 
      current.movedAt.getTime() : 
      new Date(current.movedAt).getTime();
    
    const latestMoveTime = latest.movedAt instanceof Date ? 
      latest.movedAt.getTime() : 
      new Date(latest.movedAt).getTime();
    
    return currentMoveTime > latestMoveTime ? current : latest;
  }, card.movementHistory[0]);
  
  // Calculate time difference between now and the last move
  const lastMoveTime = lastMove.movedAt instanceof Date ? 
    lastMove.movedAt.getTime() : 
    new Date(lastMove.movedAt).getTime();
  
  const now = new Date().getTime();
  return now - lastMoveTime;
};

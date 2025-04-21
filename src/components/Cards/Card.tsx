import React, { useEffect, useState, useReducer } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType, Board, Priority } from '../../types';
import { useModal } from '../../context/ModalContext';
import './Card.css';
import { getAuth } from 'firebase/auth';
import { formatTimeDuration, calculateTotalTimeInColumns, calculateTimeSinceLastMove } from '../../utils/CardMovement';

// Updated props interface for normalized data structure
export interface CardProps {
  card: CardType;
  index?: number;
  columnId?: string;
  board?: Board;
  setBoard?: React.Dispatch<React.SetStateAction<Board>>;
  isSelected: boolean;
  toggleSelection: (cardId: string, isSelected: boolean) => void;
  logActivity?: (cardId: string, action: string) => void;
  isExpedited?: boolean;
  isDragging?: boolean;
  activeDragId?: string | null;
  // New props for tracking
  updateCardMovement?: (cardId: string, fromColumnId: string, toColumnId: string) => void;
  updateTimeInColumn?: (cardId: string, columnId: string, exitTime?: Date) => void;
}

const Card: React.FC<CardProps> = ({ 
  card, 
  index, 
  columnId, 
  board, 
  setBoard,
  isSelected,
  toggleSelection,
  logActivity,
  isDragging = false,
  activeDragId = null,
  // New tracking props
  updateCardMovement,
  updateTimeInColumn
}) => {
  const { openCardModal } = useModal();
  const isBeingDragged = card.id === activeDragId;
  const [forceUpdateKey, setForceUpdateKey] = useState(Date.now());
  const [forceRender, setForceRender] = useState(Date.now());
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // Effect to track when a card enters a column
  useEffect(() => {
    // Only track if we have the necessary props and columnId
    if (columnId && card && card.currentColumnId !== columnId) {
      // If the card has moved to a new column
      if (updateCardMovement && card.currentColumnId) {
        // Log the movement
        updateCardMovement(card.id, card.currentColumnId, columnId);
      }
      
      // Update the card's current column in the board state
      if (setBoard) {
        setBoard(prevBoard => ({
          ...prevBoard,
          cards: {
            ...prevBoard.cards,
            [card.id]: {
              ...prevBoard.cards[card.id],
              currentColumnId: columnId
            }
          },
          clientTimestamp: Date.now()
        }));
      }
    }
  }, [card, columnId, setBoard, updateCardMovement]);

  // Combined draggable setup
  const { attributes, listeners, setNodeRef, transform, isDragging: isCurrentCardDragging } = useDraggable({
    id: `card:${card.id}`,
    data: { card, index, columnId },
    disabled: isDragging
  });

  // Simplified style application with correct TypeScript types
  const style = isCurrentCardDragging ? {
    opacity: 0,
    visibility: 'hidden' as const,
    pointerEvents: 'none' as const
  } : {
    transform: transform ? CSS.Translate.toString(transform) : undefined
  };

  // Simplified utility functions
  const isPastDue = card.dueDate 
    ? new Date(card.dueDate).getTime() < (new Date().getTime() - 60000) // 1 minute buffer
    : false;
  const checklistProgress = card.checklist?.length 
    ? (card.checklist.filter(item => item.completed).length / card.checklist.length) * 100 
    : 0;

  // Fix the date formatting to account for timezone offset
  const formatDate = (date: Date | string | number | null | undefined): string => {
    if (!date) return '';
    
    // Create a new Date object to ensure consistent handling
    const dateObj = new Date(date);
    
    // Extract the date part from ISO string (YYYY-MM-DD)
    // This is what the date input would show and what we want to display
    const datePart = dateObj.toISOString().split('T')[0];
    const [year, month, day] = datePart.split('-').map(num => parseInt(num, 10));
    
    // Format using the extracted date parts
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    
    // Create a date object using the extracted parts
    // Month is 0-indexed in JavaScript Date
    const displayDate = new Date(year, month - 1, day);
    
    return displayDate.toLocaleDateString(undefined, options);
  };

  // Get user initials for display
  const getUserInitials = (userId: string) => {
    // If userId is an email, extract initials directly without needing board data
    if (userId && userId.includes('@') && userId.includes('.')) {
      return getInitialsFromName(userId);
    }
    
    if (!board) {
      // Fallback when board is not available (like during drag operations)
      return userId && userId.length > 0 ? userId.substring(0, 2).toUpperCase() : "?";
    }
    
    // Check if it's the owner/current user
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser && (userId === currentUser.uid || userId === currentUser.email)) {
      const displayName = currentUser.displayName || currentUser.email || '';
      return getInitialsFromName(displayName);
    }
    
    // Check if it's in shared emails
    if (board.shared && board.shared.includes(userId)) {
      return getInitialsFromName(userId);
    }
    
    // Check if we have a users collection in the board
    if (board.users && Array.isArray(board.users)) {
      const foundUser = board.users.find(u => u.id === userId || u.email === userId || u.uid === userId);
      if (foundUser) {
        const userName = foundUser.name || foundUser.displayName || foundUser.email || '';
        return getInitialsFromName(userName);
      }
    }
    
    // Last resort fallback - use first two characters of userId if available
    return userId && userId.length > 0 ? userId.substring(0, 2).toUpperCase() : "?";
  };

  // Helper function to get initials from name
  const getInitialsFromName = (name: string): string => {
    if (!name) return "?";
    
    // For email addresses, use first two characters of the username part
    if (name.includes('@')) {
      const username = name.split('@')[0];
      return username.substring(0, 2).toUpperCase();
    }
    
    // For regular names, use first letter of first and last name
    const nameParts = name.split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    
    // Otherwise use first two letters
    return name.substring(0, 2).toUpperCase();
  };

  // Get user name for tooltip
  const getUserName = (userId: string): string => {
    if (!board) return "Unknown User";
    
    // Check if it's the owner
    const auth = getAuth();
    const currentUser = auth.currentUser;
    if (currentUser && (userId === currentUser.uid || userId === currentUser.email)) {
      return currentUser.displayName || currentUser.email || "Current User";
    }
    
    // Check if it's in shared emails
    if (board.shared && board.shared.includes(userId)) {
      return userId; // Return the email
    }
    
    // NEW: Check if it's a direct email format - if so, just display it
    if (userId.includes('@') && userId.includes('.')) {
      return userId;
    }
    
    // NEW: Check if we have a users collection in the board
    if (board.users && Array.isArray(board.users)) {
      const foundUser = board.users.find(u => u.id === userId || u.email === userId || u.uid === userId);
      if (foundUser) {
        return foundUser.name || foundUser.displayName || foundUser.email || userId;
      }
    }
    
    return "Unknown User";
  };

  // Simplified handlers for normalized data structure
  const handleCardClick = (e: React.MouseEvent) => {
    console.log("Card clicked:", card.id);
    
    if (isDragging || isBeingDragged) {
      console.log("Card is being dragged, ignoring click");
      return;
    }
    
    const isInteractive = (e.target as HTMLElement).closest('button, a, input, .card-action-buttons');
    if (isInteractive) {
      console.log("Clicked on interactive element, ignoring");
      return;
    }
    
    if (!board) {
      console.log("No board provided to card component");
      return;
    }
    
    if (!columnId) {
      console.log("No columnId provided to card component");
      return;
    }
    
    console.log("Opening card modal for", card.id, "in column", columnId);
    e.stopPropagation();
    openCardModal(card, columnId, board);
  };


  // Update card classes to better handle dragging state
  const cardClasses = [
    'card',
    card.priority === 'emergency' && 'expedited',
    isSelected && 'selected',
    isBeingDragged && 'being-dragged',
    isDragging && 'dragging',
    `card-${card.priority}`,
    `card-type-${card.type}`
  ].filter(Boolean).join(' ');

  // Add an effect to update the card when changes occur
  useEffect(() => {
    // Function to handle direct card updates (more immediate than board updates)
    const handleDirectCardUpdate = (event: CustomEvent) => {
      const details = event.detail;
      
      // If this is our card that was updated
      if (details && details.cardId === card.id) {
        console.log(`Card ${card.id} received direct update event`);
        
        // If we have an updated card object in the event
        if (details.updatedCard) {
          // We can directly update our component state if necessary
          // or force a rerender through the board
          if (board && setBoard) {
            console.log('Forcing immediate card update via board state');
            setBoard(prevBoard => ({
              ...prevBoard,
              cards: {
                ...prevBoard.cards,
                [card.id]: {
                  ...details.updatedCard,
                  // Ensure we have the latest data
                  updated: new Date()
                }
              },
              forceRerenderKey: Date.now() // Add a changing key to force rerenders
            }));
          }
        }
      }
    };
    
    // Regular board update handler 
    const handleBoardUpdate = (event: CustomEvent) => {
      const details = event.detail;
      
      // If this is our card that was updated
      if (details && details.cardId === card.id && board && setBoard) {
        console.log(`Card ${card.id} received board update event`);
        // Force a re-render by updating a timestamp
        setBoard(prevBoard => ({
          ...prevBoard,
          lastRenderTimestamp: Date.now()
        }));
      }
    };
    
    // Force rerender handler
    const handleForceRerender = () => {
      if (board && setBoard) {
        // Check if our card needs updating from the board
        const boardCard = board.cards[card.id];
        if (boardCard && 
           (boardCard.title !== card.title || 
            boardCard.description !== card.description ||
            boardCard.priority !== card.priority)) {
          console.log(`Card ${card.id} forcing rerender from latest board data`);
          setBoard(prev => ({...prev, _forceUpdate: Date.now()}));
        }
      }
    };
    
    // Listen for all our custom events
    window.addEventListener('card-directly-updated', handleDirectCardUpdate as EventListener);
    window.addEventListener('board-updated', handleBoardUpdate as EventListener);
    window.addEventListener('force-board-rerender', handleForceRerender);
    
    return () => {
      window.removeEventListener('card-directly-updated', handleDirectCardUpdate as EventListener);
      window.removeEventListener('board-updated', handleBoardUpdate as EventListener);
      window.removeEventListener('force-board-rerender', handleForceRerender);
    };
  }, [card.id, card.title, card.description, card.priority, board, setBoard]);

  // Add this effect to listen for a special global event
  useEffect(() => {
    const handleGlobalCardUpdate = (e: CustomEvent) => {
      if (e.detail && e.detail.cardId === card.id) {
        console.log(`Card ${card.id} received global update command`);
        // This will force this specific card to re-render
        setForceUpdateKey(Date.now());
      }
    };
    
    window.addEventListener('force-card-update', handleGlobalCardUpdate as EventListener);
    return () => {
      window.removeEventListener('force-card-update', handleGlobalCardUpdate as EventListener);
    };
  }, [card.id]);

  // Add a more robust event listener to update the card when it changes
  useEffect(() => {
    const handleCardUpdate = (event: CustomEvent) => {
      const { cardId, updatedCard } = event.detail;
      if (cardId === card.id) {
        console.log(`Card ${card.id} received update event with new data:`, updatedCard);
        
        // Force a re-render with the updated card data
        setForceRender(Date.now());
        
        // Also update the board state if available
        if (board && setBoard) {
          setBoard(prevBoard => ({
            ...prevBoard,
            cards: {
              ...prevBoard.cards,
              [card.id]: updatedCard
            },
            // Force a re-render
            clientTimestamp: Date.now()
          }));
        }
      }
    };

    window.addEventListener('card-updated', handleCardUpdate as EventListener);
    
    return () => {
      window.removeEventListener('card-updated', handleCardUpdate as EventListener);
    };
  }, [card.id, board, setBoard]);

  // Add this effect to ensure the card data is always up-to-date with the board
  useEffect(() => {
    if (board && card.id) {
      const latestCardData = board.cards[card.id];
      
      // If the board has newer data for this card, force a re-render
      if (latestCardData && 
          (latestCardData.title !== card.title || 
           latestCardData.description !== card.description ||
           latestCardData.priority !== card.priority ||
           latestCardData.type !== card.type)) {
        
        console.log(`Card ${card.id} detected newer data in board, updating local state`);
        
        // Force a re-render with the latest data
        setForceRender(Date.now());
      }
    }
  }, [board, card.id, card.title, card.description, card.priority, card.type]);

  // Make sure the Card component is properly subscribed to updates
  useEffect(() => {
    // This function will be called when the card-directly-updated event is fired
    const handleCardUpdate = (event: CustomEvent) => {
      if (event.detail.cardId === card.id) {
        console.log(`Card ${card.id} received update event, forcing re-render`);
        // Force a re-render of this specific card
        forceUpdate();
      }
    };

    // Add event listener
    window.addEventListener('card-directly-updated', handleCardUpdate as EventListener);

    // Clean up
    return () => {
      window.removeEventListener('card-directly-updated', handleCardUpdate as EventListener);
    };
  }, [card.id]);

  // Add this effect to listen for the 'card-updated' event
  useEffect(() => {
    const handleCardUpdated = (event: CustomEvent) => {
      if (event.detail.cardId === card.id) {
        console.log(`Card ${card.id} received card-updated event with new data:`, event.detail.updatedCard);
        
        // Force a re-render with the latest data
        setForceUpdateKey(Date.now());
        forceUpdate();
      }
    };
    
    window.addEventListener('card-updated', handleCardUpdated as EventListener);
    
    return () => {
      window.removeEventListener('card-updated', handleCardUpdated as EventListener);
    };
  }, [card.id]);

  return (
    <div 
      key={`card-${card.id}-${typeof card.updated === 'object' ? card.updated.getTime() : Date.now()}`}
      ref={setNodeRef}
      style={style}
      className={cardClasses}
      {...(!isDragging && { ...attributes, ...listeners })}
      data-card-id={card.id}
      data-is-dragging={isBeingDragged ? "true" : "false"}
      onClick={handleCardClick}
    >
      <div className="card-type-badge">
        {card.type === 'bug' ? '🐞' : card.type === 'feature' ? '✨' : '📋'}
        <span className="card-type-text">{card.type}</span>
        
        {card.priority === 'emergency' && (
          <span className="card-priority emergency">EMERGENCY</span>
        )}
        {card.priority === 'date-sensitive' && (
          <span className="card-priority date-sensitive">DATE SENSITIVE</span>
        )}
      </div>
      
      <div className="card-content">
        <div className="card-header">
          <h3>{card.title}</h3>
        </div>
        
        {/* <div className="card-description">
          <ReactMarkdown>{card.description}</ReactMarkdown>
        </div> */}
        
        {card.dueDate && (
          <div className={`card-due-date ${isPastDue ? 'overdue' : ''}`}>
            Due: {formatDate(card.dueDate)}
          </div>
        )}
        
        {/* Display time tracking if available */}
        {card.timeInColumns && card.timeInColumns.length > 0 && (
          <div className="card-time-tracking" title="Total time on board">
            <span className="time-icon">⏱️</span>
            {formatTimeDuration(calculateTimeSinceLastMove(card))}
          </div>
        )}
        
        {card.checklist && card.checklist.length > 0 && (
          <div className="card-checklist">
            <div className="checklist-progress">
              <div 
                className="checklist-progress-bar"
                style={{ width: `${checklistProgress}%` }}
              ></div>
            </div>
            <span className="checklist-count">
              {card.checklist.filter(item => item.completed).length}/{card.checklist.length}
            </span>
          </div>
        )}

        {card.labels && card.labels.length > 0 && (
          <div className="card-labels">
            {card.labels.map(label => (
              <span 
                key={label.id} 
                className="card-label" 
                style={{ backgroundColor: label.color }}
                title={label.name}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        
        {/* Display movement count if available */}
        {/* {card.movementHistory && card.movementHistory.length > 0 && (
          <div className="card-movement-count" title="Number of column moves">
            <span className="movement-icon">🔄</span> {card.movementHistory.length}
          </div>
        )} */}
        
        {/* Display assigned users */}
        {Array.isArray(card.assignedUsers) && card.assignedUsers.length > 0 && (
          <div className="card-assigned-users">
            {card.assignedUsers.map(userId => (
              <div 
                key={userId} 
                className="user-avatar" 
                title={getUserName(userId)}
              >
                {getUserInitials(userId)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;

export const forceCardUpdate = (cardId: string) => {
  if (typeof window !== 'undefined') {
    console.log(`Forcing update for card ${cardId} via global helper`);
    const event = new CustomEvent('force-card-update', {
      detail: { cardId }
    });
    window.dispatchEvent(event);
  }
};
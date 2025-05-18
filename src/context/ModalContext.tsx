import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Card as CardType, Board } from '../types';
import CardModal from '../components/Cards/CardModal';
import { forceCardUpdate } from '../components/Cards/Card';

// Global function to force a complete UI refresh
export function forceCompleteUIRefresh(boardId: string) {
  if (typeof window !== 'undefined') {
    // Dispatch a sequence of events to ensure UI updates
    console.log("Forcing complete UI refresh");
    
    // First event - board saved
    const savedEvent = new CustomEvent('board-saved', { 
      detail: { boardId, timestamp: Date.now(), forceUpdate: true } 
    });
    window.dispatchEvent(savedEvent);
    
    // Second event - force board rerender
    setTimeout(() => {
      const forceEvent = new CustomEvent('force-board-rerender', {
        detail: { timestamp: Date.now(), forceUpdate: true }
      });
      window.dispatchEvent(forceEvent);
    }, 10);
    
    // Third event - complete refresh
    setTimeout(() => {
      const completeEvent = new CustomEvent('complete-ui-refresh', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(completeEvent);
    }, 20);
  }
}

// Define the context interface
interface ModalContextType {
  isCardModalOpen: boolean;
  currentCard: CardType | null;
  currentColumnId: string | null;
  currentBoard: Board | null;
  openCardModal: (card: CardType, columnId: string, board: Board) => void;
  closeCardModal: () => void;
  saveBoard: () => void;
}

// Create the context with default values
const ModalContext = createContext<ModalContextType | undefined>(undefined);

// Custom hook to use the modal context
export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
  board: Board;
  setBoard: React.Dispatch<React.SetStateAction<Board>>;
  logActivity: (cardId: string, action: string) => void;
  saveToFirebase?: () => void;
  saveBoard: () => void;
  updateCard: (cardId: string, updates: Partial<CardType>) => void;
}

// Provider component
export const ModalProvider: React.FC<ModalProviderProps> = ({ 
  children, 
  board, 
  setBoard, 
  logActivity, 
  saveToFirebase,
  saveBoard,
  updateCard
}) => {
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState<CardType | null>(null);
  const [currentColumnId, setCurrentColumnId] = useState<string | null>(null);
  const [currentBoard, setCurrentBoard] = useState<Board | null>(null);

  // Function to open the card modal
  const openCardModal = (card: CardType, columnId: string, currentBoard: Board) => {
    setCurrentCard(card);
    setCurrentColumnId(columnId);
    setCurrentBoard(currentBoard);
    setIsCardModalOpen(true);
  };

  // Function to close the card modal
  const closeCardModal = () => {
    setIsCardModalOpen(false);
    // Clean up state after animation completes
    setTimeout(() => {
      setCurrentCard(null);
      setCurrentColumnId(null);
      setCurrentBoard(null);
    }, 300);
  };

  // Make sure priority changes in the modal properly update the board state
  const handleCardChange = (updatedCard: CardType) => {
    if (!board || !setBoard || !currentCard || !currentColumnId) return;
    
    console.log(`Modal updating card:`, {
      id: updatedCard.id,
      title: updatedCard.title,
      priority: updatedCard.priority,
      columnId: currentColumnId
    });
    
    // Check if priority changed - save this value before updating the board
    const priorityChanged = currentCard.priority !== updatedCard.priority;
    
    // Use functional update pattern for consistency
    setBoard(prevBoard => {
      const newBoard = {...prevBoard};
      
      // Update card in the cards collection
      newBoard.cards[updatedCard.id] = {
        ...updatedCard,
        // Add an updated timestamp to ensure we detect the change
        updated: new Date()
      };
      
      // Add a timestamp to force re-renders
      newBoard.clientTimestamp = Date.now();
      
      return newBoard;
    });
    
    // Save the board immediately
    saveBoard();
    
    // Dispatch the card-updated event that Card.tsx is already listening for
    if (typeof window !== 'undefined') {
      console.log(`Dispatching card-updated event for card ${updatedCard.id}`);
      const event = new CustomEvent('card-updated', {
        detail: {
          cardId: updatedCard.id,
          updatedCard: updatedCard
        }
      });
      window.dispatchEvent(event);
    }
    
    // Close the modal after a short delay
    setTimeout(() => {
      closeCardModal();
    }, 100);
    
    // Log the activity
    if (logActivity) {
      const message = priorityChanged
        ? `Changed priority from ${currentCard.priority} to ${updatedCard.priority}`
        : `Updated card details`;
      
      logActivity(updatedCard.id, message);
    }
  };

  return (
    <ModalContext.Provider 
      value={{ 
        isCardModalOpen, 
        currentCard, 
        currentColumnId, 
        currentBoard, 
        openCardModal, 
        closeCardModal,
        saveBoard
      }}
    >
      {children}
      
      {/* Simply render the modal directly - no portal */}
      {currentCard && currentColumnId && currentBoard && (
        <CardModal
          isOpen={isCardModalOpen}
          onClose={closeCardModal}
          card={currentCard}
          columnId={currentColumnId}
          board={currentBoard as Board}
          setBoard={setBoard}
          logActivity={logActivity}
          onCardChange={handleCardChange}
          saveBoard={saveBoard}
        />
      )}
    </ModalContext.Provider>
  );
};

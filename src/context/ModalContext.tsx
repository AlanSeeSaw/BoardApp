import React, { createContext, useState, useContext, ReactNode } from 'react';
import { Card as CardType, Board } from '../types';
import CardModal from '../components/Cards/CardModal';

// Define the context interface
interface ModalContextType {
  isCardModalOpen: boolean;
  currentCard: CardType | null;
  currentColumnId: string | null;
  currentBoard: Board | null;
  openCardModal: (card: CardType, columnId: string, board: Board) => void;
  closeCardModal: () => void;
  updateCard: (card: CardType) => void;
  deleteCard: (cardId: string, columnId: string) => void;
  archiveCard: (card: CardType, columnId: string) => void;
}

// Create the context with default values
const ModalContext = createContext<ModalContextType | undefined>(undefined);

// Custom hook to use the modal context
export const useModal = () => {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error('useModal must be used within a ModalContext');
  }
  return context;
};

interface ModalProviderProps {
  children: ReactNode;
  board: Board;
  updateCard: (card: CardType) => void;
  deleteCard: (cardId: string, columnId: string) => void;
  archiveCard: (card: CardType, columnId: string) => void;
}

// Provider component
export const ModalProvider: React.FC<ModalProviderProps> = ({
  children,
  board,
  updateCard,
  deleteCard,
  archiveCard,
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
    setCurrentCard(null);
    setCurrentColumnId(null);
    setCurrentBoard(null);
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
        updateCard,
        deleteCard,
        archiveCard,
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
          updateCard={updateCard}
          deleteCard={deleteCard}
          archiveCard={archiveCard}
        />
      )}
    </ModalContext.Provider>
  );
};

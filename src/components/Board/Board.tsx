import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Board as BoardType, Column as ColumnType, Card as CardType } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import Column from './Column';
import ArchivedCards from '../ArchivedCards';
import { useSaveBoard } from '../../hooks/useSaveBoard';
import { ModalProvider } from '../../context/ModalContext';
import { recordCardMovement } from '../../utils/CardMovement';
// Remove ExpeditePane import since it's now used within columns

interface BoardProps {
  board: BoardType;
  setBoard: React.Dispatch<React.SetStateAction<BoardType>>;
  selectedCards: string[];
  toggleCardSelection: (cardId: string, isSelected: boolean) => void;
  logActivity: (cardId: string, action: string) => void;
  activeDragId?: string | null;
  style?: React.CSSProperties;
  showArchived?: boolean;
  updateBoardInFirebase?: (updatedBoard: BoardType) => void;
  saveBoard: () => void;
  updateCard: (cardId: string, updates: Partial<CardType>) => void;
}

const Board: React.FC<BoardProps> = ({ 
  board, 
  setBoard, 
  selectedCards, 
  toggleCardSelection,
  logActivity,
  activeDragId, // Add to component parameters
  style,
  showArchived, // Add to component parameters
  updateBoardInFirebase,
  saveBoard,
  updateCard
}) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  // Removed: const [showArchived, setShowArchived] = useState(false);

  // Remove redundant code
  // Removed: activeCard state, isDragging state, onDragStart and onDragEnd functions

  // Get archived cards from archivedCardIds
  const archivedCards = useMemo(() => {
    return board.archivedCardIds
      .map(id => board.cards[id])
      .filter(Boolean);
  }, [board.archivedCardIds, board.cards]);

  // Check if any card in the board is expedited (has emergency priority)
  const hasExpeditedCards = useMemo(() => {
    // Get all card IDs from all columns
    const allCardIds = board.columns.flatMap(column => column.cardIds);
    
    // Check if any of these cards has emergency priority
    return allCardIds.some(cardId => {
      const card = board.cards[cardId];
      return card && card.priority === 'emergency';
    });
  }, [board.columns, board.cards]);

  const handleAddColumn = () => {
    if (newColumnTitle.trim() === '') return;
    
    const newColumn: ColumnType = {
      id: uuidv4(),
      title: newColumnTitle,
      cardIds: [], // Use cardIds instead of cards
      wipLimit: 0,
      isCollapsed: false
    };
    
    setBoard(prev => ({
      ...prev,
      columns: [...prev.columns, newColumn]
    }));
    
    setNewColumnTitle('');
    logActivity('board', `Added new column: ${newColumnTitle}`);
  };

  const handleRestoreCard = useCallback((cardId: string) => {
    // Check if card exists
    if (!board.cards[cardId]) return;
    
    // Get the card object
    const restoredCard = board.cards[cardId];
    const destination = board.columns[0]; // Default to first column
    
    setBoard(prev => {
      // Remove from archivedCardIds
      const updatedArchivedCardIds = prev.archivedCardIds.filter(id => id !== cardId);
      
      // Add to destination column
      const updatedColumns = prev.columns.map(col => {
        if (col.id === destination.id) {
          return {
            ...col,
            cardIds: [...col.cardIds, cardId]
          };
        }
        return col;
      });
      
      return {
        ...prev,
        archivedCardIds: updatedArchivedCardIds,
        columns: updatedColumns
      };
    });
    
    logActivity(cardId, `Restored to ${destination.title}`);
  }, [board.cards, board.columns, board.archivedCardIds, logActivity]);

  // Move refs outside of useEffect to fix hooks violations
  const prevColCount = React.useRef(0);
  const prevArchivedCount = React.useRef(0);

  // Only log when something actually changes
  useEffect(() => {
    const colChanged = prevColCount.current !== board.columns.length;
    const archivedChanged = prevArchivedCount.current !== board.archivedCardIds.length;
    
    if (colChanged || archivedChanged) {
      console.log('Board state updated:', {
        columns: board.columns.length,
        archived: board.archivedCardIds.length
      });
      
      // Update refs
      prevColCount.current = board.columns.length;
      prevArchivedCount.current = board.archivedCardIds.length;
    }
  }, [board]);

  const handleCardMove = (cardId: string, fromColumnId: string, toColumnId: string) => {
    if (board && setBoard) {
      const updatedBoard = recordCardMovement(board, cardId, fromColumnId, toColumnId) as BoardType;
      setBoard(updatedBoard);
      
      // If you're syncing with Firebase, you might want to update here
      if (updateBoardInFirebase) {
        updateBoardInFirebase(updatedBoard);
      }
    }
  };

  // Add this cleanup effect in the Board component
  useEffect(() => {
    return () => {
      // Cleanup function when Board unmounts or changes
      document.querySelectorAll('.dragging-ghost').forEach(el => {
        el.remove();
      });
    };
  }, []);

  // Handler for force updates
  useEffect(() => {
    const handleForceUpdate = (e: Event) => {
      // Force a component update by updating state with current timestamp
      setBoard(prevBoard => ({
        ...prevBoard,
        _forceUpdateTimestamp: Date.now()
      }));
    };
    
    window.addEventListener('force-board-rerender', handleForceUpdate);
    
    return () => {
      window.removeEventListener('force-board-rerender', handleForceUpdate);
    };
  }, [setBoard]);

  return (
    <div className="board-container">
      <ModalProvider 
        board={board} 
        setBoard={setBoard} 
        logActivity={logActivity}
        saveBoard={saveBoard}
        updateCard={updateCard}
      >
        {showArchived ? (
          <ArchivedCards 
            archivedCards={archivedCards}
            onRestore={handleRestoreCard}
          />
        ) : (
          <>
            {/* Remove global ExpeditePane - it's now per column */}
            
            <div className="board">
              {board.columns.map(column => (
                <Column 
                  key={column.id} 
                  column={column} 
                  board={board} 
                  setBoard={setBoard} 
                  selectedCards={selectedCards}
                  toggleCardSelection={toggleCardSelection}
                  logActivity={logActivity}
                  activeDragId={activeDragId}
                  showExpeditePane={hasExpeditedCards}
                  updateCardMovement={handleCardMove}
                />
              ))}
              
              {isAddingColumn ? (
                <div className="column">
                  <div className="column-header">
                    <input
                      type="text"
                      value={newColumnTitle}
                      onChange={(e) => setNewColumnTitle(e.target.value)}
                      placeholder="Enter column title"
                      className="column-title-input"
                      autoFocus
                    />
                  </div>
                  <div className="card-form-actions" style={{ padding: '1rem' }}>
                    <button onClick={handleAddColumn} className="save-button">
                      Add Column
                    </button>
                    <button 
                      onClick={() => {
                        setIsAddingColumn(false);
                        setNewColumnTitle('');
                      }} 
                      className="cancel-button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="add-column-button"
                  onClick={() => setIsAddingColumn(true)}
                >
                  + Add Column
                </div>
              )}
            </div>
          </>
        )}
      </ModalProvider>
    </div>
  );
};

export default React.memo(Board);
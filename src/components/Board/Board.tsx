import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Board as BoardType, Card } from '../../types';
import Column from './Column';
import ArchivedCards from '../ArchivedCards';
import { deleteHistoricalCard } from '../../services/historicalCardService';
import { db } from '../../firebase';

interface BoardProps {
  board: BoardType;
  selectedCards: string[];
  toggleCardSelection: (cardId: string, isSelected: boolean) => void;
  activeDragId?: string | null;
  style?: React.CSSProperties;
  showArchived?: boolean;
  deleteColumn: (columnId: string) => void;
  updateColumnTitle: (columnId: string, newTitle: string) => void;
  addColumn: (title: string, wipLimit?: number) => void;
  addCard: (card: Card, columnId: string) => void;
  restoreCard: (card: Card, destinationColumnId: string) => void;
}

const Board: React.FC<BoardProps> = ({
  board,
  selectedCards,
  toggleCardSelection,
  activeDragId,
  style,
  showArchived,
  deleteColumn,
  updateColumnTitle,
  addColumn,
  addCard,
  restoreCard,
}) => {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  // Get archived cards from board.archivedCards
  const archivedCards = useMemo(() => {
    return board.archivedCards || [];
  }, [board.archivedCards]);

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
    addColumn(newColumnTitle);
    setNewColumnTitle('');
  };

  const handleRestoreCard = useCallback(async (cardId: string) => {
    // Find the archived card object
    const archiveList = board.archivedCards || [];
    const restoredCard = archiveList.find(c => c.id === cardId);
    if (!restoredCard) return;
    // Determine destination column based on original columnId, fallback to first
    const origColId = restoredCard.currentColumnId;
    const destination = board.columns.find(col => col.id === origColId) || board.columns[0];
    // Append a new open time tracking entry for the restored column
    const now = new Date();
    const updatedTimeInColumns = [
      ...(restoredCard.timeInColumns || []),
      { columnId: destination.id, enteredAt: now, exitedAt: null }
    ];
    const cardWithTracking = { ...restoredCard, timeInColumns: updatedTimeInColumns };

    // Use the restoreCard updater
    restoreCard(cardWithTracking, destination.id);

    // Remove document from Firestore historicalCards collection (if exists)
    deleteHistoricalCard(db, board.ownerId, board.id, cardId).catch(err => console.error('Error removing historical card:', err));
  }, [board.archivedCards, board.columns, board.ownerId, board.id, restoreCard]);

  // Add this cleanup effect in the Board component
  useEffect(() => {
    return () => {
      // Cleanup function when Board unmounts or changes
      document.querySelectorAll('.dragging-ghost').forEach(el => {
        el.remove();
      });
    };
  }, []);

  return (
    <div className="board-container">
      {showArchived ? (
        <ArchivedCards
          archivedCards={archivedCards}
          onRestore={handleRestoreCard}
        />
      ) : (
        <>
          <div className="board">
            {board.columns.map(column => (
              <Column
                key={column.id}
                column={column}
                board={board}
                selectedCards={selectedCards}
                toggleCardSelection={toggleCardSelection}
                activeDragId={activeDragId}
                showExpeditePane={hasExpeditedCards}
                deleteColumn={deleteColumn}
                updateColumnTitle={updateColumnTitle}
                addCard={addCard}
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
    </div>
  );
};

export default React.memo(Board);
import React, { useState, useMemo, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';

import { Column as ColumnType, Board, Card as CardType, IssueType, Priority } from '../../types';
import { ISSUE_TYPES, PRIORITIES } from '../../constants/initialBoard';
import ColumnCapacity from './ColumnCapacity';
import Card from '../Cards/Card';
import ExpeditePane from './ExpeditePane'; // Import ExpeditePane
import NewCard from '../Cards/NewCard'; // Import the NewCard component

interface ColumnProps {
  column: ColumnType;
  board: Board;
  selectedCards: string[];
  toggleCardSelection: (cardId: string, isSelected: boolean) => void;
  activeDragId?: string | null;
  showExpeditePane?: boolean;
  deleteColumn: (columnId: string) => void;
  updateColumnTitle: (columnId: string, newTitle: string) => void;
  addCard: (card: CardType, columnId: string) => void;
}

const Column: React.FC<ColumnProps> = ({
  column,
  board,
  selectedCards,
  toggleCardSelection,
  activeDragId,
  showExpeditePane = false, // Default to false
  deleteColumn,
  updateColumnTitle,
  addCard,
}) => {
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardDescription, setNewCardDescription] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(column.title);
  const [isCollapsed, setIsCollapsed] = useState(column.isCollapsed || false);
  const [newCardType, setNewCardType] = useState<IssueType>('task');
  const [newCardPriority, setNewCardPriority] = useState<Priority>('normal');
  const [showWipError, setShowWipError] = useState(false);

  // Get cards from cardIds
  const getCardsFromIds = (cardIds: string[]) => {
    return cardIds
      .map(id => board.cards[id])
      .filter(Boolean); // Filter out any undefined cards
  };

  // Get column cards
  const columnCards = useMemo(() => {
    return getCardsFromIds(column.cardIds || []);
  }, [column.cardIds, board.cards]);


  // Separate emergency cards from regular cards with more careful handling
  const emergencyCards = useMemo(() => {
    const filtered = columnCards.filter(card => card.priority === 'emergency');

    return filtered;
  }, [columnCards, column.title]);

  // Use a more specific check to filter out emergency cards
  const regularCards = useMemo(() => {
    const filtered = columnCards.filter(card => card.priority !== 'emergency');
    return filtered;
  }, [columnCards, column.title]);

  // Set up the droppable area
  const { setNodeRef, isOver } = useDroppable({
    id: `column:${column.id}`,
    data: {
      columnId: column.id,
      type: 'column'
    }
  });

  const wouldExceedWipLimit = (column: ColumnType) => {
    // If wipLimit is Infinity, null, undefined, or a non-positive number, consider it "no limit"
    if (!column.wipLimit || column.wipLimit === Infinity || column.wipLimit <= 0) {
      return false;
    }
    return column.cardIds.length >= column.wipLimit;
  };

  const handleAddCard = () => {
    // Check if adding a card would exceed WIP limit
    if (wouldExceedWipLimit(column)) {
      setShowWipError(true);
      setTimeout(() => setShowWipError(false), 3000);
      return;
    }

    setIsAddingCard(true);
  };

  const handleSaveCard = () => {
    if (newCardTitle.trim() === '') return;

    // Double-check WIP limit before saving
    if (wouldExceedWipLimit(column) && newCardPriority !== 'emergency') {
      setShowWipError(true);
      setTimeout(() => setShowWipError(false), 3000);
      return;
    }

    // Build the new card object
    const newCard: CardType = {
      id: (window as any).uuidv4 ? (window as any).uuidv4() : require('uuid').v4(),
      title: newCardTitle,
      description: newCardDescription,
      type: newCardType,
      priority: newCardPriority,
      createdAt: new Date(),
      updatedAt: new Date(),
      dueDate: null,
      labels: [],
      checklist: [],
      assignedUsers: [],
      currentColumnId: column.id,
      movementHistory: [],
      timeInColumns: [
        {
          columnId: column.id,
          enteredAt: new Date(),
          exitedAt: null,
        },
      ],
    };
    addCard(newCard, column.id);
    setNewCardTitle('');
    setNewCardDescription('');
    setNewCardType('task');
    setNewCardPriority('normal');
    setIsAddingCard(false);
  };

  const handleCancelAdd = () => {
    setNewCardTitle('');
    setNewCardDescription('');
    setNewCardType('task');
    setNewCardPriority('normal');
    setIsAddingCard(false);
  };

  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setEditedTitle(column.title);
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim() === '') return;
    updateColumnTitle(column.id, editedTitle);
    setIsEditingTitle(false);
  };

  const handleCancelEdit = () => {
    setIsEditingTitle(false);
  };

  const handleDeleteColumn = () => {
    if (column.cardIds.length > 0) {
      const confirmDelete = window.confirm(
        `This column contains ${column.cardIds.length} cards. Are you sure you want to delete it and all its cards?`
      );
      if (!confirmDelete) return;
    }
    deleteColumn(column.id);
  };

  return (
    <div className="column">
      <div className="column-header">
        {isEditingTitle ? (
          <div className="column-title-edit">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="column-title-input"
              autoFocus
            />
            <div className="column-title-actions">
              <button onClick={handleSaveTitle} className="save-button">Save</button>
              <button onClick={handleCancelEdit} className="cancel-button">Cancel</button>
              <button onClick={handleDeleteColumn} className="delete-button">Delete</button>
            </div>
          </div>
        ) : (
          <div className="column-title-container">
            <h2 className="column-title" onClick={handleEditTitle}>
              {column.title}
            </h2>
            <ColumnCapacity column={column} />
          </div>
        )}
      </div>

      {showWipError && (
        <div className="wip-limit-error">
          WIP limit exceeded. This column is at capacity.
        </div>
      )}

      {/* Show ExpeditePane based on the global flag, not just local emergency cards */}
      {!isCollapsed && showExpeditePane && (
        <ExpeditePane
          columnId={column.id}
          cards={emergencyCards} // Still pass only this column's emergency cards
          board={board}
          toggleCardSelection={toggleCardSelection}
          selectedCards={selectedCards}
          activeDragId={activeDragId}
          columnTitle={column.title}
        />
      )}

      <div
        ref={setNodeRef}
        className={`card-list ${isOver ? 'dropping-zone' : ''} ${isCollapsed ? 'collapsed' : ''}`}
        data-column-id={column.id} // Add data attribute for better debugging
      >
        {!isCollapsed && regularCards.map((card, index) => (
          <Card
            key={card.id}
            card={card}
            index={index}
            columnId={column.id}
            board={board}
            isSelected={selectedCards.includes(card.id)}
            toggleSelection={toggleCardSelection}
            activeDragId={activeDragId}
          />
        ))}

        {!isCollapsed && isAddingCard && (
          <NewCard
            newCardType={newCardType}
            setNewCardType={setNewCardType}
            newCardPriority={newCardPriority}
            setNewCardPriority={setNewCardPriority}
            newCardTitle={newCardTitle}
            setNewCardTitle={setNewCardTitle}
            newCardDescription={newCardDescription}
            setNewCardDescription={setNewCardDescription}
            handleSaveCard={handleSaveCard}
            handleCancelAdd={handleCancelAdd}
            ISSUE_TYPES={ISSUE_TYPES}
            PRIORITIES={PRIORITIES}
          />
        )}
      </div>

      {!isCollapsed && !isAddingCard && (
        <button
          className={`add-card-button ${wouldExceedWipLimit(column) ? 'disabled' : ''}`}
          onClick={handleAddCard}
          disabled={wouldExceedWipLimit(column)}
        >
          + Add Card {wouldExceedWipLimit(column) && '(WIP Limit Reached)'}
        </button>
      )}
    </div>
  );
};

export default React.memo(Column);
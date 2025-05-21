import { useState } from 'react';
import { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Board, Card } from '../types';

export const useDragAndDrop = (
  board: Board | null,
  moveCard: (
    cardId: string,
    sourceColumnId: string,
    destinationColumnId: string,
    destinationIndex: number
  ) => Promise<void>,
) => {
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  if (!board) {
    return {
      activeDragId: null,
      activeCard: null,
      handleDragStart: () => { },
      handleDragEnd: () => { },
      handleDragCancel: () => { },
    }
  }

  const findCardById = (cardId: string): Card | undefined => {
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

        // Compute destination index (append to end)
        const destColumn = board.columns.find(col => col.id === targetColumnId);
        const destinationIndex = destColumn ? destColumn.cardIds.length : 0;

        // Delegate to moveCardOnBoard for optimistic update & persistence
        try {
          await moveCard(cardId, sourceColumnId, targetColumnId, destinationIndex);
        } catch (err) {
          console.error(`Error moving card ${cardId}:`, err);
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
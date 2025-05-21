import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card as CardType, Board } from '../../types';
import { useModal } from '../../context/ModalContext';
import './Card.css';
import { calculateTimeSinceLastMove, formatTimeDuration } from '../../utils/cardUtils';

export interface CardProps {
  card: CardType;
  index?: number;
  columnId?: string;
  board?: Board;
  isSelected: boolean;
  toggleSelection: (cardId: string, isSelected: boolean) => void;
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
  isSelected,
  toggleSelection,
  isDragging = false,
  activeDragId = null,
  // New tracking props
  updateCardMovement,
  updateTimeInColumn
}) => {
  const { openCardModal } = useModal();
  const isBeingDragged = card.id === activeDragId;

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

  const getUserInitials = (userId: string) => {
    const user = board?.users.find(u => u.id === userId);
    if (!user) {
      return "-1";
    }

    const nameParts = user?.name.split(' ');
    if (nameParts.length > 1) {
      return nameParts[0].charAt(0) + nameParts[1].charAt(0);
    } else {
      return user?.name.substring(0, 2);
    }

  };

  const getUserName = (userId: string) => {
    const user = board?.users.find(u => u.id === userId);
    return user?.name;
  };


  // Simplified handlers for normalized data structure
  const handleCardClick = (e: React.MouseEvent) => {
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

  return (
    <div
      key={`card-${card.id}-${Date.now()}`}
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
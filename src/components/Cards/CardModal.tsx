import React, { useState, useEffect } from 'react';
import { Card as CardType, Board, CardLabel, ChecklistItem, Priority, IssueType, TimeEstimate, User } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import './CardModal.css';
import { createLLMService } from '../../services/LLMService';
import { calculateTimeSinceLastMove, formatTimeDuration } from '../../utils/cardUtils';
import { saveToHistoricalCollection } from '../../services/historicalCardService';
import { getTimeEstimate, TimeEstimatePayload } from '../../services/timeEstimateService';
import { db } from '../../firebase';

// TODO: down the line add conflict dectection (if change time is past since we started editing, give message to user)
// This would come with a card editing overhaul where we have trello style

interface CardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: CardType | null;
  columnId: string | null;
  board: Board | null;
  apiKey?: string; // Optional API key for LLM service
  updateCard: (card: CardType) => void;
  deleteCard: (cardId: string, columnId: string) => void;
  archiveCard: (card: CardType, columnId: string) => void;
}

const CardModal: React.FC<CardModalProps> = ({
  isOpen,
  onClose,
  card,
  columnId,
  board,
  apiKey,
  updateCard,
  deleteCard,
  archiveCard,
}) => {
  // Add state for edit mode
  const [isEditMode, setIsEditMode] = useState(false);

  // State for edited card properties
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [editedLabels, setEditedLabels] = useState<CardLabel[]>([]);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3498db');
  const [editedChecklist, setEditedChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [editedPriority, setEditedPriority] = useState<Priority>('normal');
  const [editedType, setEditedType] = useState<IssueType>('task');
  // Add state for assigned users
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userToAssign, setUserToAssign] = useState<string>('');

  // Add new state variables for the new features
  const [codebaseContext, setCodebaseContext] = useState('');
  const [devTimeEstimate, setDevTimeEstimate] = useState('');
  const [timeEstimate, setTimeEstimate] = useState<TimeEstimate | null>(null);
  const [showTEPanel, setShowTEPanel] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);
  const [isGeneratingTimeEstimate, setIsGeneratingTimeEstimate] = useState(false);

  // Add state for loading state during API call
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [timeEstimateError, setTimeEstimateError] = useState<string | null>(null);

  // Add a consistent date formatting function
  const formatDate = (date: Date | string | number | null): string => {
    if (!date) return '';

    // Create a new Date object to ensure consistent handling
    const dateObj = new Date(date);

    // Use a consistent method that doesn't have timezone issues
    // This creates a date string in user's local timezone without time component
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Convert date to YYYY-MM-DD format for input[type="date"]
  const dateToInputFormat = (date: string | number | Date | null | undefined): string => {
    if (!date) return '';

    try {
      const dateObj = new Date(date);
      // Check if valid date before returning
      if (!isNaN(dateObj.getTime())) {
        // Get the date in local timezone, not UTC
        const year = dateObj.getFullYear();
        // Month is 0-indexed, so add 1 and pad with leading zero if needed
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.error("Error parsing due date:", e);
    }

    return '';
  };

  // Initialize form state when card changes
  useEffect(() => {
    if (card) {
      setEditedTitle(card.title);
      setEditedDescription(card.description || '');
      setEditedDueDate(() => {
        // Use the new helper function for consistent date handling
        return dateToInputFormat(card.dueDate);
      });
      setEditedLabels(card.labels || []);
      setEditedChecklist(card.checklist || []);
      setEditedPriority(card.priority);
      setEditedType(card.type);
      // Ensure assignedUsers is always initialized as an array
      setAssignedUsers(Array.isArray(card.assignedUsers) ? [...card.assignedUsers] : []);
      // Initialize the new fields
      setCodebaseContext(card.codebaseContext || '');
      setDevTimeEstimate(card.devTimeEstimate || '');
      // Load existing LLM time estimates
      setTimeEstimate(card.timeEstimate || null);
      // Reset to display mode when a new card is loaded
      setIsEditMode(false);
    }
  }, [card]);

  // Add/remove modal-open class to body when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }

    // Cleanup function to ensure class is removed when component unmounts
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [isOpen]);

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Label handling
  const addLabel = () => {
    if (newLabelName.trim() === '') return;

    const newLabel: CardLabel = {
      id: uuidv4(),
      name: newLabelName,
      color: newLabelColor
    };

    setEditedLabels([...editedLabels, newLabel]);
    setNewLabelName('');
  };

  const removeLabel = (labelId: string) => {
    setEditedLabels(editedLabels.filter(label => label.id !== labelId));
  };

  // Checklist handling
  const addChecklistItem = () => {
    if (newChecklistItem.trim() === '') return;

    const newItem: ChecklistItem = {
      id: uuidv4(),
      text: newChecklistItem,
      completed: false
    };

    setEditedChecklist([...editedChecklist, newItem]);
    setNewChecklistItem('');
  };

  const toggleChecklistItem = (itemId: string) => {
    setEditedChecklist(
      editedChecklist.map(item =>
        item.id === itemId
          ? { ...item, completed: !item.completed }
          : item
      )
    );
  };

  const removeChecklistItem = (itemId: string) => {
    setEditedChecklist(editedChecklist.filter(item => item.id !== itemId));
  };

  const assignUser = () => {
    if (!userToAssign || assignedUsers.includes(userToAssign)) return;

    const userObj = board?.users.find(u => u.id === userToAssign);

    const userIdToStore = userObj?.id || userToAssign;

    const newAssignedUsers = [...assignedUsers, userIdToStore];
    console.log(`Assigning user ${userToAssign}, new list:`, newAssignedUsers);
    setAssignedUsers(newAssignedUsers);
    setUserToAssign('');
  };

  const removeAssignedUser = (userId: string) => {
    setAssignedUsers(assignedUsers.filter(u => u !== userId));
  };

  const getUserName = (userId: string) => {
    const user = board?.users.find(u => u.id === userId);
    return user?.name;
  };

  const handleSave = async () => {
    if (!card || !board || !columnId) return;

    // Bug with timeInColumns being undefined, this is the current fix.
    // TODO: In the future, maybe make a sanitize function that makes sure stuff like this doesn't happen?
    // Idk best practice
    const fixedTimeInColumns = (card.timeInColumns || []).map(entry => ({
      ...entry,
      exitedAt: entry.exitedAt === undefined ? null : entry.exitedAt,
    }));

    const updatedCard: CardType = {
      ...card,
      title: editedTitle,
      description: editedDescription,
      dueDate: editedDueDate ? (() => {
        const [year, month, day] = editedDueDate.split('-').map(Number);
        return new Date(year, month - 1, day, 12, 0, 0);
      })() : null,
      labels: editedLabels,
      checklist: editedChecklist,
      priority: editedPriority,
      type: editedType,
      assignedUsers: assignedUsers,
      currentColumnId: columnId,
      timeInColumns: fixedTimeInColumns,
      codebaseContext: codebaseContext,
      devTimeEstimate: devTimeEstimate,
      timeEstimate: timeEstimate || null,
      updatedAt: new Date()
    };

    try {
      updateCard(updatedCard);
    } catch (err) {
      console.error('Failed to update card:', err);
    }

    // Close the modal
    onClose();
  };

  // Delete card
  const handleDelete = () => {
    if (!card || !board || !columnId) return;

    if (!window.confirm("Are you sure you want to delete this card?")) {
      return;
    }

    // If card is in last column, save to historical collection
    const lastColumnId = board.columns[board.columns.length - 1].id;
    const isInLastColumn = columnId === lastColumnId;
    console.log(`[CardModal] Card is in last column: ${isInLastColumn}`);

    // TODO update this to use new saving system
    if (isInLastColumn) {
      saveToHistoricalCollection(
        db,
        board.ownerId, // Use the board's ownerId
        card,
        board,
      );
    }

    deleteCard(card.id, columnId);
    onClose();
  };

  // Archive card
  const handleArchive = () => {
    if (!card || !board || !columnId) return;

    // Find the card to archive
    let cardToArchive = board.cards[card.id];
    if (!cardToArchive) {
      console.error("Card not found for archiving");
      return;
    }
    // Stamp exitedAt and compute durationMs for the current column
    const now = new Date();
    const updatedTimeInColumns = cardToArchive.timeInColumns?.map(entry => {
      if (entry.columnId === columnId && entry.exitedAt == null) {
        const entered = entry.enteredAt instanceof Date ? entry.enteredAt : new Date(entry.enteredAt);
        return { ...entry, exitedAt: now, durationMs: now.getTime() - entered.getTime() };
      }
      return entry;
    }) || [];
    cardToArchive = { ...cardToArchive, timeInColumns: updatedTimeInColumns, dueDate: null };

    // If card is in last column, save to historical collection
    const lastColumnId = board.columns[board.columns.length - 1].id;
    const isInLastColumn = columnId === lastColumnId;
    console.log(`[CardModal] Card is in last column: ${isInLastColumn}`);

    if (isInLastColumn) {
      // Save with updated timeInColumns to historical collection
      saveToHistoricalCollection(
        db,
        board.ownerId,
        cardToArchive,
        board,
      );
    }

    archiveCard(cardToArchive, columnId);
    onClose();
  };

  // Utility functions for badge display
  const getBadgeProperties = (type: 'priority' | 'type', value: Priority | IssueType) => {
    const displays = {
      priority: {
        emergency: 'Emergency',
        'date-sensitive': 'Date Sensitive',
        normal: 'Normal'
      },
      type: {
        bug: 'Bug',
        feature: 'Feature',
        task: 'Task'
      }
    };

    return {
      text: displays[type][value as keyof typeof displays[typeof type]],
      className: `status-badge ${type}-${value}`
    };
  };

  const renderBadge = (type: 'priority' | 'type', value: Priority | IssueType) => {
    const { text, className } = getBadgeProperties(type, value);
    return <div className={className}>{text}</div>;
  };

  const renderField = (label: string, content: React.ReactNode) => (
    <div className="card-field">
      <h4>{label}</h4>
      {content}
    </div>
  );

  const renderEditField = (
    label: string,
    content: React.ReactNode
  ) => (
    <div className="edit-layout-row">
      <div className="edit-field-label">{label}</div>
      <div className="edit-field-content">{content}</div>
    </div>
  );

  // Function to generate acceptance criteria
  const generateAcceptanceCriteria = async () => {
    if (!apiKey && !process.env.REACT_APP_OPENAI_API_KEY) {
      setError('No API key available for the LLM service');
      return;
    }

    try {
      setIsGenerating(true);
      setError(null);

      // Create context from the current card and board
      const context = `
        Card Title: ${editedTitle}
        Card Description: ${editedDescription}
        Board Name: ${board?.title}
        Current Status: ${board?.columns.find(col => col.id === columnId)?.title || 'Unknown'}
      `;

      // Create LLM service with available API key
      const llmService = createLLMService(apiKey || process.env.REACT_APP_OPENAI_API_KEY || '');

      // Generate suggestions
      const suggestions = await llmService.generateAcceptanceCriteriaSuggestions(context);

      // Append suggestions to the current description
      const updatedDescription = editedDescription ?
        `${editedDescription}\n\n## Acceptance Criteria\n${suggestions}` :
        `## Acceptance Criteria\n${suggestions}`;

      setEditedDescription(updatedDescription);
    } catch (err) {
      console.error('Error generating acceptance criteria:', err);
      setError('Failed to generate acceptance criteria. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Dummy function for generating codebase context
  const generateCodebaseContext = async () => {
    try {
      setIsGeneratingContext(true);
      setContextError(null);

      // Dummy implementation - you'll replace this with actual implementation later
      console.log('Generating codebase context...');

      // Simulate API call with a timeout
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Dummy result
      const dummyContext = "This is a placeholder for generated codebase context.";
      setCodebaseContext(dummyContext);
    } catch (err) {
      console.error('Error generating codebase context:', err);
      setContextError('Failed to generate codebase context. Please try again.');
    } finally {
      setIsGeneratingContext(false);
    }
  };

  const generateTimeEstimate = async () => {
    try {
      setIsGeneratingTimeEstimate(true);
      setTimeEstimateError(null);

      console.log('Requesting time estimate via Firebase function...');
      if (!board || !card) { // Added card check for safety
        console.error('Board or card is not available for time estimate');
        setTimeEstimateError('Board or card data is missing.');
        return;
      }
      // Collect only the columns enabled for time estimation
      const columnsForEstimate = board.columns
        .filter(c => c.timeEstimationEnabled)
        .map(c => ({ id: c.id, title: c.title, description: c.description }));
      const payload: TimeEstimatePayload = {
        user_id: board.ownerId,
        board_id: board.id,
        card: card!,
        codebase_context: codebaseContext,
        columns: columnsForEstimate
      };
      // Call the Firebase function
      const result = await getTimeEstimate(payload);
      console.log('Time estimate result:', result.data);
      // Save structured result
      setTimeEstimate(result.data);
    } catch (err: any) {
      console.error('Error generating time estimate:', err);
      setTimeEstimateError(err.message || 'Failed to generate time estimate. Please try again.');
    } finally {
      setIsGeneratingTimeEstimate(false);
    }
  };

  const displayTimeEstimate = timeEstimate?.total;

  if (!isOpen || !card) return null;

  return (
    <div className="card-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="card-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="card-modal-header">
          <h2>{isEditMode ? 'Edit Card' : 'Card Details'}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="card-modal-content">
          {isEditMode ? (
            // Edit Mode with two-column layout
            <div className="edit-layout">
              {renderEditField("Title",
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="card-input"
                />
              )}

              {renderEditField("Description",
                <div>
                  <textarea
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className="card-textarea"
                    rows={4}
                  />
                  <div className="form-actions">
                    <button
                      onClick={generateAcceptanceCriteria}
                      className="btn btn-secondary"
                      disabled={isGenerating}
                    >
                      {isGenerating ? 'Generating...' : 'Generate Acceptance Criteria'}
                    </button>
                    {error && <div className="error-message">{error}</div>}
                  </div>
                </div>
              )}

              {renderEditField("Codebase Context",
                <div>
                  <textarea
                    value={codebaseContext}
                    onChange={(e) => setCodebaseContext(e.target.value)}
                    className="card-textarea"
                    rows={4}
                  />
                  <div className="form-actions">
                    <button
                      onClick={generateCodebaseContext}
                      className="btn btn-secondary"
                      disabled={isGeneratingContext}
                    >
                      {isGeneratingContext ? 'Generating...' : 'Generate Codebase Context card Help'}
                    </button>
                    {contextError && <div className="error-message">{contextError}</div>}
                  </div>
                </div>
              )}

              {renderEditField("Due Date",
                <input
                  type="date"
                  value={typeof editedDueDate === 'string' ? editedDueDate : ''}
                  onChange={(e) => setEditedDueDate(e.target.value)}
                  className="card-input"
                />
              )}

              {renderEditField("Priority",
                <select
                  value={editedPriority}
                  onChange={(e) => setEditedPriority(e.target.value as Priority)}
                  className="card-input"
                >
                  <option value="emergency">Emergency</option>
                  <option value="date-sensitive">Date Sensitive</option>
                  <option value="normal">Normal</option>
                </select>
              )}

              {renderEditField("Type",
                <select
                  value={editedType}
                  onChange={(e) => setEditedType(e.target.value as IssueType)}
                  className="card-input"
                >
                  <option value="bug">Bug</option>
                  <option value="feature">Feature</option>
                  <option value="task">Task</option>
                </select>
              )}

              {renderEditField("Assigned Users",
                <div>
                  <div className="assigned-users-list">
                    {assignedUsers.map(userId => (
                      <div key={userId} className="assigned-user-item">
                        <span>{getUserName(userId)}</span>
                        <button onClick={() => removeAssignedUser(userId)} className="btn-icon">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="form-row">
                    <select
                      value={userToAssign}
                      onChange={(e) => setUserToAssign(e.target.value)}
                      className="card-input"
                    >
                      <option value="">Select a user...</option>
                      {board?.users
                        .filter(user => !assignedUsers.includes(user.id))
                        .map(user => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                    </select>
                    <button onClick={assignUser} className="btn btn-primary">Assign</button>
                  </div>
                </div>
              )}

              {renderEditField("Labels",
                <div>
                  <div className="labels-list">
                    {editedLabels.map(label => (
                      <div key={label.id} className="label-item">
                        <span className="color-dot" style={{ backgroundColor: label.color }}></span>
                        <span>{label.name}</span>
                        <button onClick={() => removeLabel(label.id)} className="btn-icon">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Label name"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      className="card-input"
                    />
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="color-input"
                    />
                    <button onClick={addLabel} className="btn btn-primary">Add</button>
                  </div>
                </div>
              )}

              {renderEditField("Checklist",
                <div>
                  <div className="checklist">
                    {editedChecklist.map(item => (
                      <div key={item.id} className="checklist-item">
                        <input
                          type="checkbox"
                          checked={item.completed}
                          onChange={() => toggleChecklistItem(item.id)}
                          className="checkbox"
                        />
                        <span className={item.completed ? 'completed' : ''}>{item.text}</span>
                        <button onClick={() => removeChecklistItem(item.id)} className="btn-icon">×</button>
                      </div>
                    ))}
                  </div>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="New checklist item"
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      className="card-input"
                    />
                    <button onClick={addChecklistItem} className="btn btn-primary">Add</button>
                  </div>
                </div>
              )}

              {renderEditField("Dev Time Estimate",
                <div className="time-estimate-container">
                  <input
                    type="number"
                    value={devTimeEstimate}
                    onChange={(e) => setDevTimeEstimate(e.target.value)}
                    className="time-estimate-input"
                    min="0"
                  />
                  <span className="time-unit">days</span>
                </div>
              )}

              {renderEditField("LLM Time Estimate",
                <div>
                  <div className="time-estimate-container">
                    <input
                      type="number"
                      value={timeEstimate?.total ?? ''}
                      className="time-estimate-input"
                      min="0"
                      disabled
                    />
                    <span className="time-unit">days</span>
                  </div>
                  <div className="form-actions">
                    <button
                      onClick={generateTimeEstimate}
                      className="btn btn-secondary"
                      disabled={isGeneratingTimeEstimate}
                    >
                      {isGeneratingTimeEstimate ? 'Generating...' : 'Generate Estimated Completion Time'}
                    </button>
                    {timeEstimateError && <div className="error-message">{timeEstimateError}</div>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Display Mode
            <div className="card-display">
              <h3 className="card-title">{card.title}</h3>

              {card.description && renderField("Description",
                <div className="card-description">{card.description}</div>
              )}

              {renderField("Codebase Context",
                <div className="card-description">
                  {card.codebaseContext || <span className="empty-field">No codebase context available</span>}
                </div>
              )}

              <div className="card-meta">
                {card.dueDate && renderField("Due Date",
                  <div className="status-badge">
                    {formatDate(card.dueDate)}
                  </div>
                )}

                {/* Put priority and type side by side */}
                <div className="card-meta-row">
                  {renderField("Priority", renderBadge('priority', card.priority))}
                  {renderField("Type", renderBadge('type', card.type))}
                </div>

                {/* Time estimates side by side */}
                <div className="card-meta-row">
                  {renderField("Dev Time Estimate",
                    <div className="status-badge">
                      {card.devTimeEstimate ? `${card.devTimeEstimate} days` : 'Not estimated'}
                    </div>
                  )}
                  {renderField("Total LLM Estimate",
                    <div
                      className="status-badge info-badge"
                      onClick={() => setShowTEPanel(!showTEPanel)}
                      style={{ cursor: 'pointer' }}
                    >
                      {displayTimeEstimate ? `${timeEstimate.total} days` : 'Not estimated'}
                    </div>
                  )}
                  {columnId && timeEstimate?.columns?.[columnId] && renderField("Column Estimate",
                    <div className="status-badge">
                      {`${timeEstimate.columns[columnId].estimate} days`}
                    </div>
                  )}
                </div>
                {/* Details panel for LLM justification and per-column estimates */}
                {showTEPanel && displayTimeEstimate && board && (
                  <div className="time-estimate-panel">
                    <h4>Total Justification</h4>
                    <p>{timeEstimate.justification}</p>
                    <h5>Per-Column Estimates</h5>
                    <ul>
                      {Object.entries(timeEstimate.columns).map(([colId, detail]) => {
                        const col = board.columns.find(c => c.id === colId);
                        return (
                          <li key={colId}>
                            <strong>{col?.title || colId}:</strong> {detail.estimate} days
                            {detail.justification && <div className="column-justification">{detail.justification}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Show assigned users */}
              {assignedUsers.length > 0 && renderField("Assigned To",
                <div className="assigned-users-list">
                  {assignedUsers.map(userId => (
                    <div key={userId} className="assigned-user-item">
                      <span>{getUserName(userId)}</span>
                    </div>
                  ))}
                </div>
              )}

              {editedLabels.length > 0 && renderField("Labels",
                <div className="labels-list">
                  {editedLabels.map(label => (
                    <div key={label.id} className="label-item">
                      <span className="color-dot" style={{ backgroundColor: label.color }}></span>
                      <span>{label.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {editedChecklist.length > 0 && renderField("Checklist",
                <div className="checklist">
                  {editedChecklist.map(item => (
                    <div key={item.id} className="checklist-item">
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="checkbox"
                      />
                      <span className={item.completed ? 'completed' : ''}>{item.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card-modal-footer">
          {isEditMode ? (
            <>
              <div className="button-group">
                <button onClick={handleArchive} className="btn btn-warning">Archive</button>
                <button onClick={handleDelete} className="btn btn-danger">Delete</button>
              </div>
              <div className="button-group">
                <button onClick={toggleEditMode} className="btn btn-secondary">Cancel</button>
                <button onClick={handleSave} className="btn btn-primary">Save</button>
              </div>
            </>
          ) : (
            <div className="button-group">
              <button onClick={onClose} className="btn btn-secondary">Close</button>
              <button onClick={toggleEditMode} className="btn btn-primary">Edit</button>
            </div>
          )}
        </div>

        <div className="card-modal-section">
          <details className="movement-history-details">
            <summary>
              <h3 className="movement-history-title">Movement History</h3>
            </summary>
            <div className="movement-history-content">
              {card.movementHistory && card.movementHistory.length > 0 ? (
                <div className="movement-history">
                  <p>Total moves: {card.movementHistory.length}</p>

                  {(() => {
                    const timeSinceLastMove = calculateTimeSinceLastMove(card);
                    if (timeSinceLastMove !== null) {
                      return (
                        <div className="time-since-last-move">
                          <p><strong>Time since last move:</strong> {formatTimeDuration(timeSinceLastMove)}</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <ul className="movement-list">
                    {card.movementHistory.map((movement, index) => {
                      const fromColumn = board?.columns.find(col => col.id === movement.fromColumnId);
                      const toColumn = board?.columns.find(col => col.id === movement.toColumnId);

                      // Fix the movement display section to only use properties that exist
                      let moveDate;
                      try {
                        // Just use movedAt directly - no need for fallbacks
                        moveDate = new Date(movement.movedAt);
                      } catch (e) {
                        console.error('Error parsing date:', e);
                        moveDate = new Date(); // Fallback
                      }

                      return (
                        <li key={index}>
                          <strong>Moved:</strong> {fromColumn?.title || 'Unknown'} → {toColumn?.title || 'Unknown'}
                          <span className="movement-date">
                            {moveDate.toLocaleDateString()} {moveDate.toLocaleTimeString()}
                          </span>
                          {movement.movedBy && <span className="moved-by">by {movement.movedBy}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p>No movement history recorded yet.</p>
              )}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default CardModal;

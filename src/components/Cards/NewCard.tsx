import React from 'react';
import { IssueType, Priority } from '../../types'; // Adjust the import path as needed
import './NewCard.css'; // Import the CSS file

interface NewCardProps {
  newCardType: IssueType;
  setNewCardType: (type: IssueType) => void;
  newCardPriority: Priority;
  setNewCardPriority: (priority: Priority) => void;
  newCardTitle: string;
  setNewCardTitle: (title: string) => void;
  newCardDescription: string;
  setNewCardDescription: (description: string) => void;
  handleSaveCard: () => void;
  handleCancelAdd: () => void;
  ISSUE_TYPES: IssueType[];
  PRIORITIES: Priority[];
}

const NewCard: React.FC<NewCardProps> = ({
  newCardType,
  setNewCardType,
  newCardPriority,
  setNewCardPriority,
  newCardTitle,
  setNewCardTitle,
  newCardDescription,
  setNewCardDescription,
  handleSaveCard,
  handleCancelAdd,
  ISSUE_TYPES,
  PRIORITIES,
}) => {
  return (
    <div className="new-card">
      {/* Title first */}
      <div className="form-group">
        <input
          type="text"
          placeholder="Enter card title"
          value={newCardTitle}
          onChange={(e) => setNewCardTitle(e.target.value)}
          className="card-input card-title"
        />
      </div>
      
      {/* Description second */}
      <div className="form-group">
        <textarea
          placeholder="Enter description"
          value={newCardDescription}
          onChange={(e) => setNewCardDescription(e.target.value)}
          className="card-textarea"
          rows={4}
        />
      </div>
      
      {/* Type and Priority dropdowns */}
      <div className="form-row">
        <div className="form-group half">
          <label>Type</label>
          <select 
            value={newCardType} 
            onChange={(e) => setNewCardType(e.target.value as IssueType)}
            className="card-select"
          >
            {ISSUE_TYPES.map(type => (
              <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
            ))}
          </select>
        </div>

        <div className="form-group half">
          <label>Priority</label>
          <select 
            value={newCardPriority} 
            onChange={(e) => setNewCardPriority(e.target.value as Priority)}
            className="card-select"
          >
            {PRIORITIES.map(priority => (
              <option key={priority} value={priority}>
                {priority.charAt(0).toUpperCase() + priority.slice(1).replace('-', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Buttons */}
      <div className="card-form-actions">
        <button onClick={handleSaveCard} className="save-button">
          Add Card
        </button>
        <button onClick={handleCancelAdd} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default NewCard;
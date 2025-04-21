import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface BoardDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateBoard: (title: string) => void;
}

const BoardDialog: React.FC<BoardDialogProps> = ({ isOpen, onClose, onCreateBoard }) => {
  const [title, setTitle] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateBoard(title.trim());
      setTitle('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Create New Board</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="boardTitle">Board Title</label>
            <input
              id="boardTitle"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter board title"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="submit" className="primary-button">
              Create Board
            </button>
            <button type="button" onClick={onClose} className="secondary-button">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BoardDialog;

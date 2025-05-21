import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Board } from '../types';
import './BoardSharing.css';
import { useBoards } from '../hooks/useBoards';
import { useBoard } from '../hooks/useBoard';
interface BoardSharingProps {
  board: Board;
  boardId: string;
  onClose: () => void;
  updateBoardTitle: (newTitle: string) => void;
}

function BoardSharing({ board, boardId, onClose, updateBoardTitle }: BoardSharingProps) {
  const [email, setEmail] = useState('');
  const [sharedEmails, setSharedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [boardTitle, setBoardTitle] = useState('');
  const { user } = useAuth();

  const { setBoardAccess } = useBoards(user);

  useEffect(() => {
    setBoardTitle(board?.title || '');
    setSharedEmails(
      (board?.users || [])
        .map(user => user.email)
        .filter(email => email !== board.ownerEmail)
    );
  }, [board]);

  const handleAddEmail = () => {
    if (!email) return;
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (sharedEmails.includes(email)) {
      setError('This email is already added');
      return;
    }

    setSharedEmails([...sharedEmails, email]);
    setEmail('');
    setError('');
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setSharedEmails(sharedEmails.filter(e => e !== emailToRemove));
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBoardTitle(e.target.value);
    updateBoardTitle(e.target.value);
  };

  const handleShare = async () => {
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      await setBoardAccess(sharedEmails, user, boardId, boardTitle);
      onClose();
    } catch (error) {
      console.error("Error sharing board:", error);
      setError('Failed to share board. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="board-sharing-container" style={{ maxWidth: '400px', backgroundColor: 'black', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' }}>
      <h2>Share Board</h2>

      <div className="board-title-input">
        <label htmlFor="board-title">Board Title:</label>
        <input
          id="board-title"
          type="text"
          value={boardTitle}
          onChange={handleTitleChange}
          placeholder="Enter board title"
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '15px',
            borderRadius: '4px',
            border: '1px solid #444',
            backgroundColor: '#222',
            color: 'white'
          }}
        />
      </div>

      <div className="share-input-container">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email address"
          disabled={loading}
        />
        <button onClick={handleAddEmail} disabled={loading}>Add</button>
      </div>

      {error && <p className="error-message">{error}</p>}

      <div className="shared-list">
        <h3>Shared with:</h3>
        {!Array.isArray(sharedEmails) || sharedEmails.length === 0 ? (
          <p>This board is not shared with anyone yet.</p>
        ) : (
          <ul>
            {sharedEmails.map((email, index) => (
              <li key={index}>
                {email}
                <button
                  onClick={() => handleRemoveEmail(email)}
                  className="remove-button"
                  disabled={loading}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="action-buttons">
        <button onClick={onClose} disabled={loading}>Cancel</button>
        <button
          onClick={handleShare}
          className="share-button"
          disabled={loading}
        >
          {loading ? 'Sharing...' : 'Save Sharing Settings'}
        </button>
      </div>
    </div>
  );
}

export default BoardSharing;

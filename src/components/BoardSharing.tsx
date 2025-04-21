import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../hooks/useAuth';
import { BoardType } from '../types';
import './BoardSharing.css';

interface BoardSharingProps {
  board: BoardType;
  boardId: string;
  onClose: () => void;
  refreshBoard: () => void;
}

function BoardSharingComponent({ board, boardId, onClose, refreshBoard }: BoardSharingProps) {
  const [email, setEmail] = useState('');
  const [sharedEmails, setSharedEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [boardTitle, setBoardTitle] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    // Initialize board title and shared emails from props
    setBoardTitle(board?.title || '');
    
    if (Array.isArray(board?.shared)) {
      setSharedEmails(board.shared);
    } else if (board?.shared === true) {
      setSharedEmails([]);
    } else if (typeof board?.shared === 'string') {
      setSharedEmails([board.shared]);
    } else {
      setSharedEmails([]);
    }
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
  };

  const handleShare = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const boardRef = doc(db, "users", user.uid, "boards", boardId);
      
      // First, get the current state from Firestore
      const currentBoardSnap = await getDoc(boardRef);
      if (!currentBoardSnap.exists()) {
        throw new Error("Board not found");
      }
      
      // Get the previous shared list from Firestore
      const currentBoardData = currentBoardSnap.data();
      const actualPreviousShared = Array.isArray(currentBoardData.shared) ? 
                                 currentBoardData.shared : 
                                 (currentBoardData.shared ? [currentBoardData.shared] : []);
      
      // Update the ORIGINAL board in Firestore with new sharing list
      await updateDoc(boardRef, {
        title: boardTitle.trim(),
        shared: sharedEmails,
        lastUpdated: serverTimestamp()
      });
      
      // Check current status of all emails in the sharing list
      const emailStatuses = await Promise.all(
        sharedEmails.map(async (email) => {
          const normalizedEmail = email.toLowerCase();
          const sharedBoardRef = doc(db, "sharedBoards", normalizedEmail, "boards", boardId);
          
          try {
            const docSnap = await getDoc(sharedBoardRef);
            const exists = docSnap.exists();
            const data = exists ? docSnap.data() : null;
            const isActive = exists && data?.active !== false && data?.removed !== true;
            
            return {
              email,
              normalizedEmail,
              exists,
              isActive
            };
          } catch (err) {
            console.error(`Error checking status for ${email}:`, err);
            return {
              email,
              normalizedEmail,
              exists: false,
              isActive: false
            };
          }
        })
      );
      
      // Emails that need to be (re)shared: new emails + existing but inactive
      const emailsToShare = emailStatuses.filter(
        status => !status.exists || !status.isActive
      ).map(status => status.email);
      
      // Emails that need to be removed (in previous list but not in new list)
      const emailsToRemove = actualPreviousShared.filter(
        (email: string) => !sharedEmails.includes(email)
      );
      
      console.log(`Processing share operations: ${emailsToShare.length} shares, ${emailsToRemove.length} removals`);
      
      // Set up the sharing path - this is CRITICAL
      const originalBoardPath = `users/${user.uid}/boards/${boardId}`;
      
      // Handle adding/reactivating shares
      const addPromises = emailsToShare.map(async (email) => {
        if (email === user.email) return;
        
        const normalizedEmail = email.toLowerCase();
        const sharedBoardRef = doc(db, "sharedBoards", normalizedEmail, "boards", boardId);
        
        // IMPORTANT: The shared board entry should ONLY contain metadata, not actual board data
        const sharedBoardData = {
          originalBoardPath,  // This is the most important field - points to the real board
          ownerUid: user.uid,
          ownerEmail: user.email,
          ownerName: user.displayName || user.email,
          title: boardTitle.trim(),
          isShared: true,
          lastUpdated: serverTimestamp(),
          boardId,
          active: true,
          removed: false,
          createdAt: serverTimestamp(),
          visible: true,
          sharedOn: serverTimestamp(),
          recipientEmail: email
        };
        
        try {
          await setDoc(sharedBoardRef, sharedBoardData, { merge: true });
          console.log(`✅ Successfully shared with ${normalizedEmail}`);
          return true;
        } catch (err) {
          console.error(`❌ Error sharing with ${normalizedEmail}:`, err);
          return false;
        }
      });
      
      // Handle removing shares
      const removePromises = emailsToRemove.map(async (email: string) => {
        const normalizedEmail = email.toLowerCase();
        const removedBoardRef = doc(db, "sharedBoards", normalizedEmail, "boards", boardId);
        
        return updateDoc(removedBoardRef, {
          removed: true,
          active: false,
          visible: false,
          lastUpdated: serverTimestamp()
        });
      });
      
      // Execute all operations
      await Promise.all([...addPromises, ...removePromises]);
      
      // Refresh board data and close dialog
      refreshBoard();
      onClose();
    } catch (error) {
      console.error("Error sharing board:", error);
      setError('Failed to share board. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="board-sharing-container" style={{maxWidth: '400px', backgroundColor: 'black', borderRadius: '10px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'}}>
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

export default BoardSharingComponent;

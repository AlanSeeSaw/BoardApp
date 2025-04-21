import { useCallback } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { initialBoard } from '../constants/initialBoard';
import { BoardType, User } from '../types';

export const useBoardManagement = (
  user: User | null,
  availableBoards: any[],
  currentBoardId: string,
  setIsBoardDialogOpen: React.Dispatch<React.SetStateAction<boolean>>,
  refreshBoards: (boards: any[]) => void,
  selectBoard: (boardId: string) => void
) => {
  // Create a new board
  const handleCreateBoard = useCallback(async (title: string) => {
    if (!user) return;

    try {
      const boardsRef = collection(db, "users", user.uid, "boards");
      const newBoardId = uuidv4();
      const newBoard = {
        ...initialBoard,
        id: newBoardId,
        title,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        clientTimestamp: Date.now()
      };

      await setDoc(doc(boardsRef, newBoardId), newBoard);
      
      const boardMetadata = {
        id: newBoardId,
        title,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      // Instead of directly setting state, call the refreshBoards function
      refreshBoards([...availableBoards, boardMetadata]);
      
      // Use the selectBoard function to set the current board
      selectBoard(newBoardId);
      
      setIsBoardDialogOpen(false);
    } catch (error) {
      alert("Failed to create board. Please try again.");
    }
  }, [user, availableBoards, refreshBoards, selectBoard, setIsBoardDialogOpen]);

  // Update board in Firebase
  const updateBoardInFirebase = useCallback((updatedBoard: BoardType, setBoard: any, saveBoard: any) => {
    // Set the board with the updates - this will trigger the useSaveBoard hook
    setBoard(updatedBoard);
    
    // If you want to force an immediate save instead of waiting for the automatic save
    if (saveBoard) {
      // Call saveBoard without parameters - it will use the latest board state
      saveBoard();
    }
  }, []);

  return {
    handleCreateBoard,
    updateBoardInFirebase
  };
}; 
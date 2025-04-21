import { useState, useCallback, useEffect } from 'react';
import { collection, getDocs, getDoc, doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { BoardMetadata, User } from '../types';

export const useBoardSharing = (user: User | null) => {
  const [availableBoards, setAvailableBoards] = useState<BoardMetadata[]>([]);
  const [isSharedBoard, setIsSharedBoard] = useState(false);
  const [currentBoardId, setCurrentBoardId] = useState<string>('');

  // Listen for real-time shared board updates
  useEffect(() => {
    if (!user || !user.email) return;
    
    // Important: Normalize email to lowercase
    const normalizedEmail = user.email.toLowerCase();
    
    // Listen for shared boards in Firestore
    const sharedBoardsRef = collection(db, "sharedBoards", normalizedEmail, "boards");
    
    const unsubscribe = onSnapshot(
      sharedBoardsRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        // Process shared boards and add them to available boards
        const sharedBoards: BoardMetadata[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          
          const isRemoved = data.removed === true;
          const isActive = data.active !== false;
          
          if (!isRemoved && isActive) {
            sharedBoards.push({
              id: doc.id,
              title: data.title,
              createdAt: data.createdAt instanceof Timestamp ? 
                data.createdAt.toDate() : 
                new Date(data.createdAt || Date.now()),
              updatedAt: data.lastUpdated instanceof Timestamp ? 
                data.lastUpdated.toDate() : 
                new Date(data.lastUpdated || Date.now()),
              isShared: true,
              ownerUid: data.ownerUid,
              ownerEmail: data.ownerEmail || 'Unknown',
              ownerName: data.ownerName || data.ownerEmail || 'Unknown',
              originalBoardPath: data.originalBoardPath
            });
          }
        });
        
        // Update available boards
        setAvailableBoards(prevBoards => {
          // First remove any existing shared boards
          const ownedBoards = prevBoards.filter(board => !board.isShared);
          
          // Deduplicate boards by ID - shared boards take precedence
          const uniqueBoards = [];
          const boardIds = new Set();
          
          // First add all shared boards
          for (const board of sharedBoards) {
            boardIds.add(board.id);
            uniqueBoards.push(board);
          }
          
          // Then add owned boards that don't have the same ID as a shared board
          for (const board of ownedBoards) {
            if (!boardIds.has(board.id)) {
              boardIds.add(board.id);
              uniqueBoards.push(board);
            }
          }
          
          return uniqueBoards;
        });
      }
    );
    
    return () => unsubscribe();
  }, [user]);

  // Fetch user's own boards
  const fetchBoards = useCallback(async () => {
    if (!user) return;
    
    try {
      // Simpler approach to track boards
      const boards: BoardMetadata[] = [];
      
      // Fetch user's own boards
      const boardsRef = collection(db, "users", user.uid, "boards");
      const boardsSnap = await getDocs(boardsRef);
      
      boardsSnap.forEach((doc) => {
        const data = doc.data();
        // Check if this board ID is already in the boards array
        if (!boards.some(b => b.id === doc.id)) {
          boards.push({
            id: doc.id,
            title: data.title,
            createdAt: data.createdAt instanceof Timestamp ? 
              data.createdAt.toDate() : 
              new Date(data.createdAt || Date.now()),
            updatedAt: data.updatedAt instanceof Timestamp ? 
              data.updatedAt.toDate() : 
              new Date(data.updatedAt || Date.now()),
          });
        }
      });
      
      // For initial load, we directly fetch shared boards
      if (user.email) {
        try {
          // CRITICAL FIX: Normalize email to lowercase
          const normalizedEmail = user.email.toLowerCase();
          const sharedBoardsRef = collection(db, "sharedBoards", normalizedEmail, "boards");
          const sharedBoardsSnap = await getDocs(sharedBoardsRef);
          
          sharedBoardsSnap.forEach((doc) => {
            const data = doc.data();
            
            // IMPORTANT: For newly shared boards, default to active unless explicitly removed
            const isActive = data.active !== false; // Consider undefined as active
            const isRemoved = data.removed === true; // Only true if explicitly set
            
            // Only include shared boards that haven't been removed and are active
            if (data && !isRemoved && isActive) {
              // Create the board metadata
              const sharedBoard: BoardMetadata = {
                id: doc.id,
                title: data.title,
                createdAt: data.createdAt instanceof Timestamp ? 
                  data.createdAt.toDate() : 
                  new Date(data.createdAt || Date.now()),
                updatedAt: data.lastUpdated instanceof Timestamp ? 
                  data.lastUpdated.toDate() : 
                  new Date(data.lastUpdated || Date.now()),
                isShared: true,
                ownerUid: data.ownerUid,
                ownerEmail: data.ownerEmail || 'Unknown',
                ownerName: data.ownerName || data.ownerEmail || 'Unknown',
                originalBoardPath: data.originalBoardPath
              };
              
              // Add to boards array
              boards.push(sharedBoard);
            }
          });
        } catch (error) {
          // Error handling without logging
        }
      }
      
      setAvailableBoards(boards);
      
      // Only set first board as current if none selected AND this is the first load
      if (!currentBoardId && boards.length > 0) {
        const firstBoard = boards[0];
        setCurrentBoardId(firstBoard.id);
        setIsSharedBoard(!!firstBoard.isShared);
      }
    } catch (error) {
      // Error handling without logging
    }
  }, [user, currentBoardId]);

  // Handle board selection
  const handleBoardSelection = useCallback((boardId: string) => {
    if (!boardId) {
      setCurrentBoardId('');
      setIsSharedBoard(false);
      return;
    }
    
    // Check if this is a shared board by looking it up in availableBoards
    const selectedBoard = availableBoards.find(board => board.id === boardId);
    const isShared = selectedBoard?.isShared || false;
    
    // Store shared board info in localStorage for reference
    if (isShared && selectedBoard) {
      try {
        const sharedInfoKey = `shared-board-info-${boardId}`;
        localStorage.setItem(sharedInfoKey, JSON.stringify({
          ownerEmail: selectedBoard.ownerEmail,
          ownerName: selectedBoard.ownerName,
          ownerUid: selectedBoard.ownerUid,
          originalBoardPath: selectedBoard.originalBoardPath
        }));
      } catch (e) {
        // Error handling without logging
      }
    }
    
    // Set both the ID and the shared status
    setCurrentBoardId(boardId);
    setIsSharedBoard(isShared);
    
    // IMPORTANT: Only clear cached paths for shared boards
    if (isShared) {
      localStorage.removeItem(`original-board-path-${boardId}`);
    }
  }, [availableBoards]);

  // Debug function to check shared boards
  const debugCheckSharedBoards = useCallback(async () => {
    if (!user?.email) return;
    
    try {
      // CRITICAL FIX: Normalize email to lowercase
      const normalizedEmail = user.email.toLowerCase();
      
      // Check both normalized and raw paths
      const paths = [
        {type: "normalized", path: `sharedBoards/${normalizedEmail}/boards`},
        {type: "non-normalized", path: `sharedBoards/${user.email}/boards`}
      ];
      
      for (const {type, path} of paths) {
        try {
          const sharedBoardsRef = collection(db, path);
          const snapshot = await getDocs(sharedBoardsRef);
          
          snapshot.forEach(doc => {
            // Process documents but remove the logging
            const data = doc.data();
          });
        } catch (e) {
          // Error handling without logging
        }
      }
      
      // Check parent collection existence
      try {
        const sharedBoardsCollectionRef = collection(db, "sharedBoards");
        const collectionSnapshot = await getDocs(sharedBoardsCollectionRef);
        
        collectionSnapshot.forEach(doc => {
          // Process documents but remove the logging
        });
      } catch (e) {
        // Error handling without logging
      }
    } catch (error) {
      // Error handling without logging
    }
  }, [user]);

  // Refresh board data
  const refreshBoard = useCallback(async (board: any, setBoard: any) => {
    if (!user || !currentBoardId) return;
    
    try {
      // Re-fetch the current board to update sharing info
      const boardRef = doc(db, "users", user.uid, "boards", currentBoardId);
      const boardSnap = await getDoc(boardRef);
      
      if (boardSnap.exists()) {
        const data = boardSnap.data();
        // Process timestamps similar to useBoard hook
        const processedData = {
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? 
            data.createdAt.toDate() : 
            new Date(data.createdAt || Date.now()),
          updatedAt: data.updatedAt instanceof Timestamp ? 
            data.updatedAt.toDate() : 
            new Date(data.updatedAt || Date.now()),
          // Add shared to the processedData type
          shared: data.shared || [],
          // Explicitly include title from the original data
          title: data.title
        };
        
        // Update board state
        setBoard((prev: any) => ({
          ...prev,
          shared: processedData.shared || [],
          title: processedData.title || prev.title
        }));
        
        // ALSO update the board title in the availableBoards state
        setAvailableBoards(prev => 
          prev.map(board => 
            board.id === currentBoardId 
              ? { ...board, title: processedData.title || board.title }
              : board
          )
        );
      }
    } catch (error) {
      // Error handling without logging
    }
  }, [user, currentBoardId]);

  // Force refresh shared board data
  const forceRefreshSharedBoard = useCallback(async (board: any, setBoard: any) => {
    if (!user || !currentBoardId || !isSharedBoard) return;
    
    try {
      console.log("Force refreshing shared board data...");
      // Re-fetch the current board to get the latest data
      await refreshBoard(board, setBoard);
      
      // Force reload the board from Firebase
      if (setBoard && board) {
        // Update lastMoveTimestamp to trigger immediate save
        setBoard((prev: any) => ({
          ...prev,
          lastMoveTimestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error("Error refreshing shared board:", error);
    }
  }, [user, currentBoardId, isSharedBoard, refreshBoard]);

  return {
    availableBoards,
    isSharedBoard,
    currentBoardId,
    fetchBoards,
    handleBoardSelection,
    debugCheckSharedBoards,
    refreshBoard,
    forceRefreshSharedBoard,
    setCurrentBoardId,
    setIsSharedBoard
  };
}; 
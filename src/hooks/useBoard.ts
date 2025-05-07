import { useState, useEffect, useCallback, useRef } from 'react';
import { doc, setDoc, onSnapshot, Timestamp, getDoc, updateDoc, serverTimestamp, DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';
import { BoardType, CardType, ColumnType, User, Activity } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { initialBoard } from '../constants/initialBoard';
import { initializeCardTracking, fixInvalidTimeTracking } from '../utils/CardMovement';

// Type-safe function to process timestamps from Firebase
const processTimestamps = (data: any): BoardType => {
  if (!data) return initialBoard;

  // Create a normalized board structure with proper types
  const normalizedBoard: BoardType = {
    ...data,
    id: data.id || uuidv4(),
    title: data.title,
    ownerId: data.ownerId || '',
    cards: {},
    columns: [],
    expediteLaneCardIds: data.expediteLaneCardIds || [],
    archivedCardIds: data.archivedCardIds || [],
    activities: data.activities || [],
    users: data.users || [],
    shared: data.shared || []
  };

  // Process cards with proper typing
  if (data.cards && typeof data.cards === 'object') {
    Object.entries(data.cards).forEach(([cardId, cardData]) => {
      if (cardData) {
        const card = cardData as any;

        // Improved due date handling
        let processedDueDate = undefined;
        if (card.dueDate) {
          try {
            // Convert to Date object
            const dateObj = convertTimestamp(card.dueDate);
            // Validate the date is valid before using it
            if (!isNaN(dateObj.getTime())) {
              processedDueDate = dateObj;
            }
          } catch (e) {
            console.error(`Error processing due date for card ${cardId}:`, e);
          }
        }

        // Improved movement history handling
        let processedMovementHistory = [];
        if (Array.isArray(card.movementHistory) && card.movementHistory.length > 0) {
          processedMovementHistory = card.movementHistory.map((movement: any) => {
            // Make sure all required fields are present
            if (!movement.cardId || !movement.fromColumnId || !movement.toColumnId) {
              console.warn('Invalid movement record found:', movement);
              return null;
            }

            // Normalize dates in the movement record
            return {
              cardId: movement.cardId || cardId,
              fromColumnId: movement.fromColumnId,
              toColumnId: movement.toColumnId,
              movedAt: movement.movedAt ? new Date(movement.movedAt) : new Date(),
              movedBy: movement.movedBy || 'unknown'
            };
          }).filter(Boolean); // Remove any null entries
        }

        normalizedBoard.cards[cardId] = {
          id: cardId,
          title: card.title || '',
          description: card.description || '',
          priority: card.priority || 'normal',
          type: card.type || 'task',
          created: convertTimestamp(card.createdAt || card.created),
          updated: convertTimestamp(card.updatedAt || card.updated),
          dueDate: processedDueDate, // Use our processed date
          assignedUsers: Array.isArray(card.assignedUsers) ? card.assignedUsers : [],
          labels: card.labels || [],
          checklist: Array.isArray(card.checklist) ? card.checklist.map((item: any) => ({
            id: item.id || uuidv4(),
            text: item.text || '',
            completed: Boolean(item.completed || item.checked)
          })) : [],
          currentColumnId: card.currentColumnId || '',
          movementHistory: processedMovementHistory,
          timeInColumns: Array.isArray(card.timeInColumns) ? card.timeInColumns : []
        };
      }
    });
  }

  // Process columns with proper typing
  if (Array.isArray(data.columns)) {
    normalizedBoard.columns = data.columns.map((col: any): ColumnType => ({
      id: col.id || uuidv4(),
      title: col.title || '',
      cardIds: Array.isArray(col.cardIds) ? [...col.cardIds] : [],
      wipLimit: typeof col.wipLimit === 'number' ? col.wipLimit : 0,
      isCollapsed: Boolean(col.isCollapsed),
      category: col.category
    }));
  }

  // Process activities with proper typing
  if (Array.isArray(data.activities)) {
    normalizedBoard.activities = data.activities.map((activity: any): Activity => ({
      id: activity?.id || uuidv4(),
      cardId: activity?.cardId || "",
      action: activity?.action || "",
      timestamp: convertTimestamp(activity.timestamp)
    }));
  }

  // Initialize tracking and fix any invalid data
  const boardWithCardTracking = initializeCardTracking(normalizedBoard);

  // Fix invalid timeInColumns entries
  const boardWithFixedTimeTracking = fixInvalidTimeTracking(boardWithCardTracking);

  return boardWithFixedTimeTracking;
};

// Helper function to safely convert Firebase timestamps or date strings to Date objects
function convertTimestamp(value: any): Date {
  if (!value) return new Date();

  try {
    if (value instanceof Timestamp) {
      return value.toDate();
    } else if (value instanceof Date) {
      return value;
    } else if (typeof value === 'string') {
      // Handle ISO strings and other date formats
      const dateObj = new Date(value);
      if (!isNaN(dateObj.getTime())) {
        return dateObj;
      }
    } else if (typeof value === 'number') {
      // Handle timestamps as numbers
      const dateObj = new Date(value);
      if (!isNaN(dateObj.getTime())) {
        return dateObj;
      }
    } else if (value && typeof value === 'object' && 'seconds' in value) {
      // Handle Firestore timestamp objects
      return new Date(value.seconds * 1000);
    }
  } catch (e) {
    console.error("Error converting timestamp:", e);
  }

  return new Date();
}

// Type-safe function to prepare board data for Firebase
const prepareForFirebase = (board: BoardType): Record<string, any> => {
  // Create a deep copy to avoid modifying the original
  const prepared = JSON.parse(JSON.stringify(board));

  // Remove any undefined values
  Object.keys(prepared).forEach(key => {
    if (prepared[key] === undefined) {
      delete prepared[key];
    }
  });

  // Ensure all card properties are explicitly included
  if (prepared.cards) {
    Object.keys(prepared.cards).forEach(cardId => {
      const card = prepared.cards[cardId];
      if (card) {
        // Ensure priority is explicitly included
        prepared.cards[cardId].priority = card.priority || 'normal';

        // Ensure expedite status is explicit
        prepared.cards[cardId].expedite = !!card.expedite;

        // Normalize dueDate to consistent format if it exists
        if (card.dueDate) {
          try {
            // Convert to Date object first to ensure consistency
            const dateObj = card.dueDate instanceof Date ?
              card.dueDate : new Date(card.dueDate);

            // Only store if it's a valid date
            if (!isNaN(dateObj.getTime())) {
              // Store as ISO string for consistent comparison
              prepared.cards[cardId].dueDate = dateObj.toISOString();
            } else {
              // If invalid, remove it
              delete prepared.cards[cardId].dueDate;
            }
          } catch (e) {
            console.error(`Error preparing due date for card ${cardId}:`, e);
            delete prepared.cards[cardId].dueDate;
          }
        } else {
          // Explicitly set to null if not present
          prepared.cards[cardId].dueDate = null;
        }
      }
    });
  }

  return prepared;
};

// Get board document reference with proper error handling
async function getBoardDocRef(
  user: User,
  boardId: string,
  isShared: boolean = false
): Promise<DocumentReference> {
  if (isShared) {
    // For shared boards
    const cacheKey = `original-board-path-${boardId}`;
    const cachedPath = localStorage.getItem(cacheKey);

    if (cachedPath) {
      return doc(db, cachedPath);
    }

    // Get the original path from shared metadata
    if (!user.email) {
      throw new Error("User email required for shared board");
    }

    const normalizedEmail = user.email.toLowerCase();
    const sharedMetaRef = doc(db, "sharedBoards", normalizedEmail, "boards", boardId);
    const sharedMetaSnap = await getDoc(sharedMetaRef);

    if (!sharedMetaSnap.exists()) {
      throw new Error("Shared board not found");
    }

    const originalPath = sharedMetaSnap.data().originalBoardPath;
    if (!originalPath) {
      throw new Error("Original path not found");
    }

    localStorage.setItem(cacheKey, originalPath);
    return doc(db, originalPath);
  }

  // Normal board
  if (!user.uid) {
    throw new Error("User ID required");
  }

  return doc(db, `users/${user.uid}/boards/${boardId}`);
}

export const useBoard = (user: User | null, boardId?: string, isShared?: boolean) => {
  const [board, setBoard] = useState<BoardType>(() => {
    try {
      const savedBoard = localStorage.getItem('kanban-board');
      if (savedBoard) {
        const parsedBoard = JSON.parse(savedBoard);
        if (parsedBoard && Array.isArray(parsedBoard.columns)) {
          return parsedBoard as BoardType;
        }
      }
    }
    catch (e) {
      console.error("Error loading from localStorage:", e);
    }
    return initialBoard;
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to track latest values
  const lastMoveTimestampRef = useRef<number>(0);
  const ignoreFirebaseUpdatesRef = useRef<boolean>(false);

  // Save to localStorage whenever board changes
  useEffect(() => {
    try {
      localStorage.setItem('kanban-board', JSON.stringify(board));
    } catch (e) {
      console.error("Error saving to localStorage:", e);
    }
  }, [board]);

  // Save board to Firebase
  const saveToFirebase = useCallback(async (forceSave: boolean = false) => {
    if (!user || !boardId) return;

    try {
      const boardDocRef = await getBoardDocRef(user, boardId, isShared === true);

      // Prepare data for Firebase
      const boardData = prepareForFirebase(board);
      boardData.updatedAt = serverTimestamp();
      boardData.lastEditedByEmail = user.email;
      boardData.lastEditedById = user.uid;

      // If force save, use setDoc, otherwise use updateDoc
      if (forceSave) {
        await setDoc(boardDocRef, boardData, { merge: true });
      } else {
        await updateDoc(boardDocRef, boardData);
      }

      console.log("Board saved to Firebase");
    } catch (error) {
      console.error("Error saving board to Firebase:", error);
      setError((error as Error).message);
    }
  }, [board, boardId, user, isShared]);

  // Load board from Firestore
  useEffect(() => {
    if (!boardId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadBoard = async () => {
      try {
        const boardDocRef = await getBoardDocRef(user, boardId, isShared === true);

        // Set up snapshot listener
        return onSnapshot(boardDocRef, (docSnap) => {
          if (docSnap.exists() && !ignoreFirebaseUpdatesRef.current) {
            const boardData = docSnap.data();

            // For shared boards, ensure we get the complete data
            if (isShared) {
              console.log("Loading shared board data:", {
                cardCount: boardData.cards ? Object.keys(boardData.cards).length : 0,
                columnCount: boardData.columns ? boardData.columns.length : 0
              });
            }

            const processedBoard = processTimestamps(boardData);

            // NEW: Ensure current user is in the users collection
            if (!processedBoard.users) {
              processedBoard.users = [];
            }

            // Add current user if not already in the list
            if (user.email && !processedBoard.users.some(u =>
              u.id === user.uid || u.email === user.email)) {
              processedBoard.users.push({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email || '',
                id: user.uid,
                name: user.displayName || user.email || ''
              });
            }

            // Don't override local state if we just made a move
            const now = Date.now();
            if (now - lastMoveTimestampRef.current < 3000) {
              console.log("Ignoring Firebase update because we just moved a card locally");
              return;
            }

            // Update board state with complete data
            setBoard(processedBoard);
          } else if (!docSnap.exists()) {
            // Create new board if it doesn't exist
            const newBoard: BoardType = {
              ...initialBoard,
              id: boardId,
              ownerId: user.uid,
              ownerEmail: user.email,
              ownerName: user.displayName || user.email,
              users: []
            };

            const boardToSave = {
              ...prepareForFirebase(newBoard),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            };

            setDoc(boardDocRef, boardToSave)
              .then(() => setBoard(newBoard))
              .catch(error => {
                console.error("Error creating board:", error);
                setError((error as Error).message);
              });
          }

          setLoading(false);
        });
      } catch (error) {
        console.error("Error loading board:", error);
        setError((error as Error).message);
        setLoading(false);
        return () => { };
      }
    };

    const unsubscribePromise = loadBoard();
    return () => {
      unsubscribePromise.then(unsub => unsub && unsub());
    };
  }, [boardId, user, isShared]);

  // Helper to get a card by ID with type safety
  const getCardById = useCallback((cardId: string): CardType | undefined => {
    return board.cards[cardId];
  }, [board.cards]);

  // Add a new card to a column
  const addCard = useCallback((columnId: string, card: CardType) => {
    setBoard(prev => {
      // Add card to cards map
      const updatedCards = {
        ...prev.cards,
        [card.id]: card
      };

      // Add card ID to the appropriate column
      const updatedColumns = prev.columns.map(col => {
        if (col.id === columnId) {
          return {
            ...col,
            cardIds: [...col.cardIds, card.id]
          };
        }
        return col;
      });

      return {
        ...prev,
        cards: updatedCards,
        columns: updatedColumns
      };
    });

    // Save to Firebase
    setTimeout(() => saveToFirebase(), 100);
  }, [saveToFirebase]);

  // Update a card with type safety - simplified
  const updateCard = useCallback((cardId: string, updates: Partial<CardType>) => {
    setBoard(prev => {
      if (!prev.cards[cardId]) return prev;

      // Create a copy of the card
      const updatedCard = {
        ...prev.cards[cardId],
        ...updates,
        updated: new Date()
      };

      // Normalize dueDate if it exists and changed
      if (updates.dueDate !== undefined) {
        try {
          if (updates.dueDate === null) {
            // Handle null case explicitly
            updatedCard.dueDate = null;
          } else {
            // Convert to Date object for consistency
            const dateObj = updates.dueDate instanceof Date ?
              updates.dueDate : new Date(updates.dueDate);

            // Only store if it's a valid date
            if (!isNaN(dateObj.getTime())) {
              updatedCard.dueDate = dateObj;
            } else {
              // If invalid, set to null
              updatedCard.dueDate = null;
            }
          }
        } catch (e) {
          updatedCard.dueDate = null;
        }
      }

      // Create a new board with the updated card
      const newBoard = {
        ...prev,
        cards: {
          ...prev.cards,
          [cardId]: updatedCard
        },
        // Add a timestamp to force re-renders
        clientTimestamp: Date.now()
      };

      // If priority changed, update the lastMoveTimestamp to trigger immediate save
      if (updates.priority !== undefined) {
        newBoard.lastMoveTimestamp = Date.now();
      }

      // Dispatch an event to notify components of the update
      if (typeof window !== 'undefined') {
        const updateEvent = new CustomEvent('card-directly-updated', {
          detail: {
            cardId: cardId,
            updatedCard: updatedCard
          }
        });
        window.dispatchEvent(updateEvent);

        // Also dispatch a force update event
        const forceEvent = new CustomEvent('force-card-update', {
          detail: { cardId: cardId }
        });
        window.dispatchEvent(forceEvent);
      }

      return newBoard;
    });

    // For priority changes, save immediately with no debounce
    if (updates.priority !== undefined) {
      saveToFirebase(true);
    } else {
      // Save to Firebase with normal debounce
      setTimeout(() => saveToFirebase(), 100);
    }
  }, [saveToFirebase]);

  // NOT IMPLEMENTED
  // Delete a card with type safety
  const deleteCard = useCallback((cardId: string) => {
    setBoard(prev => {
      // Skip if card doesn't exist
      if (!prev.cards[cardId]) return prev;

      // Create a copy of cards without the deleted one
      const { [cardId]: deletedCard, ...remainingCards } = prev.cards;

      // Remove card ID from all columns
      const updatedColumns = prev.columns.map(col => ({
        ...col,
        cardIds: col.cardIds.filter(id => id !== cardId)
      }));

      return {
        ...prev,
        cards: remainingCards,
        columns: updatedColumns,
        archivedCardIds: prev.archivedCardIds.filter(id => id !== cardId)
      };
    });

    // Save to Firebase
    setTimeout(() => saveToFirebase(), 100);
  }, [saveToFirebase]);

  // Add a new column with type safety
  const addColumn = useCallback((title: string) => {
    setBoard(prev => {
      const newColumn: ColumnType = {
        id: uuidv4(),
        title,
        cardIds: [],
        wipLimit: 0,
        isCollapsed: false
      };

      return {
        ...prev,
        columns: [...prev.columns, newColumn]
      };
    });

    // Save to Firebase
    setTimeout(() => saveToFirebase(), 100);
  }, [saveToFirebase]);

  // Move a card between columns - simplified
  const moveCard = useCallback((
    cardId: string,
    sourceColumnId: string,
    destinationColumnId: string
  ) => {
    if (!destinationColumnId) return;

    // Check if this is an expedite operation
    const isToExpedite = destinationColumnId === 'expedite';

    // Update the last move timestamp
    lastMoveTimestampRef.current = Date.now();

    // Temporarily ignore Firebase updates
    ignoreFirebaseUpdatesRef.current = true;

    // Clear the ignore flag after a delay
    setTimeout(() => {
      ignoreFirebaseUpdatesRef.current = false;
    }, 3000);

    setBoard(prev => {
      // Create a deep clone to avoid reference issues
      const newBoard = JSON.parse(JSON.stringify(prev)) as BoardType;

      // Make sure we have the card in our collection
      const card = newBoard.cards[cardId];

      if (card) {
        // Update priority to emergency when moving to expedite
        if (isToExpedite) {
          card.priority = 'emergency';
        }

        card.updated = new Date();
      }

      // Remove card from all columns first
      newBoard.columns = newBoard.columns.map(column => ({
        ...column,
        cardIds: column.cardIds.filter(id => id !== cardId)
      }));

      // Remove from archive
      newBoard.archivedCardIds = newBoard.archivedCardIds.filter(id => id !== cardId);

      // Add to destination
      if (destinationColumnId === 'expedite') {
        // Mark the card as emergency priority
        if (card) {
          card.priority = 'emergency';
        }
        // Add to first column
        const firstColumn = newBoard.columns[0];
        if (firstColumn) {
          firstColumn.cardIds.push(cardId);
        }
      }
      else if (destinationColumnId === 'archive') {
        newBoard.archivedCardIds.push(cardId);
      }
      else {
        // Add to regular column
        const destColumn = newBoard.columns.find(col => col.id === destinationColumnId);
        if (destColumn) {
          destColumn.cardIds.push(cardId);
        }
      }

      // Ensure lastMoveTimestamp is updated
      return {
        ...newBoard,
        lastMoveTimestamp: Date.now()
      };
    });

    // Force immediate save for expedite operations
    if (isToExpedite) {
      saveToFirebase(true);
    } else {
      // Regular save for other moves
      setTimeout(() => saveToFirebase(true), 100);
    }
  }, [saveToFirebase]);

  // Force save before page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem('kanban-board', JSON.stringify(board));

        // Only attempt Firebase save if we have a board ID and user
        if (boardId && user && !loading) {
          saveToFirebase(true).catch(e => console.error("Error in emergency save:", e));
        }
      } catch (e) {
        console.error("Error in beforeunload handler:", e);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [board, boardId, user, loading, saveToFirebase]);

  // Add debug logging after loading data from Firebase
  useEffect(() => {
    if (board && board.cards) {
      // Check if cards have movement history after loading
      Object.values(board.cards).forEach(card => {
        if (card.movementHistory && card.movementHistory.length > 0) {
          //console.log(`Loaded card ${card.id} with ${card.movementHistory.length} movements:`, 
          //JSON.stringify(card.movementHistory));
        }
      });
    }
  }, [board]);

  // Listen for board-saved events to force UI updates
  useEffect(() => {
    const handleBoardSaved = (event: CustomEvent) => {
      if (event.detail.boardId === boardId) {
        console.log("Board saved event received, forcing UI update");
        // Force a board update with a new timestamp
        setBoard(prevBoard => ({
          ...prevBoard,
          clientTimestamp: Date.now()
        }));
      }
    };

    // Listen for card update events
    const handleCardUpdated = (event: CustomEvent) => {
      if (event.detail.cardId && event.detail.updatedCard) {
        console.log(`Card update event received for ${event.detail.cardId}, updating board state`);
        setBoard(prevBoard => {
          // Only update if the card exists in our board
          if (!prevBoard.cards[event.detail.cardId]) return prevBoard;

          // Create a new board object to ensure React detects the change
          const newBoard = {
            ...prevBoard,
            cards: {
              ...prevBoard.cards,
              [event.detail.cardId]: {
                ...event.detail.updatedCard,
                updated: new Date()
              }
            },
            clientTimestamp: Date.now()
          };

          return newBoard;
        });
      }
    };

    // Handle final card updates (just before modal closes)
    const handleFinalCardUpdate = (event: CustomEvent) => {
      if (event.detail.cardId && event.detail.updatedCard) {
        console.log(`Final card update event received for ${event.detail.cardId}`);

        // Force a complete board refresh
        setBoard(prevBoard => {
          const newBoard = JSON.parse(JSON.stringify(prevBoard));

          // Update the specific card
          if (newBoard.cards[event.detail.cardId]) {
            newBoard.cards[event.detail.cardId] = {
              ...event.detail.updatedCard,
              updated: new Date()
            };
          }

          // Force timestamp update
          newBoard.clientTimestamp = event.detail.timestamp || Date.now();

          return newBoard;
        });
      }
    };

    // Handle force board rerender events
    const handleForceBoardRerender = (event: CustomEvent) => {
      console.log("Force board rerender event received");
      setBoard(prevBoard => ({
        ...prevBoard,
        clientTimestamp: event.detail.timestamp || Date.now()
      }));
    };

    // Add a handler for complete UI refresh
    const handleCompleteUIRefresh = () => {
      console.log("Complete UI refresh requested");

      // Force a complete board refresh with a new object reference
      setBoard(prevBoard => {
        // Create a completely new board object
        const newBoard = JSON.parse(JSON.stringify(prevBoard));

        // Add a unique timestamp
        newBoard.clientTimestamp = Date.now() + Math.random();

        return newBoard;
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('board-saved', handleBoardSaved as EventListener);
      window.addEventListener('card-directly-updated', handleCardUpdated as EventListener);
      window.addEventListener('final-card-update', handleFinalCardUpdate as EventListener);
      window.addEventListener('force-board-rerender', handleForceBoardRerender as EventListener);
      window.addEventListener('complete-ui-refresh', handleCompleteUIRefresh as EventListener);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('board-saved', handleBoardSaved as EventListener);
        window.removeEventListener('card-directly-updated', handleCardUpdated as EventListener);
        window.removeEventListener('final-card-update', handleFinalCardUpdate as EventListener);
        window.removeEventListener('force-board-rerender', handleForceBoardRerender as EventListener);
        window.removeEventListener('complete-ui-refresh', handleCompleteUIRefresh as EventListener);
      }
    };
  }, [boardId]);

  return {
    board,
    setBoard,
    loading,
    error,
    moveCard,
    addCard,
    updateCard,
    deleteCard,
    getCardById,
    addColumn,
    saveToFirebase: () => saveToFirebase()
  };
};
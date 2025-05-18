import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, setDoc, serverTimestamp, getDoc, DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';
import { BoardType, CardType, ColumnType, User } from '../types';
import { findUndefinedValues } from '../utils/debugging';
import { fixInvalidTimeTracking } from '../utils/CardMovement';
import { forceCompleteUIRefresh } from '../context/ModalContext';

// Before sending to Firebase, clean all data
export function deepCleanForFirebase(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deepCleanForFirebase(item)).filter(item => item !== undefined);
  }

  const cleanedObj: any = {};
  Object.keys(obj).forEach(key => {
    const value = deepCleanForFirebase(obj[key]);
    if (value !== undefined) {
      cleanedObj[key] = value;
    }
  });

  return cleanedObj;
}

// Then use this in sanitizeForFirebase
function sanitizeForFirebase<T>(data: T): any {
  // Create a deep copy to avoid modifying the original
  const prepared = JSON.parse(JSON.stringify(data));

  // If it's a complete board
  if (prepared && typeof prepared === 'object' && 'cards' in prepared) {
    // Process board.cards
    const board = prepared as any;
    if (board.cards) {
      Object.keys(board.cards).forEach(cardId => {
        const card = board.cards[cardId];
        if (card) {
          // Process movement history
          if (Array.isArray(card.movementHistory)) {
            card.movementHistory = card.movementHistory
              .filter((movement: any) =>
                movement && movement.cardId && movement.fromColumnId && movement.toColumnId)
              .map((movement: any) => {
                // Ensure each movement has all required fields and proper date format
                const sanitizedMovement = {
                  cardId: movement.cardId,
                  fromColumnId: movement.fromColumnId,
                  toColumnId: movement.toColumnId,
                  movedBy: movement.movedBy || 'unknown',
                  // Always convert dates to ISO strings
                  movedAt: movement.movedAt instanceof Date ?
                    movement.movedAt.toISOString() :
                    (typeof movement.movedAt === 'string' ? movement.movedAt : new Date().toISOString())
                };

                return sanitizedMovement;
              });
          } else {
            card.movementHistory = [];
          }

          // Process timeInColumns
          if (Array.isArray(card.timeInColumns)) {
            card.timeInColumns = card.timeInColumns.map((entry: any) => ({
              ...entry,
              enteredAt: entry.enteredAt instanceof Date ?
                entry.enteredAt.toISOString() : entry.enteredAt,
              exitedAt: entry.exitedAt instanceof Date ?
                entry.exitedAt.toISOString() : entry.exitedAt
            }));
          }
        }
      });
    }
  }
  // If it's just the cards collection
  else if (prepared && typeof prepared === 'object' && !Array.isArray(prepared)) {
    // Process cards directly (for when just the cards are passed)
    Object.keys(prepared).forEach(cardId => {
      const card = prepared[cardId];
      if (card && typeof card === 'object') {
        // Process movement history
        if (Array.isArray(card.movementHistory)) {
          card.movementHistory = card.movementHistory
            .filter((movement: any) =>
              movement && movement.cardId && movement.fromColumnId && movement.toColumnId)
            .map((movement: any) => {
              // Ensure each movement has all required fields and proper date format
              const sanitizedMovement = {
                cardId: movement.cardId,
                fromColumnId: movement.fromColumnId,
                toColumnId: movement.toColumnId,
                movedBy: movement.movedBy || 'unknown',
                // Always convert dates to ISO strings
                movedAt: movement.movedAt instanceof Date ?
                  movement.movedAt.toISOString() :
                  (typeof movement.movedAt === 'string' ? movement.movedAt : new Date().toISOString())
              };

              return sanitizedMovement;
            });
        } else {
          card.movementHistory = [];
        }

        // Process timeInColumns
        if (Array.isArray(card.timeInColumns)) {
          card.timeInColumns = card.timeInColumns.map((entry: any) => ({
            ...entry,
            enteredAt: entry.enteredAt instanceof Date ?
              entry.enteredAt.toISOString() : entry.enteredAt,
            exitedAt: entry.exitedAt instanceof Date ?
              entry.exitedAt.toISOString() : entry.exitedAt
          }));
        }
      }
    });
  }

  // Finally, clean the data completely before returning
  return deepCleanForFirebase(prepared);
}

// Type-safe column structure extraction
function getColumnStructure(columns: ColumnType[]): any[] {
  return columns.map(col => ({
    id: col.id,
    title: col.title,
    isExpedite: !!(col as any).isExpedite,
    wipLimit: col.wipLimit,
    cardIds: [...col.cardIds],
    timeEstimationEnabled: !!col.timeEstimationEnabled,
    description: col.description || ''
  }));
}

// Simplified fingerprinting function with better typing and date normalization
function getCardFingerprint(card: CardType): string {
  // Normalize date for consistent comparison
  const normalizeDueDate = (date: any): string | null => {
    if (!date) return null;

    try {
      // If it's a Date object
      if (date instanceof Date) {
        return date.toISOString().split('T')[0];
      }

      // Try to convert to Date if it's a string or timestamp
      const dateObj = new Date(date);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split('T')[0];
      }
    } catch (e) {
      // Silent error
    }

    return null;
  };

  return JSON.stringify({
    // Put expedite at the top so it's more visible in debugging
    title: card.title || "",
    description: card.description || "",
    priority: card.priority || "",
    type: card.type || "",
    dueDate: normalizeDueDate(card.dueDate),
    assignedUsers: Array.isArray(card.assignedUsers) ?
      [...card.assignedUsers].sort() : [],
    checklist: Array.isArray(card.checklist) ?
      card.checklist.map(item => ({
        id: item.id,
        text: item.text || "",
        checked: !!item.completed
      })) : [],
    // Include LLM time estimate total in fingerprint
    timeEstimate: card.timeEstimate ?? null
  });
}

// Type-safe cards fingerprinting
function getCardsFingerprint(cards: Record<string, CardType>): string {
  if (!cards || Object.keys(cards).length === 0) return "{}";

  const cardFingerprints: Record<string, string> = {};

  Object.keys(cards).sort().forEach(cardId => {
    const card = cards[cardId];
    if (!card) return;
    cardFingerprints[cardId] = getCardFingerprint(card);
  });

  return JSON.stringify(cardFingerprints);
}

// Simplified function to detect important changes
function hasImportantChanges(current: string, previous: string): boolean {
  if (!previous || !current) return true;

  try {
    const currentObj = JSON.parse(current);
    const previousObj = JSON.parse(previous);

    // Check for card additions/removals
    const currentCardIds = Object.keys(currentObj);
    const previousCardIds = Object.keys(previousObj);

    if (currentCardIds.length !== previousCardIds.length) {
      return true;
    }

    // Check for important field changes
    for (const cardId of currentCardIds) {
      const currentCard = currentObj[cardId];
      const previousCard = previousObj[cardId];

      // If card exists in one but not both, significant change
      if (!currentCard || !previousCard) return true;

      // Always consider these fields important
      if (
        currentCard.priority !== previousCard.priority ||
        currentCard.title !== previousCard.title ||
        currentCard.description !== previousCard.description ||
        JSON.stringify(currentCard.assignedUsers) !== JSON.stringify(previousCard.assignedUsers) ||
        // Add additional important fields
        currentCard.type !== previousCard.type ||
        currentCard.dueDate !== previousCard.dueDate ||
        JSON.stringify(currentCard.labels) !== JSON.stringify(previousCard.labels) ||
        JSON.stringify(currentCard.checklist) !== JSON.stringify(previousCard.checklist)
      ) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return true; // When in doubt, consider it changed
  }
}

export const useSaveBoard = (
  board: BoardType,
  user: User | null,
  savingDisabled: boolean,
  firebaseBlocked: boolean,
  boardId?: string,
  localVersion?: number,
  isShared?: boolean
) => {
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedBoard, setLastSavedBoard] = useState<BoardType | null>(null);

  // Refs for tracking state between renders
  const boardRef = useRef<BoardType>(board);
  const lastSavedColumnsRef = useRef<string>('');
  const lastSavedCardsRef = useRef<string>('');
  const lastSaveTimeRef = useRef<number>(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialRenderRef = useRef(true);
  const saveAttemptsRef = useRef(0);
  const isProcessingSaveRef = useRef(false);

  // Constants
  const DEBOUNCE_TIME = 2000; // 2 seconds
  const SAVE_THROTTLE_MS = 5000; // 5 seconds between saves
  const MAX_SAVE_ATTEMPTS = 3;

  // Function to force UI updates after save
  const forceUIUpdate = useCallback(() => {
    if (typeof window !== 'undefined' && boardId) {
      // Dispatch a board-saved event to trigger UI updates
      const savedEvent = new CustomEvent('board-saved', {
        detail: { boardId, timestamp: Date.now() }
      });
      window.dispatchEvent(savedEvent);

      // Also dispatch a force-board-rerender event
      const forceEvent = new CustomEvent('force-board-rerender', {
        detail: { timestamp: Date.now() }
      });
      window.dispatchEvent(forceEvent);
    }
  }, [boardId]);

  // Save board to Firebase
  const saveBoard = useCallback(async (force = false, columnsFingerprint?: string, cardsFingerprint?: string) => {
    // Skip if saving is disabled or Firebase is blocked
    if (savingDisabled || firebaseBlocked) {
      setHasUnsavedChanges(true);
      return;
    }

    // Skip if no user or board ID
    if (!user || !boardId) {
      setHasUnsavedChanges(true);
      return;
    }

    // Skip if already saving
    if (isSaving && !force) {
      setHasUnsavedChanges(true);
      return;
    }

    // Throttle saves
    const now = Date.now();
    if (!force && now - lastSaveTimeRef.current < SAVE_THROTTLE_MS) {
      setHasUnsavedChanges(true);
      return;
    }

    // Track save attempts
    if (isProcessingSaveRef.current) {
      saveAttemptsRef.current++;
      if (saveAttemptsRef.current > MAX_SAVE_ATTEMPTS) {
        // Too many attempts, wait a bit
        setTimeout(() => {
          saveAttemptsRef.current = 0;
        }, SAVE_THROTTLE_MS * 2);
        return;
      }
    }

    // Set processing flag
    isProcessingSaveRef.current = true;
    setIsSaving(true);

    try {
      // Get current board state
      const boardToSave = boardRef.current;

      // Generate fingerprints for comparison
      const currentColumnsString = columnsFingerprint || JSON.stringify(getColumnStructure(boardToSave.columns));
      const currentCardsFingerprint = cardsFingerprint || getCardsFingerprint(boardToSave.cards || {});

      // Skip if nothing changed and not forced
      if (!force &&
        currentColumnsString === lastSavedColumnsRef.current &&
        currentCardsFingerprint === lastSavedCardsRef.current) {
        setIsSaving(false);
        isProcessingSaveRef.current = false;
        return;
      }

      // Fix any invalid timeInColumns entries
      const boardWithFixedTimeTracking = fixInvalidTimeTracking(boardToSave);

      // Add default categories to columns and update boardToSave
      Object.assign(boardToSave, {
        ...boardWithFixedTimeTracking,
        columns: boardWithFixedTimeTracking.columns.map(column => ({
          ...column,
          category: column.category || '' // Ensure category is never undefined
        }))
      });

      try {
        // Determine the correct path to save the board - this is the only part that differs
        let boardDocRef: DocumentReference;

        if (isShared === true) {
          // For shared boards, use the original board path from shared metadata
          try {
            // Check if we have a cached path in localStorage
            const cacheKey = `original-board-path-${boardId}`;
            const cachedOriginalPath = localStorage.getItem(cacheKey);

            if (cachedOriginalPath) {
              boardDocRef = doc(db, cachedOriginalPath);
            } else {
              // Fetch path from shared board metadata
              if (!user?.email) throw new Error("User email required for shared board editing");

              const normalizedEmail = user.email.toLowerCase();
              const sharedMetaRef = doc(db, "sharedBoards", normalizedEmail, "boards", boardId);

              const sharedMetaSnap = await getDoc(sharedMetaRef);

              if (!sharedMetaSnap.exists()) {
                throw new Error("Shared board metadata not found");
              }

              const sharedMeta = sharedMetaSnap.data();
              const originalPath = sharedMeta.originalBoardPath;

              if (!originalPath) {
                throw new Error("Original board path not found in shared metadata");
              }

              boardDocRef = doc(db, originalPath);

              // Cache the path for future use
              localStorage.setItem(cacheKey, originalPath);
            }
          } catch (err) {
            throw new Error("Error getting shared board path");
          }
        } else {
          // For owner's boards, use the standard path
          boardDocRef = doc(db, "users", user.uid, "boards", boardId);
        }

        // UNIFIED APPROACH: Use the same save logic for both owner and shared users
        // Extract changed cards by comparing with last saved state
        const updates: Record<string, any> = {};

        // Always include columns to ensure structure is maintained
        updates['columns'] = sanitizeForFirebase(boardToSave.columns);

        // Include archivedCardIds so archiving is persisted
        if (Array.isArray(boardToSave.archivedCardIds)) {
          updates['archivedCardIds'] = sanitizeForFirebase(boardToSave.archivedCardIds);
        }

        if (Array.isArray(boardToSave.archivedCards)) {
          updates['archivedCards'] = sanitizeForFirebase(boardToSave.archivedCards);
        }

        // Process cards with movement history
        const cardsWithMovementHistory = Object.entries(boardToSave.cards)
          .filter(([_, card]) => card.movementHistory && card.movementHistory.length > 0);

        if (cardsWithMovementHistory.length > 0) {
          // For each card with movement history, create a specific update for its movement history
          cardsWithMovementHistory.forEach(([cardId, card]) => {
            // Sanitize the movement history for this card
            const sanitizedMovementHistory = sanitizeForFirebase(card.movementHistory);

            // FIX: Create a properly nested update object structure instead of using dot notation
            if (!updates.cards) {
              updates.cards = {};
            }
            if (!updates.cards[cardId]) {
              updates.cards[cardId] = {};
            }
            updates.cards[cardId].movementHistory = sanitizedMovementHistory;
            updates.cards[cardId].hasMovementHistory = true;
          });
        }

        // Always include all cards in updates when they've changed
        if (currentCardsFingerprint !== lastSavedCardsRef.current || force) {
          updates['cards'] = sanitizeForFirebase(boardToSave.cards);
        }

        // Add metadata
        updates['lastUpdated'] = serverTimestamp();
        updates['lastEditedByEmail'] = user.email;
        updates['lastEditedById'] = user.uid;
        updates['lastEditedBySharedUser'] = isShared === true;
        updates['title'] = boardToSave.title;

        if (!isShared) {
          updates['ownerId'] = user.uid;
        }

        console.log('updates from save board:', updates);

        // Update with merge to preserve other fields
        await setDoc(boardDocRef, updates, { merge: true });

        // Update references after successful save
        lastSavedColumnsRef.current = currentColumnsString;
        lastSavedCardsRef.current = currentCardsFingerprint;
        setHasUnsavedChanges(false);

        // Track when we've edited each path
        try {
          localStorage.setItem(`last-edit-${boardDocRef.path}`, new Date().toISOString());
        } catch (e) {
          // Silent error
        }

        // After successful save, force UI update
        forceUIUpdate();

        // Also force a complete UI refresh
        if (boardId) {
          forceCompleteUIRefresh(boardId);
        }

      } catch (error) {
        setHasUnsavedChanges(true);
      }

      lastSaveTimeRef.current = now;


      // Reset save attempts counter after successful save
      setTimeout(() => {
        saveAttemptsRef.current = Math.max(0, saveAttemptsRef.current - 1);
      }, SAVE_THROTTLE_MS);
    } catch (error) {
      setHasUnsavedChanges(true);
    } finally {
      setIsSaving(false);
      isProcessingSaveRef.current = false;
    }
  }, [user, savingDisabled, firebaseBlocked, boardId, localVersion, isShared, isSaving, forceUIUpdate]);

  // Initialize tracking variables on mount
  useEffect(() => {
    if (board) {
      if (!lastSavedColumnsRef.current) {
        const columnsData = getColumnStructure(board.columns);
        lastSavedColumnsRef.current = JSON.stringify(columnsData);
      }

      if (!lastSavedCardsRef.current) {
        lastSavedCardsRef.current = getCardsFingerprint(board.cards);
      }
    }
  }, [board]);

  // Improve the debouncing in the useSaveBoard hook - simplified
  useEffect(() => {
    // Skip initial render to prevent unnecessary saves
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;
      boardRef.current = board;

      // Initialize the comparison values with our stable fingerprints
      const columnsData = getColumnStructure(board.columns);
      lastSavedColumnsRef.current = JSON.stringify(columnsData);
      lastSavedCardsRef.current = getCardsFingerprint(board.cards);

      return;
    }

    // Update the board ref to have the latest value
    boardRef.current = board;

    // Clear any existing saveTimeout when board changes
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // If lastMoveTimestamp is recent, save with higher priority
    const hasRecentMove = board.lastMoveTimestamp &&
      (Date.now() - board.lastMoveTimestamp < 2000);

    if (hasRecentMove) {
      // Reduce timeout for card moves to 50ms for faster response
      saveTimeoutRef.current = setTimeout(() => saveBoard(true), 50);
      return;
    }

    // Generate new fingerprints
    const currentColumnsString = JSON.stringify(getColumnStructure(board.columns));
    const currentCardsFingerprint = getCardsFingerprint(board.cards || {});

    // Direct comparison of fingerprints
    const columnsChanged = currentColumnsString !== lastSavedColumnsRef.current;
    const cardsChanged = currentCardsFingerprint !== lastSavedCardsRef.current;

    // Check for important changes using our simplified function
    const hasImportantCardChanges = cardsChanged &&
      hasImportantChanges(currentCardsFingerprint, lastSavedCardsRef.current);

    // Check for title changes
    const titleChanged = board.title !== boardRef.current.title;

    // If we have important changes, save with shorter timeout
    if (hasImportantCardChanges) {
      const columnsToSave = currentColumnsString;
      const cardsToSave = currentCardsFingerprint;

      saveTimeoutRef.current = setTimeout(() => {
        saveBoard(true, columnsToSave, cardsToSave);
      }, 50);
      return;
    }

    if (columnsChanged || cardsChanged || titleChanged) {
      // Store the current values to pass to the save function
      const columnsToSave = currentColumnsString;
      const cardsToSave = currentCardsFingerprint;

      // Use a consistent debounce time
      saveTimeoutRef.current = setTimeout(() => {
        saveBoard(false, columnsToSave, cardsToSave);
      }, DEBOUNCE_TIME);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [board, saveBoard]);

  // Force save on unmount if there are unsaved changes
  useEffect(() => {
    return () => {
      if (hasUnsavedChanges && !isProcessingSaveRef.current) {
        saveBoard(true);
      }
    };
  }, [saveBoard, hasUnsavedChanges]);

  // Make forceSave globally available for emergency situations
  if (typeof window !== 'undefined') {
    (window as any).forceSaveBoard = () => saveBoard(true);
  }

  return {
    isSaving,
    hasUnsavedChanges,
    saveBoard,
    forceSave: () => saveBoard(true),
    forceUIUpdate,
    lastSavedBoard
  };
};

// Add this function to directly save movement history after a card move
export const saveCardMovementHistory = async (
  user: any,
  currentBoardId: string,
  isSharedBoard: boolean,
  cardId: string,
  movements: any[] | undefined
) => {
  if (!user || !currentBoardId || !movements || movements.length === 0) return;

  try {
    console.log(`Saving ${movements.length} movements for card ${cardId} directly to Firebase`);

    // Determine the correct board path
    let boardPath: string;
    if (isSharedBoard) {
      const cacheKey = `original-board-path-${currentBoardId}`;
      const cachedPath = localStorage.getItem(cacheKey);

      if (cachedPath) {
        boardPath = cachedPath;
      } else {
        throw new Error("Cannot find original board path for shared board");
      }
    } else {
      boardPath = `users/${user.uid}/boards/${currentBoardId}`;
    }

    // Sanitize the movement history
    const sanitizedMovements = movements.map(movement => ({
      cardId: movement.cardId,
      fromColumnId: movement.fromColumnId,
      toColumnId: movement.toColumnId,
      movedBy: movement.movedBy || 'unknown',
      movedAt: movement.movedAt instanceof Date ?
        movement.movedAt.toISOString() :
        (typeof movement.movedAt === 'string' ? movement.movedAt : new Date().toISOString())
    }));

    // Create a direct update to save just the movement history
    const boardRef = doc(db, boardPath);
    await setDoc(boardRef, {
      cards: {
        [cardId]: {
          movementHistory: sanitizedMovements,
          hasMovementHistory: true
        }
      },
      lastUpdated: serverTimestamp()
    }, { merge: true });

    console.log(`Successfully saved movement history for card ${cardId}`);
  } catch (error) {
    console.error("Error saving card movement history:", error);
  }
};
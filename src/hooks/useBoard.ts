import { useState, useEffect, useCallback, useRef } from 'react';
import { onSnapshot, Timestamp, DocumentReference } from 'firebase/firestore';
import { Board, User, Card, Column, CardMovement, FirebaseBoard } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { BoardService } from '../services/BoardService';

export const useBoard = (
  user: User | null,
  boardId: string | null,
  isSharedBoard: boolean = false
) => {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const boardDocRef = useRef<DocumentReference | null>(null);

  useEffect(() => {
    if (!user || !boardId) {
      setBoard(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const ref = await BoardService.getBoardDocRef(
          user.id,
          boardId,
          isSharedBoard,
          user.email
        );
        boardDocRef.current = ref;
        const docRef = ref!;
        unsubscribe = onSnapshot(docRef, (snapshot: any) => {
          setBoard(processBoardData(snapshot.data()));
          setLoading(false);
        });
      } catch (e) {
        console.error("useBoard subscription error:", e);
        throw e;
      }
    })();
    return () => unsubscribe && unsubscribe();
  }, [user, boardId, isSharedBoard]);

  // --- MUTATION FUNCTIONS ---
  // These functions perform optimistic updates and then call services.
  // The setBoard is the optimistic update.
  // Then we call the service to update the board in the database.
  // If the service call fails, down the line we should look into reverting the optimistic update by setting the board state to the previous state.
  // and sending an error toast to the user. for now, fuck it let's see how it goes

  const updateColumns = useCallback(async (columns: Column[]) => {
    if (!boardDocRef.current || !columns) {
      console.error("Board document reference is not available. Cannot update columns.");
      throw new Error("Board document reference is required to update columns.");
    }

    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      return { ...prev, columns: columns };
    });

    try {
      await BoardService.updateColumns(boardDocRef.current, columns);
    } catch (err) {
      console.error("Failed to update columns:", err);
      throw err;
    }
  }, [board]);

  // TODO: Refactor at some point, a jank way to add user info to the board (meant for after a user has been added to a board since their user details are not populated in the main board document)
  const updateUserInfoToBoard = useCallback(async (user: User) => {
    if (!boardDocRef.current || !board || !user) {
      console.error("Board document reference is not available. Cannot add user info to board.");
      throw new Error("Board document reference is required to add user info to board.");
    }
    // Compute new users array ONCE
    const users = board.users.map(u =>
      u.email === user.email ? { ...u, ...user } : u
    );
    // Optimistic update
    setBoard(prev => prev ? { ...prev, users } : null);
    try {
      await BoardService.updateUserInBoard(boardDocRef.current, users);
    } catch (err) {
      console.error("Failed to add user info to board:", err);
      throw err;
    }
  }, [board]);

  const updateBoardTitle = useCallback(async (newTitle: string) => {
    if (!boardDocRef.current || !newTitle) {
      console.error("Board document reference is not available. Cannot update board title.");
      throw new Error("Board document reference is required to update board title.");
    }

    try {
      setBoard(prev => {
        if (!prev) return null;
        return { ...prev, title: newTitle };
      });
      await BoardService.updateBoardTitle(boardDocRef.current, newTitle);
    } catch (err) {
      console.error("Failed to update board title:", err);
      throw err;
    }
  }, [board]);

  const deleteColumn = useCallback(async (columnId: string) => {
    if (!boardDocRef.current || !board || !columnId) {
      console.error("Board document reference is not available. Cannot delete column.");
      throw new Error("Board document reference is required to delete column.");
    }
    const columnToDelete = board.columns.find(col => col.id === columnId);
    if (!columnToDelete) return;
    const updatedColumns = board.columns.filter(col => col.id !== columnId);
    const updatedCards = { ...board.cards };
    columnToDelete.cardIds.forEach(cardId => {
      delete updatedCards[cardId];
    });
    // Optimistic update
    setBoard(prev => prev ? { ...prev, columns: updatedColumns, cards: updatedCards } : null);
    try {
      await BoardService.deleteColumn(boardDocRef.current, updatedColumns, columnToDelete.cardIds);
    } catch (err) {
      console.error("Failed to delete column:", err);
      throw err;
    }
  }, [board]);

  const updateColumnTitle = useCallback(async (columnId: string, newTitle: string) => {
    if (!boardDocRef.current || !board || !columnId || !newTitle) {
      console.error("Board document reference is not available. Cannot update column title.");
      throw new Error("Board document reference is required to update column title.");
    }
    // Compute new columns array
    const updatedColumns = board.columns.map(col =>
      col.id === columnId ? { ...col, title: newTitle } : col
    );
    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      return { ...prev, columns: updatedColumns };
    });
    try {
      await BoardService.updateColumns(boardDocRef.current, updatedColumns);
    } catch (err) {
      console.error("Failed to update column title:", err);
      throw err;
    }
  }, [board]);

  const addColumn = useCallback(async (title: string, wipLimit: number = 0) => {
    if (!boardDocRef.current || !board || !title) {
      console.error("Board document reference is not available. Cannot add column.");
      throw new Error("Board document reference is required to add column.");
    }
    const newColumn: Column = {
      id: uuidv4(),
      title,
      cardIds: [],
      wipLimit,
      isCollapsed: false
    };
    const updatedColumns = [...board.columns, newColumn];
    // Optimistic update
    setBoard(prev => prev ? { ...prev, columns: updatedColumns } : null);
    try {
      await BoardService.updateColumns(boardDocRef.current, updatedColumns);
    } catch (err) {
      console.error("Failed to add column:", err);
      throw err;
    }
  }, [board]);

  const addCard = useCallback(async (card: Card, columnId: string) => {
    if (!boardDocRef.current || !board || !card || !columnId) {
      console.error("Board document reference is not available. Cannot add card.");
      throw new Error("Board document reference is required to add card.");
    }
    // Compute updated cards and columns
    const updatedCards = { ...board.cards, [card.id]: card };
    const updatedColumns = board.columns.map((col: Column) =>
      col.id === columnId ? { ...col, cardIds: [...col.cardIds, card.id] } : col
    );
    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      return { ...prev, cards: updatedCards, columns: updatedColumns };
    });
    try {
      await BoardService.addCard(boardDocRef.current, card, updatedColumns);
    } catch (err) {
      console.error("Failed to add card:", err);
      throw err;
    }
  }, [board]);

  // TODO: down the line get rid of "edit" style and allow instnat updates, that way we actually do granular updates
  const updateCard = useCallback(async (card: Card) => {
    if (!boardDocRef.current || !card) {
      console.error("Board document reference is not available. Cannot update card.");
      throw new Error("Board document reference is required to update card.");
    }
    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      return {
        ...prev,
        cards: {
          ...prev.cards,
          [card.id]: card,
        },
      };
    });
    try {
      await BoardService.updateCard(boardDocRef.current, card);
    } catch (err) {
      console.error("Failed to update card:", err);
      throw err;
    }
  }, []);

  const deleteCard = useCallback(async (cardId: string, columnId: string) => {
    if (!boardDocRef.current || !board || !cardId || !columnId) {
      console.error("Board document reference is not available. Cannot delete card.");
      throw new Error("Board document reference is required to delete card.");
    }

    // Compute updated columns
    const updatedColumns = board.columns.map(col =>
      col.id === columnId
        ? { ...col, cardIds: col.cardIds.filter(id => id !== cardId) }
        : col
    );

    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      // Remove card from cards map
      const { [cardId]: removedCard, ...remainingCards } = prev.cards;
      return { ...prev, cards: remainingCards, columns: updatedColumns };
    });

    try {
      await BoardService.deleteCard(boardDocRef.current, cardId, updatedColumns);
    } catch (err) {
      console.error("Failed to delete card:", err);
      throw err;
    }
  }, [board]);

  const archiveCard = useCallback(async (card: Card, columnId: string) => {
    if (!boardDocRef.current || !board || !card || !columnId) {
      console.error("Board document reference is not available. Cannot archive card.");
      throw new Error("Board document reference is required to archive card.");
    }

    // Compute updated columns and archivedCards
    const updatedColumns = board.columns.map(col =>
      col.id === columnId
        ? { ...col, cardIds: col.cardIds.filter(id => id !== card.id) }
        : col
    );
    const alreadyArchived = (board.archivedCards || []).some(c => c.id === card.id);
    const updatedArchivedCards = alreadyArchived ? board.archivedCards || [] : [...(board.archivedCards || []), card];

    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      // Remove card from cards map
      const { [card.id]: _removed, ...remainingActiveCards } = prev.cards;
      return {
        ...prev,
        columns: updatedColumns,
        cards: remainingActiveCards,
        archivedCards: updatedArchivedCards,
      };
    });

    try {
      await BoardService.archiveCard(boardDocRef.current, card, updatedColumns, updatedArchivedCards);
    } catch (err) {
      console.error("Failed to archive card:", err);
      throw err;
    }
  }, [board]);

  // TODO: what if column doesnt exist anymore (was deleted)?
  const restoreCard = useCallback(async (card: Card, destinationColumnId: string) => {
    if (!boardDocRef.current || !board || !card || !destinationColumnId) {
      console.error("Board document reference is not available. Cannot restore card.");
      throw new Error("Board document reference is required to restore card.");
    }

    // Compute updated archivedCards and columns
    const updatedArchivedCards = (board.archivedCards || []).filter(c => c.id !== card.id);
    const updatedColumns = board.columns.map(col =>
      col.id === destinationColumnId
        ? { ...col, cardIds: [...col.cardIds, card.id] }
        : col
    );

    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      // Add to cards map
      const updatedCards = { ...prev.cards, [card.id]: card };
      return {
        ...prev,
        archivedCards: updatedArchivedCards,
        cards: updatedCards,
        columns: updatedColumns,
      };
    });

    try {
      await BoardService.restoreCard(boardDocRef.current, card, updatedColumns, updatedArchivedCards);
    } catch (err) {
      console.error("Failed to restore card:", err);
      throw err;
    }
  }, [board]);

  // TODO: move cards within column (reordering)
  const moveCard = useCallback(async (
    cardId: string,
    sourceColumnId: string,
    destinationColumnId: string,
    destinationIndex: number = board?.columns.find(c => c.id === destinationColumnId)?.cardIds.length ?? 0
  ) => {
    if (!boardDocRef.current || !board || !cardId || !sourceColumnId || !destinationColumnId) {
      console.error("Board document reference is not available. Cannot move card.");
      throw new Error("Board document reference is required to move card.");
    }

    const card = board.cards[cardId];
    if (!card) return;

    // TODO: is it safe to send this raw date to firebase? need to deterimine what we are doing with timestamps in the db
    // some are using serverTimestamp, others clearly aren't
    const now = new Date();

    // Compute new movement history
    const newMovement: CardMovement = {
      cardId,
      fromColumnId: sourceColumnId,
      toColumnId: destinationColumnId,
      movedAt: now,
      movedBy: user?.name || 'unknown',
    };
    const movementHistory = Array.isArray(card.movementHistory) ? [...card.movementHistory, newMovement] : [newMovement];

    // Compute new timeInColumns
    let timeInColumns = Array.isArray(card.timeInColumns) ? [...card.timeInColumns] : [];
    const lastIndex = timeInColumns.findIndex(t => t.columnId === sourceColumnId && !t.exitedAt);
    if (lastIndex !== -1) {
      const enteredAt = new Date(timeInColumns[lastIndex].enteredAt);
      timeInColumns[lastIndex] = {
        ...timeInColumns[lastIndex],
        exitedAt: now,
        durationMs: now.getTime() - enteredAt.getTime(),
      };
    }
    timeInColumns.push({
      columnId: destinationColumnId,
      enteredAt: now,
      exitedAt: null,
    });

    // Compute updated card
    const updatedCard = {
      ...card,
      currentColumnId: destinationColumnId,
      movementHistory,
      timeInColumns,
      updatedAt: now,
    };

    // Compute updated columns
    const updatedColumns = board.columns.map(col => {
      if (col.id === sourceColumnId) {
        return { ...col, cardIds: col.cardIds.filter(id => id !== cardId) };
      }
      if (col.id === destinationColumnId) {
        const newCardIds = [...col.cardIds];
        newCardIds.splice(destinationIndex, 0, cardId);
        return { ...col, cardIds: newCardIds };
      }
      return col;
    });

    // Optimistic update
    setBoard(prev => {
      if (!prev) return null;
      return {
        ...prev,
        cards: { ...prev.cards, [cardId]: updatedCard },
        columns: updatedColumns,
      };
    });

    // Prepare Firestore update by passing computed values to BoardService
    try {
      await BoardService.moveCard(boardDocRef.current, {
        cardId,
        currentColumnId: destinationColumnId,
        movementHistory,
        timeInColumns,
        updatedColumns,
      });
    } catch (err) {
      console.error("Failed to move card:", err);
      throw err;
    }
  }, [user, board]);

  return {
    board,
    loading,
    updateColumns,
    updateUserInfoToBoard,
    updateBoardTitle,
    deleteColumn,
    updateColumnTitle,
    addColumn,
    addCard,
    updateCard,
    deleteCard,
    archiveCard,
    restoreCard,
    moveCard
  };
};

// Always process timestamps to Date objects. TODO: JK I guess not all of them are timestamps, some are just dates (like movementHistory.movedAt), figure out later
// Sometimes timestamps are temporarily null, idk if this will cause bugs in future but I think db updates so fast its fine.
const processBoardData = (data: FirebaseBoard): Board => {
  // console.log("createdAt is an instance of timestmap: ", data.createdAt instanceof Timestamp, " and value", data.createdAt?.toDate(), "and normal value", data.createdAt);
  // console.log("updatedAt is an instance of timestmap: ", data.updatedAt instanceof Timestamp, " and value", data.updatedAt?.toDate(), "and normal value", data.updatedAt);
  const board: Board = {
    id: data.id, // Ensure ID is present
    title: data.title,
    ownerId: data.ownerId,
    ownerEmail: data.ownerEmail,
    ownerName: data.ownerName,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : data.updatedAt,
    cards: data.cards,
    columns: data.columns,
    archivedCards: data.archivedCards,
    users: data.users,
  };

  Object.entries(board.cards).forEach(([cardId, cardData]) => {
    if (cardData) {
      const card = cardData as any;
      board.cards[cardId] = {
        ...card,
        id: cardId,
        createdAt: card.createdAt instanceof Timestamp ? card.createdAt.toDate() : card.createdAt,
        updatedAt: card.updatedAt instanceof Timestamp ? card.updatedAt.toDate() : card.updatedAt,
        movementHistory: Array.isArray(card.movementHistory)
          ? card.movementHistory.map((movement: any) => ({
            ...movement,
            movedAt: movement.movedAt instanceof Timestamp ? movement.movedAt.toDate() : movement.movedAt,
          }))
          : [],
        timeInColumns: Array.isArray(card.timeInColumns)
          ? card.timeInColumns.map((tic: any) => ({
            ...tic,
            enteredAt: tic.enteredAt instanceof Timestamp ? tic.enteredAt.toDate() : tic.enteredAt,
            exitedAt: tic.exitedAt ? (tic.exitedAt instanceof Timestamp ? tic.exitedAt.toDate() : tic.exitedAt) : null,
          }))
          : [],
      };
    }
  });
  return board;
};
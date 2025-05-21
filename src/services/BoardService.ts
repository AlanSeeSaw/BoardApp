import { doc, getDoc, updateDoc, setDoc, DocumentReference, deleteField, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { ShareService } from './ShareService';
import { Board, Column, Card, User, FirebaseBoard } from '../types';
import { initialBoard } from '../constants/initialBoard';
import { v4 as uuidv4 } from 'uuid';

export const BoardService = {
    async getBoardDocRef(
        userId: string,
        boardId: string,
        isShared: boolean = false,
        userEmail?: string | null
    ): Promise<DocumentReference | null> {
        try {
            if (isShared) {
                if (!userEmail) {
                    console.error("User email is required to fetch a shared board document reference via BoardService.");
                    return null;
                }
                // Delegate to ShareService for shared board path resolution
                return await ShareService.getSharedBoardDocRef(userEmail, boardId);
            } else {
                // Handle owned boards directly
                if (!userId || !boardId) {
                    console.error("User ID is required to fetch an owned board document reference via BoardService.");
                    return null;
                }
                const boardDocRef = doc(db, `users/${userId}/boards/${boardId}`);
                const boardSnap = await getDoc(boardDocRef);
                return boardSnap.exists() ? boardDocRef : null;
            }
        } catch (error) {
            console.error(`BoardService: Error getting board document reference for boardId ${boardId} (isShared: ${isShared}):`, error);
            return null;
        }
    },

    async createBoard(boardName: string, user: User): Promise<string> {
        const newBoardId = uuidv4();
        const newBoardRef = doc(db, "users", user.id, "boards", newBoardId);

        const board: FirebaseBoard = {
            ...initialBoard,
            id: newBoardId,
            title: boardName,
            ownerId: user.id,
            ownerEmail: user.email,
            ownerName: user.name,
            createdAt: serverTimestamp() as any, // Whatever do this for now, typescript sucks
            updatedAt: serverTimestamp() as any,
            users: [user],
        };

        await setDoc(newBoardRef, board);
        return newBoardId;
    },

    async updateUserInBoard(boardDocRef: DocumentReference, users: User[]): Promise<void> {
        await updateDoc(boardDocRef, { users, updatedAt: serverTimestamp() });
    },

    async updateBoardTitle(boardDocRef: DocumentReference, newTitle: string): Promise<void> {
        await updateDoc(boardDocRef, { title: newTitle });
    },

    /**
     * Move a card: receives all computed values and performs the DB update only.
     * @param boardDocRef Firestore document reference
     * @param params Object with cardId, currentColumnId, movementHistory, timeInColumns, updatedColumns
     */
    async moveCard(
        boardDocRef: DocumentReference,
        {
            cardId,
            currentColumnId,
            movementHistory,
            timeInColumns,
            updatedColumns,
        }: {
            cardId: string;
            currentColumnId: string;
            movementHistory: any[];
            timeInColumns: any[];
            updatedColumns: any[];
        }
    ): Promise<void> {
        if (!boardDocRef) {
            console.error("Board document reference is undefined. Cannot move card.");
            throw new Error("Board document reference is required to move a card.");
        }

        await updateDoc(boardDocRef, {
            [`cards.${cardId}.currentColumnId`]: currentColumnId,
            [`cards.${cardId}.movementHistory`]: movementHistory,
            [`cards.${cardId}.timeInColumns`]: timeInColumns,
            [`cards.${cardId}.updatedAt`]: serverTimestamp(),
            columns: updatedColumns,
            updatedAt: serverTimestamp(),
        });
    },

    // Note: Columns are arrays so we have to update the whole array. AKA USE THIS FOR ALL COLUMN UPDATES
    // We cannot use field level updates for arrays in firebase.
    // Down the line maybe we can rewrite all arrays to be objects with id keys and then update the fields of the object, but oh well for now.
    async updateColumns(boardDocRef: DocumentReference, columns: Column[]): Promise<void> {
        await updateDoc(boardDocRef, {
            columns: columns,
            updatedAt: serverTimestamp() as any,
        });
    },

    async deleteColumn(boardDocRef: DocumentReference, updatedColumns: Column[], cardIdsToDelete: string[]): Promise<void> {
        // Build deleteFields for each card in the column
        const deleteFields: Record<string, any> = {};
        cardIdsToDelete.forEach((cardId: string) => {
            deleteFields[`cards.${cardId}`] = deleteField();
        });
        await updateDoc(boardDocRef, {
            columns: updatedColumns,
            ...deleteFields,
            updatedAt: serverTimestamp(),
        });
    },

    async addCard(boardDocRef: DocumentReference, card: Card, updatedColumns: Column[]): Promise<void> {
        // Use dot notation to only add the new card
        card = {
            ...card,
            createdAt: serverTimestamp() as any,
            updatedAt: serverTimestamp() as any,
        }
        const cardUpdate = { [`cards.${card.id}`]: card };
        await updateDoc(boardDocRef, {
            ...cardUpdate,
            columns: updatedColumns,
            updatedAt: serverTimestamp() as any,
        });
    },

    async updateCard(boardDocRef: DocumentReference, card: Card): Promise<void> {
        // Use dot notation to update only the card
        card = {
            ...card,
            updatedAt: serverTimestamp() as any,
        }
        await updateDoc(boardDocRef, {
            [`cards.${card.id}`]: card,
            updatedAt: serverTimestamp() as any,
        });
    },

    async deleteCard(boardDocRef: DocumentReference, cardId: string, updatedColumns: Column[]): Promise<void> {
        // Use deleteField to remove the card from the cards map
        const deleteFields: Record<string, any> = {};
        deleteFields[`cards.${cardId}`] = deleteField();
        await updateDoc(boardDocRef, {
            columns: updatedColumns,
            ...deleteFields,
            updatedAt: serverTimestamp() as any,
        });
    },

    async archiveCard(boardDocRef: DocumentReference, card: Card, updatedColumns: Column[], updatedArchivedCards: Card[]): Promise<void> {
        // Use deleteField to remove the card from the cards map
        const deleteFields: Record<string, any> = {};
        deleteFields[`cards.${card.id}`] = deleteField();
        await updateDoc(boardDocRef, {
            columns: updatedColumns,
            archivedCards: updatedArchivedCards,
            ...deleteFields,
            updatedAt: serverTimestamp() as any,
        });
    },

    async restoreCard(boardDocRef: DocumentReference, card: Card, updatedColumns: Column[], updatedArchivedCards: Card[]): Promise<void> {
        // Use dot notation to add the card back
        const cardUpdate = { [`cards.${card.id}`]: card };
        await updateDoc(boardDocRef, {
            ...cardUpdate,
            columns: updatedColumns,
            archivedCards: updatedArchivedCards,
            updatedAt: serverTimestamp() as any,
        });
    },
}; 
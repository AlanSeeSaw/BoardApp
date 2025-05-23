import { Firestore, doc, setDoc, Timestamp, getDoc, deleteDoc } from 'firebase/firestore';
import { Card, Board, HistoricalCard, AggregatedTimeInColumn } from '../types';
import { calculateAggregatedTimeInColumns } from '../utils/cardUtils';

/**
 * Saves a card's data to a board-specific historicalCards collection in Firestore.
 *
 * @param db The Firestore instance.
 * @param userId The ID of the user who owns the board.
 * @param cardToSave The card object to be archived/deleted.
 * @param board The board object to which the card belonged, for context like boardId and title.
 */
export async function saveToHistoricalCollection(
    db: Firestore,
    userId: string,
    cardToSave: Card,
    board: Board,
): Promise<void> {
    console.log(`[Debug] Attempting to save card ${cardToSave.id} to historical collection for board ${board.id} under user ${userId}`);

    if (!userId || !cardToSave || !board || !db) {
        console.error("[Debug] Missing required parameters for saveToHistoricalCollection", { userId, cardToSave, board, db });
        return;
    }
    const actionTimestamp = Timestamp.now();

    try {
        const aggregatedTime: AggregatedTimeInColumn[] = calculateAggregatedTimeInColumns(
            cardToSave,
            board.columns,
            actionTimestamp
        );

        const historicalCardData: HistoricalCard = {
            id: cardToSave.id,
            title: cardToSave.title,
            description: cardToSave.description,
            priority: cardToSave.priority,
            type: cardToSave.type,
            labels: cardToSave.labels || [],
            checklist: cardToSave.checklist || [],
            dueDate: cardToSave.dueDate || null,
            aggregatedTimeInColumns: aggregatedTime,
            codebaseContext: cardToSave.codebaseContext || '',
            devTimeEstimate: cardToSave.devTimeEstimate || '',
            timeEstimate: cardToSave.timeEstimate || undefined,
        };

        // Remove undefined properties before saving to Firestore
        Object.keys(historicalCardData).forEach(key => {
            const k = key as keyof HistoricalCard;
            if (historicalCardData[k] === undefined) {
                delete historicalCardData[k];
            }
        });

        console.log(`[Debug] Historical card data prepared: ${JSON.stringify(historicalCardData)}`);

        // Updated path to be board-specific under the user
        const historicalCardRef = doc(db, 'users', userId, 'boards', board.id, 'historicalCards', cardToSave.id);
        await setDoc(historicalCardRef, historicalCardData, { merge: true });

        console.log(`[Debug] Card ${cardToSave.id} setDoc operation completed for historicalCards collection under board ${board.id}.`);

    } catch (error) {
        console.error(`[Debug] Error in saveToHistoricalCollection for card ${cardToSave.id} under board ${board.id}:`, error);
    }
}

export async function deleteHistoricalCard(
    db: Firestore,
    userId: string,
    boardId: string,
    cardId: string
): Promise<void> {
    if (!userId || !boardId || !cardId || !db) {
        console.error("[Debug] Missing required parameters for deleteHistoricalCard", { userId, boardId, cardId, db });
        return;
    }
    try {
        const historicalCardRef = doc(db, 'users', userId, 'boards', boardId, 'historicalCards', cardId);
        await deleteDoc(historicalCardRef);
        console.log(`[Debug] Deleted historical card ${cardId} from board ${boardId} for user ${userId}`);
    } catch (error) {
        console.error(`[Debug] Error deleting historical card ${cardId} from board ${boardId}:`, error);
    }
} 
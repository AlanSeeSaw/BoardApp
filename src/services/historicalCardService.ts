import { Firestore, doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { CardType, BoardType, HistoricalCardType, AggregatedTimeInColumn } from '../types';
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
    cardToSave: CardType,
    board: BoardType,
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

        const historicalCardData: HistoricalCardType = {
            id: cardToSave.id,
            title: cardToSave.title,
            description: cardToSave.description,
            priority: cardToSave.priority,
            type: cardToSave.type,
            labels: cardToSave.labels || [],
            checklist: cardToSave.checklist || [],
            dueDate: cardToSave.dueDate || null,

            originalBoardId: board.id,
            boardTitle: board.title || '',

            aggregatedTimeInColumns: aggregatedTime,

            // Carry over any other relevant fields
            codebaseContext: cardToSave.codebaseContext,
            devTimeEstimate: cardToSave.devTimeEstimate,
            llmTimeEstimate: cardToSave.llmTimeEstimate,
        };

        // Remove undefined properties before saving to Firestore
        Object.keys(historicalCardData).forEach(key => {
            const k = key as keyof HistoricalCardType;
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
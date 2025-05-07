import { CardType, ColumnType, AggregatedTimeInColumn, CardTimeInColumn } from '../types';
import { Timestamp } from 'firebase/firestore';

/**
 * Converts a Date, number (timestamp), string (date string), or Firestore Timestamp to milliseconds since epoch.
 * Returns 0 if the input is null, undefined, or an invalid date string.
 */
function getMs(dateValue: Date | number | Timestamp | string | null | undefined): number {
    if (dateValue === null || dateValue === undefined) return 0;
    if (dateValue instanceof Timestamp) return dateValue.toMillis();
    if (dateValue instanceof Date) return dateValue.getTime();
    if (typeof dateValue === 'number') return dateValue; // Assuming it's already in ms
    if (typeof dateValue === 'string') {
        const date = new Date(dateValue);
        if (!isNaN(date.getTime())) { // Check if the parsed date is valid
            return date.getTime();
        }
    }
    return 0; // Fallback for invalid date strings or other unhandled types
}

/**
 * Calculates the total time a card has spent in each column based on its movement history.
 *
 * @param card The card object, containing timeInColumns and currentColumnId.
 * @param boardColumns An array of all columns on the board, used to get column names.
 * @param actionTimestamp The timestamp of the action (e.g., deletion) that triggers this calculation.
 *                        This is used as the exit time for the column the card was in when the action occurred.
 * @returns An array of AggregatedTimeInColumn objects.
 */
export function calculateAggregatedTimeInColumns(
    card: CardType,
    boardColumns: ColumnType[],
    actionTimestamp: Timestamp
): AggregatedTimeInColumn[] {
    console.log(`[Debug] Calculating aggregated time for card: ${card.id} at action timestamp:`, actionTimestamp.toDate());

    const aggregatedTimes: { [key: string]: { totalDurationMs: number; columnName: string } } = {};
    const actionTimeMs = getMs(actionTimestamp);
    console.log(`[Debug] Action time: ${actionTimeMs}`);


    if (card.timeInColumns && card.timeInColumns.length > 0) {
        card.timeInColumns.forEach((entry: CardTimeInColumn) => {
            console.log(`[Debug] entry: ${entry}`);
            console.log(`[Debug] enteredAt: ${entry.enteredAt}. exitedAt: ${entry.exitedAt}.`);
            const enteredAtMs = getMs(entry.enteredAt);
            let exitedAtMs = getMs(entry.exitedAt);

            // If exitedAt is not set and this entry is for the card's current column,
            // it means the card was in this column when the action (e.g., deletion) occurred.
            // So, use the actionTimestamp as the exit time.
            if (!entry.exitedAt && entry.columnId === card.currentColumnId) {
                exitedAtMs = actionTimeMs;
            }

            // If exitedAt is still 0 (e.g. for current column if card.currentColumnId was not set or matched, or malformed entry)
            // and this IS the current column according to card.currentColumnId, we still use actionTimeMs
            // This is a fallback if entry.exitedAt was null and entry.columnId didn't match for some reason but it is the current one.
            if (exitedAtMs === 0 && entry.columnId === card.currentColumnId) {
                exitedAtMs = actionTimeMs;
            }

            if (enteredAtMs > 0 && exitedAtMs > 0 && exitedAtMs >= enteredAtMs) {
                const durationMs = exitedAtMs - enteredAtMs;
                const column = boardColumns.find(col => col.id === entry.columnId);
                const columnName = column ? column.title : 'Unknown Column';

                if (aggregatedTimes[entry.columnId]) {
                    aggregatedTimes[entry.columnId].totalDurationMs += durationMs;
                } else {
                    aggregatedTimes[entry.columnId] = { totalDurationMs: durationMs, columnName };
                }
                console.log(`[Debug] Card ${card.id}, Column ${columnName} (${entry.columnId}): entered ${new Date(enteredAtMs).toISOString()}, exited ${new Date(exitedAtMs).toISOString()}, duration ${durationMs}ms`);
            } else {
                console.warn(`[Debug] Card ${card.id}, Column ${entry.columnId}: Invalid time entry. Entered: ${enteredAtMs}, Exited: ${exitedAtMs}`);
            }
        });
    } else {
        console.warn(`[Debug] Card ${card.id} has no timeInColumns data.`);
    }

    const result: AggregatedTimeInColumn[] = Object.entries(aggregatedTimes).map(([columnId, data]) => ({
        columnId,
        columnName: data.columnName,
        totalDurationMs: data.totalDurationMs,
    }));

    console.log(`[Debug] Card ${card.id} aggregated time calculation result:`, result);
    return result;
} 
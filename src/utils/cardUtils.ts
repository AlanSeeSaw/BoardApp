import { Card, Column, AggregatedTimeInColumn, CardTimeInColumn } from '../types';
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
    card: Card,
    boardColumns: Column[],
    actionTimestamp: Timestamp
): AggregatedTimeInColumn[] {

    const aggregatedTimes: { [key: string]: { totalDurationMs: number; columnName: string } } = {};
    const actionTimeMs = getMs(actionTimestamp);

    if (card.timeInColumns && card.timeInColumns.length > 0) {
        card.timeInColumns.forEach((entry: CardTimeInColumn) => {
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

    return result;
} 

/**
 * Formats the time duration (in milliseconds) as a human-readable string
 */
export const formatTimeDuration = (durationMs: number): string => {
    const days = Math.floor(durationMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((durationMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
  
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };
  
  /**
   * Calculates the total time spent in all columns
   */
  export const calculateTotalTimeInColumns = (card: Card): number => {
    if (!card.timeInColumns || card.timeInColumns.length === 0) return 0;
  
    const now = new Date().getTime();
  
    return card.timeInColumns.reduce((total, record) => {
      // If we have a pre-calculated duration, use it
      if (typeof record.durationMs === 'number') {
        return total + record.durationMs;
      }
  
      // Calculate duration based on entry and exit times
      const enteredAt = record.enteredAt instanceof Date ?
        record.enteredAt.getTime() :
        typeof record.enteredAt === 'number' ? record.enteredAt : new Date(record.enteredAt).getTime();
  
      const exitedAt = record.exitedAt ?
        (record.exitedAt instanceof Date ? record.exitedAt.getTime() :
          typeof record.exitedAt === 'number' ? record.exitedAt : new Date(record.exitedAt).getTime()) :
        now;
  
      return total + (exitedAt - enteredAt);
    }, 0);
  };
  
  /**
   * Calculates time since the card was last moved between columns
   * @param card The card to check
   * @returns Time in milliseconds since last movement, or null if no movement history exists
   */
  export const calculateTimeSinceLastMove = (card: Card): number => {
    if (!card.movementHistory || card.movementHistory.length === 0) {
      return calculateTotalTimeInColumns(card);
    }
  
    // Find the most recent movement
    const lastMove = card.movementHistory.reduce((latest, current) => {
      const currentMoveTime = current.movedAt instanceof Date ?
        current.movedAt.getTime() :
        new Date(current.movedAt).getTime();
  
      const latestMoveTime = latest.movedAt instanceof Date ?
        latest.movedAt.getTime() :
        new Date(latest.movedAt).getTime();
  
      return currentMoveTime > latestMoveTime ? current : latest;
    }, card.movementHistory[0]);
  
    // Calculate time difference between now and the last move
    const lastMoveTime = lastMove.movedAt instanceof Date ?
      lastMove.movedAt.getTime() :
      new Date(lastMove.movedAt).getTime();
  
    const now = new Date().getTime();
    return now - lastMoveTime;
  };
  
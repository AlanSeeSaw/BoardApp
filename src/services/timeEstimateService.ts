import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import { Card as CardType, TimeEstimate } from '../types';

export interface TimeEstimatePayload {
    user_id: string;
    board_id: string;
    card: CardType;
    codebase_context: string;
    columns: { id: string; title: string; description?: string }[];
}

// Initialize the callable function
const timeEstimateFn = httpsCallable<TimeEstimatePayload, TimeEstimate>(
    functions,
    'card_time_estimate'
);

// Export a convenient function to call it
export const getTimeEstimate = (payload: TimeEstimatePayload) => {
    return timeEstimateFn(payload);
}; 
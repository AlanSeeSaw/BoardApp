import { User as FirebaseUser } from 'firebase/auth';
import { FieldValue, Timestamp } from 'firebase/firestore';

// User types - support both Firebase User and simplified version
export type FirebaseUserType = FirebaseUser;

export interface User {
  id: string;
  email: string;
  name: string;
}

// Enums and simple types
export type Priority = 'emergency' | 'normal' | 'date-sensitive' | 'low' | 'medium' | 'high';
export type IssueType = 'bug' | 'task' | 'feature';

// Add column categories for workflow stages
export type ColumnCategory =
  | 'dpq'              // Dynamic Prioritization Queue
  | 'prioritized'      // Prioritized Queue
  | 'design'           // Planning/Design 
  | 'doing'            // Coding/Implementation
  | 'codeReview'       // Code Review
  | 'qa'               // QA Testing
  | 'readyForUAT'      // Ready for UAT
  | 'uat'              // UAT Testing
  | 'readyForRelease'  // Ready for Release
  | 'done';            // Done

export interface CardLabel {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

// 🆕 Card movement history
export interface CardMovement {
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  movedAt: Date;
  movedBy: User["name"];
}

// 🆕 Time spent in columns
export interface CardTimeInColumn {
  columnId: string;
  enteredAt: Date;
  exitedAt: Date | null; // null if still in the column
  durationMs?: number;   // optional precomputed duration
}

// 🆕 Aggregated time spent in columns for historical records
export interface AggregatedTimeInColumn {
  columnId: string;
  columnName: string;
  totalDurationMs: number;
}

// 🆕 New types for LLM time estimates
export interface ColumnEstimate {
  estimate: number;
  justification?: string;
}
export interface TimeEstimate {
  total: number;
  justification: string;
  columns: Record<string, ColumnEstimate>;
}

export interface Card {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  type: IssueType;
  createdAt: Date;
  updatedAt: Date;
  dueDate: string | Date | number | null; // TODO: determine typing
  labels?: CardLabel[];
  checklist?: ChecklistItem[];
  assignedUsers?: User["id"][];

  // 🆕 Card tracking data
  currentColumnId: string;
  movementHistory?: CardMovement[];
  timeInColumns?: CardTimeInColumn[];

  // 🆕 Additional fields for development tracking
  codebaseContext?: string;
  devTimeEstimate?: string;

  // 🆕 Optional LLM time estimates per column and total
  timeEstimate?: TimeEstimate | null;
}

export interface Column {
  id: string;
  title: string;
  category?: ColumnCategory;
  wipLimit: number;
  isCollapsed?: boolean;
  isExpedite?: boolean;
  cardIds: string[];
  timeEstimationEnabled?: boolean;
  description?: string;
}

// Typing used for all boards (useBoards.ts).
// Has board metadata for all shared and owned boards.
// Any fields that are marked with a ? are not populated for owned boards.
export interface Boards {
  id: string; // The Board ID
  title: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;

  isShared?: boolean; // For convience, to know if the board is shared or owned. Only stored locally.

  // All fields below are only populated for shared boards (if isShared is true)
  originalBoardPath?: string; // Used for shared boards fields
  sharedOn?: Date;
  recipientEmail?: string; // The email of the recipient
}
// Ensure Board and BoardMetadata are in sync
export interface Board {
  id: string;
  title: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;

  users: User[];
  cards: {
    [cardId: string]: Card;
  };
  columns: Column[];
  archivedCards: Card[];
}

// TODO: Theoeritecally I need to update all the subtypes to use timestamp instead of Date. TBD
export interface FirebaseBoard {
  id: string;
  title: string;
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  users: User[];
  cards: {
    [cardId: string]: Card;
  };
  columns: Column[];
  archivedCards: Card[];
}

// 🆕 Historical Card Type for long-term storage and analysis
export interface HistoricalCard {
  id: string; // Original card ID
  title: string;
  description: string;
  priority: Priority;
  type: IssueType;
  labels?: CardLabel[];
  checklist?: ChecklistItem[];
  dueDate?: string | Date | number | null;
  aggregatedTimeInColumns: AggregatedTimeInColumn[];
  codebaseContext?: string;
  devTimeEstimate?: string;
  timeEstimate?: TimeEstimate;
}

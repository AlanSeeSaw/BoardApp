import { User as FirebaseUser } from 'firebase/auth';

// User types - support both Firebase User and simplified version
export type FirebaseUserType = FirebaseUser;

export interface User {
  uid: string;
  email: string;
  displayName: string;
  name?: string;
  id?: string;
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
  movedBy: string;
}

// 🆕 Time spent in columns
export interface CardTimeInColumn {
  columnId: string;
  enteredAt: Date | number; // Allow for timestamp numbers too
  exitedAt?: Date | number; // null if still in the column
  durationMs?: number;   // optional precomputed duration
}

export interface CardType {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  type: IssueType;
  created: Date | number;
  updated: Date | number;
  dueDate?: string | Date | number | null;
  labels?: CardLabel[];
  checklist?: ChecklistItem[];
  isSelected?: boolean;
  archived?: boolean;
  assignedUsers?: string[]; 

  // 🆕 Card tracking data
  currentColumnId: string;
  movementHistory?: CardMovement[];
  timeInColumns?: CardTimeInColumn[];
  
  // 🆕 Additional fields for development tracking
  codebaseContext?: string;
  devTimeEstimate?: string;
  llmTimeEstimate?: string;
}

export interface ColumnType {
  id: string;
  title: string;
  category?: ColumnCategory;
  wipLimit: number; 
  isCollapsed?: boolean;
  isExpedite?: boolean;
  cardIds: string[]; // Make required (not optional) to fix TypeScript errors
}

export interface Activity {
  id: string;
  cardId: string;
  action: string;
  timestamp: Date | number;
  userName?: string;
}

export interface BoardMetadata {
  id: string;
  title: string;
  createdAt: Date | number;
  updatedAt: Date | number;
  isShared?: boolean;
  ownerEmail?: string;
  ownerName?: string;
  ownerUid?: string;
  originalBoardPath?: string;
}

export interface BoardSharing {
  userId?: string;
  email: string;
  role: 'viewer' | 'editor' | 'admin';
  addedAt: Date | number;
}

export interface BoardType {
  id: string;
  title: string;
  ownerId: string;
  cards: {
    [cardId: string]: CardType;
  };
  columns: ColumnType[];
  archivedCardIds: string[];
  activities: Activity[];
  shared?: string[];
  ownerEmail?: string;
  ownerName?: string;
  originalBoardPath?: string;
  users: User[];
  lastMoveTimestamp?: number;
  clientTimestamp?: number;
  archivedCards?: CardType[];
  movementHistory?: CardMovement[];
}

// Aliases for backward compatibility
export type Card = CardType;
export type Column = ColumnType;
export type Board = BoardType;

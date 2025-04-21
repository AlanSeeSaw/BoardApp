import { BoardType, IssueType, Priority } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const ISSUE_TYPES: IssueType[] = ['task', 'bug', 'feature'];

export const PRIORITIES: Priority[] = [
  'normal', 
  'low', 
  'high', 
  'emergency', 
  'date-sensitive'
];

export const initialBoard: BoardType = {
  id: '',  // This will be set when creating a new board
  title: '',  // This will be set when creating a new board
  ownerId: '',
  
  // Normalized structure - cards mapped by their IDs
  cards: {},
  
  // Columns with cardIds instead of embedded cards
  columns: [
    {
      id: 'column-dpq',
      title: 'DPQ',
      cardIds: [],
      wipLimit: Infinity,
    },
    {
      id: 'column-prioritized',
      title: 'Prioritized',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-design',
      title: 'Design',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-coding',
      title: 'Coding (Doing)',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-code-review',
      title: 'Code Review',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-qa',
      title: 'QA',
      cardIds: [],
      wipLimit: 2,
    },
    {
      id: 'column-ready-for-uat',
      title: 'Ready For UAT',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-uat',
      title: 'UAT',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-ready-for-release',
      title: 'Ready For Release',
      cardIds: [],
      wipLimit: 5,
    },
    {
      id: 'column-done',
      title: 'Done',
      cardIds: [],
      wipLimit: 0,
    }
  ],
  

  // IDs for archived cards
  archivedCardIds: [],
  
  activities: [],
  clientTimestamp: Date.now(),
  users: [],
  
  // For backward compatibility (can be removed later)

  archivedCards: []
};
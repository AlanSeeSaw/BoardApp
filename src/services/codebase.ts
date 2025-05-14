import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export interface CodebaseQueryPayload {
  card: string;
  repo_name: string;
  repo_owner: string;
}

export interface CodebaseQueryResponse {
  [key: string]: any; // adjust to match your function's response shape
}

// Initialize the callable function
const codebaseQueryFn = httpsCallable<CodebaseQueryPayload, CodebaseQueryResponse>(
  functions,
  'codebase_context'
);

// Export a convenient function to call it
export const codebaseQuery = (payload: CodebaseQueryPayload) => {
  return codebaseQueryFn(payload);
}; 
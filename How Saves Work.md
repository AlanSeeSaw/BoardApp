# How Saves Work

This document summarizes all the ways the application persists board data to Firestore and local state, explains when each mechanism runs, and gives guidance on which pattern to use for various UI actions.

---

## Overview

We have three primary layers for persisting boards:

- **Local React state**: via `setBoard(...)`. This updates in-memory data only.
- **One-off writes**: via `saveToFirebase(...)` from the `useBoard` hook. Writes the full board snapshot.
- **Debounced, diff-aware writes**: via `saveBoard(...)` from the `useSaveBoard` hook. Computes minimal diffs and merges updates.

Additionally, `updateBoardInFirebase(...)` is a small helper that calls `setBoard` + `saveBoard()` for convenience.

---

## useBoard & `saveToFirebase`

**Location**: `src/hooks/useBoard.ts`

- `useBoard(user, boardId, isShared)` returns:
  - `board`, `setBoard`, `loading`, `error` etc.
  - `saveToFirebase(forceSave?: boolean)`

**Behavior**:
- Always serializes the entire board via `prepareForFirebase(board)`.
- On `forceSave === true`: uses `setDoc(docRef, boardData, { merge: true })`.
- Otherwise uses `updateDoc(docRef, boardData)`.

**When it runs**:
- Called manually in a few edge cases, for example:
  - After adding a new card (`addCard` calls `saveToFirebase()` in a `setTimeout`).
  - On emergency/unmount via snapshot listener logic.

**Pros/Cons**:
- **Pros**: Simple, always sends a full, clean snapshot.
- **Cons**: No diffing or throttling; can be heavy on writes if used for high-frequency UI events.

---

## useSaveBoard & `saveBoard`

**Location**: `src/hooks/useSaveBoard.ts`

- `useSaveBoard(board, user, savingDisabled, firebaseBlocked, boardId, localVersion, isShared)` returns:
  - `isSaving`, `hasUnsavedChanges`, `saveBoard(force?: boolean)`, `forceSave()`, `forceUIUpdate()`, etc.

**Behavior**:
1. **Fingerprinting**: computes two fingerprints:
   - **Columns**: via `getColumnStructure(columns)` (now includes `id`, `title`, `wipLimit`, `isExpedite`, `cardIds`, **`timeEstimationEnabled`**, **`description`**).
   - **Cards**: via `getCardsFingerprint(cards)` (JSON of title/description/priority/type/dueDate/etc.).
2. **Debounce/Throttle**:
   - Debounced: waits 2s after last change (or shorter for "important" changes).
   - Throttled: at most once every 5s unless `force`.
3. **Save logic**:
   - Compares new fingerprints to last-saved refs; if identical and not forced, skips.
   - Builds a minimal `updates` object containing changed sections:
     - `columns` via `sanitizeForFirebase(boardToSave.columns)`
     - `cards` if changed
     - `archivedCardIds`, `archivedCards`, `movementHistory` per card, metadata (`title`, `lastUpdated`, etc.)
   - Performs `await setDoc(docRef, updates, { merge: true })`.
   - Updates refs and dispatches UI refresh events.

**When it runs**:
- Automatically by React effects whenever `board` changes.
- Manually via `saveBoard(true)` or `forceSave()`.

**Pros/Cons**:
- **Pros**: Efficient (only diffs), throttled to avoid spamming Firestore, merges partial updates, auto-runs.
- **Cons**: More complexity in fingerprint logic; fields must be represented in `getColumnStructure` to trigger saves.

---

## useBoardManagement & `updateBoardInFirebase`

**Location**: `src/hooks/useBoardManagement.ts`

- `useBoardManagement(...)` exposes:
  - `handleCreateBoard(...)`
  - `updateBoardInFirebase(updatedBoard, setBoard, saveBoard)`

**Behavior**:
- Simply calls:
  ```ts
  setBoard(updatedBoard);
  if (saveBoard) saveBoard();
  ```

**When it runs**:
- Used by the App for explicit UI actions like "Project Settings → Save" or board title changes.

**Pros/Cons**:
- **Pros**: Very simple wrapper around the ideal pattern.
- **Cons**: None; it delegates to the `useSaveBoard` machinery.

---

## saveCardMovementHistory

**Location**: `src/hooks/useSaveBoard.ts` (exported at bottom)

- `saveCardMovementHistory(user, boardId, isSharedBoard, cardId, movements)`

**Behavior**:
- Sanitizes a single card's `movementHistory` entries.
- Performs a merged `setDoc` updating only the nested path:
  ```js
  { cards: { [cardId]: { movementHistory, hasMovementHistory: true } }, lastUpdated }
  ```

**When to use**:
- Called immediately after a drag-drop to ensure movement history writes quickly, without waiting for the main debounce.

---

## When to Use Which Pattern

| Action                                  | Method                                    | Notes                                         |
|-----------------------------------------|-------------------------------------------|-----------------------------------------------|
| High-frequency UI updates (drag/drop)   | `saveBoard()` via `useSaveBoard`          | Auto-debounced, minimal diffs                 |
| Explicit user action (e.g. settings panel) | `updateBoardInFirebase(...)` or `saveBoard(true)` | Delegates to `useSaveBoard`, fingerprint aware |
| One-off full snapshot (e.g. card add)   | `saveToFirebase()`                        | Sends entire board, no diffing                |
| Movement history only                   | `saveCardMovementHistory(...)`            | Writes just nested history path               |
| Emergency/unmount                       | `forceSave()`                             | Immediate, bypasses debounce                  |

---

## Implementation Details & Tips

- **`sanitizeForFirebase`**: cleans undefined, dates → ISO, deep-cleans arrays/objects.
- **`deepCleanForFirebase`**: final pass to remove `undefined` and convert `Date`.
- Always use `merge: true` on `setDoc` to preserve other fields.
- **Fingerprint sync**: if you add new column/card fields, reflect them in `getColumnStructure` or `getCardFingerprint` to have them auto-detect changes.

---

That should give you a clear map of how data flows from UI to Firestore and which helper functions to invoke. Mind the fingerprinters whenever you add new board schema fields! 
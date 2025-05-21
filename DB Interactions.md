# Interacting with the Database in BoardApp

This guide explains, in simple terms, how developers should interact with the database (Firestore) in BoardApp. Follow these steps and best practices to keep the app fast, reliable, and easy to maintain.

---

## 1. Local State is King

- **All board data lives in local React state.**
- The app uses two main hooks:
  - `useBoard` for the currently active board (full board data)
  - `useBoards` for the list of all boards (just metadata)
- **Never update the database directly from components.** Always use the functions provided by these hooks.

---

## 2. How Updates Work (The Flow)

1. **User does something in the UI** (like editing a column title).
2. **A function from the hook is called** (e.g., `updateColumnTitle`).
3. **The hook updates local state immediately** (optimistic update) so the UI feels fast.
4. **The hook then calls a service function** (e.g., `BoardService.updateColumns`) and passes only the variables needed for the update (not the whole board, and not a Firestore update object).
5. **The service function crafts the Firestore update** and writes it to the DB, using best practices (like field-level updates and server timestamps).
6. **Firestore auto-syncs changes back to the app.** If the DB update fails, the UI will eventually resync with the server.

---

## 3. Separation of Concerns

- **Hooks**: Handle all business logic, state updates, and optimistic UI changes.
- **Service functions**: Only talk to Firestore. They never recompute business logic or fetch extra data. They just write what they're told.
    - The only times they write business logic is when we are not doing optimistic updates (ex. sharing a board with a user)
- **Components**: Only use local state from hooks. Never talk to Firestore or service functions directly.

---

## 4. Best Practices

- **Always use the service layer** for DB writes. Never put Firestore logic in hooks or components.
- **Do the smallest update possible**: Only update the field(s) that changed, not the whole object (use Firestore dot notation for maps/objects).
- **Arrays must be replaced as a whole**: Firestore can't update a single array element by index. Always send the new array.
- **Always use optimistic updates**: Update local state first, then persist to Firestore.
- **Prop drill updaters** from hooks to components as needed.
- **Never fetch the board snapshot in the service** if you already did an optimistic update in the hook.

---

## 5. Example: Updating a Column Title

1. User edits a column title in the UI.
2. The `updateColumnTitle` function from `useBoard` is called.
3. The hook creates a new columns array with the updated title and updates local state.
4. The hook calls `BoardService.updateColumns(newColumns)`.
5. The service writes the new columns array to Firestore, using a server timestamp.
6. Firestore syncs the change back to the app.

---

## 6. Why This Matters

- **Fast UI**: Users see changes instantly (optimistic updates).
- **Reliable data**: Firestore is always the source of truth, and the app auto-syncs.
- **Easy to maintain**: All DB logic is in one place (the service layer), and all business logic is in the hooks.

---

## TL;DR
- Use the hook functions to update state.
- Hooks update local state and then call service functions to update Firestore.
- Service functions only write what they're given, using field-level updates.
- The app always uses local state, which auto-syncs with Firestore.

**Follow this pattern for all DB interactions in BoardApp!** 
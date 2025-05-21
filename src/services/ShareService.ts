import { doc, getDoc, DocumentReference, setDoc, updateDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Boards, User } from '../types';

export const ShareService = {
    async getSharedBoardDocRef(
        userEmail: string,
        boardId: string
    ): Promise<DocumentReference> {
        const sharedBoardRef = doc(db, "sharedBoards", userEmail.toLowerCase(), "boards", boardId);
        const sharedBoard = await getDoc(sharedBoardRef);
        const originalBoardPath = sharedBoard.data()?.originalBoardPath;
        return doc(db, originalBoardPath);
    },

    async setBoardAccess(
        newUserEmails: string[],
        owner: User,
        boardId: string,
        boardTitle: string
    ): Promise<void> {
        // Normalize emails and remove duplicates, and filter out owner's email
        const normalizedInviteeEmails = Array.from(new Set(newUserEmails.map(email => email.toLowerCase()))).filter(email => email !== owner.email.toLowerCase());
        const originalBoardPath = `users/${owner.id}/boards/${boardId}`;
        const originalBoardRef = doc(db, originalBoardPath);

        // 1. Create/update shared board entry for each user
        for (const email of normalizedInviteeEmails) {
            const sharedBoardEntryRef = doc(db, "sharedBoards", email, "boards", boardId);
            const sharedBoardEntry = {
                id: boardId,
                title: boardTitle,
                ownerId: owner.id,
                ownerEmail: owner.email,
                ownerName: owner.name,
                createdAt: serverTimestamp() as any,
                updatedAt: serverTimestamp() as any,
                originalBoardPath: originalBoardPath, // Path to the actual board document
                boardTitle: boardTitle,
                sharedAt: serverTimestamp() as any,
                sharedBy: owner.email,
            } as Boards;
            await setDoc(sharedBoardEntryRef, sharedBoardEntry);
        }

        // 2. Remove shared board entries for users no longer in the list
        // Fetch current users from the board
        const boardSnap = await getDoc(originalBoardRef);
        if (!boardSnap.exists()) return;
        const currentUsers = boardSnap.data().users || [];
        const currentEmails: string[] = currentUsers.map((u: any) => String(u.email).toLowerCase());
        const emailsToRemove = currentEmails.filter((email: string) => email !== owner.email.toLowerCase() && !normalizedInviteeEmails.includes(email));
        for (let i = 0; i < emailsToRemove.length; i++) {
            const email: string = emailsToRemove[i];
            const sharedBoardEntryRef = doc(db, "sharedBoards", email, "boards", boardId);
            await deleteDoc(sharedBoardEntryRef);
        }

        // 3. Overwrite the users array with the owner and all shared users
        // TODO: when we refactor sharing system, this needs to change "of default shii"
        const newUsers = [owner, ...normalizedInviteeEmails.map(email => ({ email, id: email, name: email }))];
        await updateDoc(originalBoardRef, { users: newUsers });
    },
}; 
import { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { User, Boards } from '../types';
import { BoardService } from '../services/BoardService';
import { ShareService } from '../services/ShareService';

export const useBoards = (user: User | null) => {
    const [ownedBoards, setOwnedBoards] = useState<Boards[]>([]);
    const [sharedBoards, setSharedBoards] = useState<Boards[]>([]);
    const [combinedBoards, setCombinedBoards] = useState<Boards[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Listener for owned boards
    useEffect(() => {
        if (!user) {
            setOwnedBoards([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const boardsRef = collection(db, `users/${user.id}/boards`);
        const q = query(boardsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const boardsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    isShared: false,
                    ownerId: user.id,
                    ownerEmail: user.email,
                    ownerName: user.name,
                } as Boards;
            });
            setOwnedBoards(boardsData);
        }, (err) => {
            console.error("Error fetching owned boards:", err);
            setOwnedBoards([]);
        });

        return () => unsubscribe();
    }, [user]);

    // Listener for shared boards
    useEffect(() => {
        if (!user) {
            setSharedBoards([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const sharedBoardsPath = `sharedBoards/${user.email}/boards`;
        const sharedBoardsRef = collection(db, sharedBoardsPath);
        const q = query(sharedBoardsRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const boardsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title,
                    createdAt: data.createdAt,
                    updatedAt: data.updatedAt,
                    isShared: true,
                    ownerEmail: data.ownerEmail,
                    ownerName: data.ownerName,
                    ownerId: data.ownerId,
                    originalBoardPath: data.originalBoardPath,
                    sharedOn: data.sharedOn,
                    recipientEmail: data.recipientEmail,
                } as Boards;
            });
            setSharedBoards(boardsData);
        }, (err) => {
            console.error("Error fetching shared boards:", err);
            setSharedBoards([]);
        });

        return () => unsubscribe();
    }, [user]);

    // Combine and de-duplicate owned and shared boards
    useEffect(() => {
        const allBoardsMap = new Map<string, Boards>();

        ownedBoards.forEach(board => allBoardsMap.set(board.id, board));
        sharedBoards.forEach(board => {
            if (!allBoardsMap.has(board.id)) {
                allBoardsMap.set(board.id, board);
            }
        });

        setCombinedBoards(Array.from(allBoardsMap.values()));
        setLoading(false);
    }, [ownedBoards, sharedBoards]);

    // For optimistic updates, we should update the combined boards I think

    const createNewBoard = useCallback(async (boardName: string) => {
        if (!user || !boardName) {
            console.error("User information is missing for createNewBoardOnList");
            return null;
        }

        try {
            setLoading(true);
            const newBoardId = await BoardService.createBoard(boardName, user);
            return newBoardId;
        } catch (e: any) {
            console.error("Failed to create new board:", e);
            return null;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const setBoardAccess = useCallback(async (newUserEmails: string[], owner: User, boardId: string, boardTitle: string) => {
        if (!user || !boardId || !boardTitle) {
            console.error("Current user email is missing, cannot invite.");
            return false;
        }

        try {
            setLoading(true);
            console.log("Setting board access for users (ONLY THESE):", newUserEmails, owner, boardId, boardTitle);
            await ShareService.setBoardAccess(newUserEmails, owner, boardId, boardTitle);
            return true;
        } catch (e) {
            console.error("Failed to invite user:", e);
            return false;
        } finally {
            setLoading(false);
        }
    }, [user]);

    return {
        boards: combinedBoards,
        loading,
        createNewBoard,
        setBoardAccess,
    };
}; 
import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import './App.css';
import Board from './components/Board/Board';
import StatsPanel from './components/StatsPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import Auth from './components/Auth';
import { useBoard } from './hooks/useBoard';
import { useSaveBoard, saveCardMovementHistory } from './hooks/useSaveBoard';
import { useAuth } from './hooks/useAuth';
import Card from './components/Cards/Card';
import { ModalProvider } from './context/ModalContext';
import { v4 as uuidv4 } from 'uuid';
import BoardDialog from './components/BoardDialog';
import BoardSharingComponent from './components/BoardSharing';
import { BoardType, ColumnType } from './types';
import { initializeCardTracking } from './utils/CardMovement';
import Header from './components/Header/Header';
import { useBoardSharing } from './hooks/useBoardSharing';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useBoardManagement } from './hooks/useBoardManagement';
import ChatOverlay from './components/ChatOverlay/ChatOverlay';
import ChatToggleButton from './components/ChatOverlay/ChatToggleButton';

function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [savingDisabled, setSavingDisabled] = useState(false);
  const [firebaseBlocked, setFirebaseBlocked] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isBoardDialogOpen, setIsBoardDialogOpen] = useState(false);
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [openAIApiKey, setOpenAIApiKey] = useState('');

  const { user, authChecked } = useAuth();

  // Use the board sharing hook
  const {
    availableBoards,
    isSharedBoard,
    currentBoardId,
    fetchBoards,
    handleBoardSelection,
    debugCheckSharedBoards,
    refreshBoard,
    forceRefreshSharedBoard
  } = useBoardSharing(user);

  // Use the board hook
  const { board, setBoard, loading, updateCard, saveToFirebase } = useBoard(user, currentBoardId, isSharedBoard);

  // Use the save board hook
  const { isSaving, hasUnsavedChanges, saveBoard } = useSaveBoard(
    board,
    user,
    savingDisabled,
    firebaseBlocked,
    currentBoardId,
    undefined,
    isSharedBoard
  );

  // Use the board management hook
  const { handleCreateBoard, updateBoardInFirebase } = useBoardManagement(
    user,
    availableBoards,
    currentBoardId,
    setIsBoardDialogOpen,
    (boards) => {
      fetchBoards();
    },
    (boardId) => handleBoardSelection(boardId)
  );

  // Log activity function
  const logActivity = useCallback((cardId: string, action: string) => {
    if (!board.id) return;
    const timestamp = new Date();
    const activity = {
      id: uuidv4(),
      cardId,
      action,
      timestamp
    };
  }, [board.id]);

  // Helper function to save card movement history
  const handleSaveCardMovementHistory = useCallback(async (cardId: string, movements: any[] | undefined) => {
    return saveCardMovementHistory(user, currentBoardId, isSharedBoard, cardId, movements);
  }, [user, currentBoardId, isSharedBoard]);

  // Use the drag and drop hook
  const {
    activeDragId,
    activeCard,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDragAndDrop(board, setBoard, saveBoard, handleSaveCardMovementHistory, logActivity);

  // Sensors for drag and drop
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }));

  // Theme effect
  useEffect(() => {
    localStorage.setItem('kanbanTheme', theme);
    document.body.className = theme;
  }, [theme]);

  // Fetch boards effect
  useEffect(() => {
    if (!user) return;
    fetchBoards();
  }, [fetchBoards, user]);

  // Debug check shared boards effect
  useEffect(() => {
    if (user?.email) {
      // Small delay to ensure Firebase is initialized
      const timer = setTimeout(() => {
        debugCheckSharedBoards();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, debugCheckSharedBoards]);

  // Periodically refresh shared boards effect
  useEffect(() => {
    if (!isSharedBoard) return;

    const refreshInterval = setInterval(() => {
      forceRefreshSharedBoard(board, setBoard);
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [isSharedBoard, forceRefreshSharedBoard, board, setBoard]);

  // Initialize card tracking effect
  useEffect(() => {
    if (board && !loading) {
      // Initialize tracking data for cards that don't have it yet
      const updatedBoard = initializeCardTracking(board);

      // Only update if changes were made
      if (updatedBoard !== board) {
        console.log('Initializing card tracking data');
        setBoard(updatedBoard);

        // Optionally, save to Firebase after initialization
        if (saveBoard) {
          setTimeout(() => saveBoard(), 100);  // Small delay to ensure state is updated
        }
      }
    }
  }, [board, loading, setBoard, saveBoard]);

  // Force update effect
  useEffect(() => {
    const forceUpdateHandler = (e: Event) => {
      // Force update by creating a new board object
      setBoard(prev => ({ ...prev, _appForceUpdate: Date.now() }));
    };

    window.addEventListener('cardSaved', forceUpdateHandler);
    return () => window.removeEventListener('cardSaved', forceUpdateHandler);
  }, [setBoard]);

  // Get filtered board function
  const getFilteredBoard = (board: BoardType, searchTerm: string): BoardType => {
    const lowercaseSearch = searchTerm.toLowerCase();
    return {
      ...board,
      columns: board.columns.map(column => ({
        ...column,
        cardIds: column.cardIds.filter(cardId => {
          const card = board.cards[cardId];
          return card &&
            (showArchived || !card.archived) &&
            (card.title.toLowerCase().includes(lowercaseSearch) ||
              card.description.toLowerCase().includes(lowercaseSearch));
        })
      }))
    };
  };

  // Toggle card selection function
  const toggleCardSelection = (cardId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedCards(prev => [...prev, cardId]);
    } else {
      setSelectedCards(prev => prev.filter(id => id !== cardId));
    }
  };

  // Load API key from localStorage or environment
  useEffect(() => {
    const savedApiKey = localStorage.getItem('openai_api_key');
    if (savedApiKey) {
      setOpenAIApiKey(savedApiKey);
    } else if (process.env.REACT_APP_OPENAI_API_KEY) {
      setOpenAIApiKey(process.env.REACT_APP_OPENAI_API_KEY);
    }
  }, []);

  // Toggle chat overlay
  const toggleChat = useCallback(() => {
    if (!isChatOpen && !openAIApiKey) {
      // If no API key is set, prompt the user to enter one
      const apiKey = prompt('Please enter your OpenAI API key to use the AI assistant:');
      if (apiKey) {
        localStorage.setItem('openai_api_key', apiKey);
        setOpenAIApiKey(apiKey);
        setIsChatOpen(true);
      }
    } else {
      setIsChatOpen(prev => !prev);
    }
  }, [isChatOpen, openAIApiKey]);

  // Handler to save project settings
  const handleSaveSettings = (updatedColumns: ColumnType[]) => {
    const updatedBoard = { ...board, columns: updatedColumns };
    console.log('updatedBoard FOR SETTINGS', updatedBoard);
    updateBoardInFirebase(updatedBoard, setBoard, saveBoard);
    setShowSettings(false);
  };

  // If still checking authentication, show loading
  if (!authChecked) {
    return (
      <div className={`App ${theme}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // If authentication check is complete and user is not logged in, show the Auth component
  if (authChecked && !user) {
    return (
      <div className={`App ${theme}`}>
        <Auth />
      </div>
    );
  }

  return (
    <div className={`App ${theme}`}>
      <Header
        theme={theme}
        setTheme={setTheme}
        showStats={showStats}
        setShowStats={setShowStats}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currentBoardId={currentBoardId}
        handleBoardSelection={handleBoardSelection}
        availableBoards={availableBoards}
        setIsBoardDialogOpen={setIsBoardDialogOpen}
        setIsSharingDialogOpen={setIsSharingDialogOpen}
        isSharedBoard={isSharedBoard}
        user={user}
      />

      {/* Board Dialog Modal */}
      <BoardDialog
        isOpen={isBoardDialogOpen}
        onClose={() => setIsBoardDialogOpen(false)}
        onCreateBoard={handleCreateBoard}
      />

      {/* Board Sharing Modal */}
      {isSharingDialogOpen && currentBoardId && (
        <div className="modal-backdrop">
          <div className="modal">
            <BoardSharingComponent
              board={board}
              boardId={currentBoardId}
              onClose={() => setIsSharingDialogOpen(false)}
              refreshBoard={() => refreshBoard(board, setBoard)}
            />
          </div>
        </div>
      )}

      <ModalProvider
        board={board}
        setBoard={setBoard}
        logActivity={logActivity}
        saveToFirebase={saveToFirebase}
        saveBoard={saveBoard}
        updateCard={updateCard}
      >
        <main className="main-content">
          {showSettings && (
            <ProjectSettingsPanel
              board={board}
              onSave={handleSaveSettings}
              onClose={() => setShowSettings(false)}
            />
          )}
          {showStats && <StatsPanel board={board} />}

          {isSharedBoard && (
            <div className="shared-board-indicator">
              <span className="shared-icon">🔗</span>
              <span>Shared Board </span>
              {board.ownerEmail ? (
                <span className="owner-info">Owned by: {board.ownerEmail}</span>
              ) : (
                <span className="owner-info">Shared with you</span>
              )}
            </div>
          )}

          {availableBoards.length === 0 ? (
            <div className="empty-board-state">
              <h2>No boards available</h2>
              <p>Create a new board to get started with your tasks</p>
              <button
                className="primary-button"
                onClick={() => setIsBoardDialogOpen(true)}
              >
                Create Board
              </button>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragEnd={handleDragEnd}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              autoScroll={true}
            >
              <Board
                board={searchTerm ? getFilteredBoard(board, searchTerm) : getFilteredBoard(board, "")}
                setBoard={setBoard}
                selectedCards={selectedCards}
                toggleCardSelection={toggleCardSelection}
                logActivity={logActivity}
                activeDragId={activeDragId}
                showArchived={showArchived}
                updateBoardInFirebase={(updatedBoard: BoardType) =>
                  updateBoardInFirebase(updatedBoard, setBoard, saveBoard)}
                saveBoard={saveBoard}
                updateCard={updateCard}
              />

              {/* Improved DragOverlay component */}
              <DragOverlay adjustScale={false} zIndex={9999} dropAnimation={null}>
                {activeCard && (
                  <div className="drag-overlay-wrapper">
                    <Card
                      card={activeCard}
                      isSelected={selectedCards.includes(activeCard.id)}
                      toggleSelection={toggleCardSelection}
                      isDragging={true}
                      activeDragId={activeDragId}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </main>
      </ModalProvider>

      {/* Add the chat toggle button and overlay */}
      {user && !loading && (
        <>
          <ChatToggleButton onClick={toggleChat} isOpen={isChatOpen} />
          <ChatOverlay
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            boardData={board}
            apiKey={openAIApiKey}
          />
        </>
      )}
    </div>
  );
}

export default App;


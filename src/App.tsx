import React, { useState, useEffect, useCallback } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import './App.css';
import Board from './components/Board/Board';
import StatsPanel from './components/StatsPanel';
import ProjectSettingsPanel from './components/ProjectSettingsPanel';
import Auth from './components/Auth';
import { useBoard } from './hooks/useBoard';
import { useBoards } from './hooks/useBoards';
import { useAuth } from './hooks/useAuth';
import Card from './components/Cards/Card';
import { ModalProvider } from './context/ModalContext';
import CreateBoard from './components/CreateBoard';
import type { Board as BoardType, Column } from './types';
import Header from './components/Header/Header';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import ChatOverlay from './components/ChatOverlay/ChatOverlay';
import ChatToggleButton from './components/ChatOverlay/ChatToggleButton';
import BoardSharing from './components/BoardSharing';

function App() {
  const [showStats, setShowStats] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isSharingDialogOpen, setIsSharingDialogOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  const { user, authChecked } = useAuth();

  // Get all boards available to the user
  const { boards, createNewBoard } = useBoards(user);

  // Get the current board from the list of boards available to the user
  // Pick the first board if no current board is selected (aka on first load)
  useEffect(() => {
    if (boards.length > 0 && !currentBoardId) {
      setCurrentBoardId(boards[0].id);
    }
  }, [boards, currentBoardId]);

  // Load the current board
  const activeBoard = boards.find(b => b.id === currentBoardId);
  const isSharedBoard = activeBoard?.isShared ?? false; // TODO: default value being false is a type hack, figure out later
  const { board, loading, updateColumns, updateUserInfoToBoard, updateBoardTitle, deleteColumn, updateColumnTitle, addColumn, addCard, updateCard, deleteCard, archiveCard, restoreCard, moveCard } = useBoard(user, currentBoardId, isSharedBoard);

  // Only update board user info once when board loads and user data differs
  useEffect(() => {
    if (user && board) {
      const existing = board.users.find(u => u.email === user.email);
      if (existing && (existing.id !== user.id || existing.name !== user.name)) {
        updateUserInfoToBoard(user);
      }
    }
  }, [user, board, updateUserInfoToBoard]);

  // Sensors for drag and drop
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }));

  // Use the drag and drop hook with moveCardOnBoard
  const {
    activeDragId,
    activeCard,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useDragAndDrop(board, moveCard);

  // Function to search board
  const getFilteredBoard = (board: BoardType, searchTerm: string): BoardType => {
    const lowercaseSearch = searchTerm.toLowerCase();
    // TODO: revisit this logic with archived cards. need to figure out how the search results will be displayed with archived cards.
    return {
      ...board,
      columns: board.columns.map(column => ({
        ...column,
        cardIds: column.cardIds.filter(cardId => {
          const card = board.cards[cardId];
          return card &&
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
  const handleSaveProjectSettings = (updatedColumns: Column[]) => {
    updateColumns(updatedColumns);
    setShowSettings(false);
  };
  // If checking auth
  if (!authChecked) {
    return (
      <div className={`App`}>
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
      <div className={`App`}>
        <Auth />
      </div>
    );
  }

  return (
    <div className={`App`}>
      <Header
        showStats={showStats}
        setShowStats={setShowStats}
        showArchived={showArchived}
        setShowArchived={setShowArchived}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currentBoardId={currentBoardId}
        updateActiveBoard={(boardId: string) => { boardId === "" ? setCurrentBoardId(null) : setCurrentBoardId(boardId) }}
        availableBoards={boards}
        setIsCreateBoardOpen={setIsCreateBoardOpen}
        setIsSharingDialogOpen={setIsSharingDialogOpen}
        isSharedBoard={isSharedBoard}
        user={user}
      />

      {/* TODO: refactor createBoard and BoardSharing into Header */}

      {/* Board Dialog Modal */}
      <CreateBoard
        isOpen={isCreateBoardOpen}
        onClose={() => setIsCreateBoardOpen(false)}
        onCreateBoard={createNewBoard}
      />

      {/* Board Sharing Modal */}
      {isSharingDialogOpen && currentBoardId && board && (
        <div className="modal-backdrop">
          <div className="modal">
            <BoardSharing
              board={board}
              boardId={currentBoardId}
              onClose={() => setIsSharingDialogOpen(false)}
              updateBoardTitle={updateBoardTitle}
            />
          </div>
        </div>
      )}

      {/* Show empty state if no boards are available */}
      {boards.length === 0 ? (
        <div className="empty-board-state">
          <h2>No boards available</h2>
          <p>Create a new board to get started with your tasks</p>
          <button
            className="primary-button"
            onClick={() => setIsCreateBoardOpen(true)}
          >
            Create Board
          </button>
        </div>
      ) : (
        board && (
          <ModalProvider board={board} updateCard={updateCard} deleteCard={deleteCard} archiveCard={archiveCard}>
            <main className="main-content">
              {showSettings && (
                <ProjectSettingsPanel
                  board={board}
                  onSave={handleSaveProjectSettings}
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

              <DndContext
                sensors={sensors}
                onDragEnd={handleDragEnd}
                onDragStart={handleDragStart}
                onDragCancel={handleDragCancel}
                autoScroll={true}
              >
                <Board
                  board={searchTerm ? getFilteredBoard(board, searchTerm) : board}
                  selectedCards={selectedCards}
                  toggleCardSelection={toggleCardSelection}
                  activeDragId={activeDragId}
                  showArchived={showArchived}
                  deleteColumn={deleteColumn}
                  updateColumnTitle={updateColumnTitle}
                  addColumn={addColumn}
                  addCard={addCard}
                  restoreCard={restoreCard}
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
            </main>
          </ModalProvider>
        )
      )}

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


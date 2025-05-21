import React from 'react';
import { SearchBar } from '../Board/SearchBar';
import { Boards, User } from '../../types';
import './Header.css';
import { useBoard } from '../../hooks/useBoard';

interface HeaderProps {
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentBoardId: string | null;
  updateActiveBoard: (boardId: string) => void;
  availableBoards: Boards[];
  setIsCreateBoardOpen: (isOpen: boolean) => void;
  setIsSharingDialogOpen: (isOpen: boolean) => void;
  isSharedBoard: boolean;
  user: User | null;
}

const Header: React.FC<HeaderProps> = ({
  showStats,
  setShowStats,
  showArchived,
  setShowArchived,
  showSettings,
  setShowSettings,
  searchTerm,
  setSearchTerm,
  currentBoardId,
  updateActiveBoard,
  availableBoards,
  setIsCreateBoardOpen,
  setIsSharingDialogOpen,
  isSharedBoard,
  user
}) => {
  const { updateUserInfoToBoard } = useBoard(user, currentBoardId, isSharedBoard);
  // TODO: Refactor at some point. this is just a workaround for the bad sharing system
  const handleUpdateActiveBoard = (boardId: string) => {
    updateActiveBoard(boardId);
    updateUserInfoToBoard(user!);
  }

  return (
    <header className="App-header">
      <div className="header-content">
        <div className="header-left">
          <select
            value={currentBoardId ?? ''}
            onChange={(e) => handleUpdateActiveBoard(e.target.value)}
            className={`board-selector`}
          >
            <option value="">Select a board...</option>
            {availableBoards.map((board) => (
              <option
                key={`board-${board.id}`}
                value={board.id}
              >
                {board.title} {board.isShared ? '(Shared)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsCreateBoardOpen(true)}
            className={`header-button`}
          >
            + New Board
          </button>
          {currentBoardId && !isSharedBoard && (
            <button
              onClick={() => setIsSharingDialogOpen(true)}
              className={`header-button`}
            >
              Share Board
            </button>
          )}
        </div>
        <div className={`header-right`}>
          <div className={`header-controls`}>
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} />
            <button
              className={`header-button ${showArchived ? 'active' : ''}`}
              onClick={() => setShowArchived(!showArchived)}
              title={showArchived ? "Hide archived cards" : "Show archived cards"}
            >
              {showArchived ? "Hide Archived" : "Show Archived"}
            </button>
            <button
              className={`header-button ${showStats ? 'active' : ''}`}
              onClick={() => setShowStats(!showStats)}
              title={showStats ? "Hide stats panel" : "Show stats panel"}
            >
              {showStats ? "Hide Stats" : "Show Stats"}
            </button>
            <button
              className={`header-button ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title={showSettings ? "Hide Project Settings" : "Show Project Settings"}
            >
              {showSettings ? "Hide Settings" : "Settings"}
            </button>
          </div>
          {user && (
            <div className="user-info">
              <span className="user-email">{user.email}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

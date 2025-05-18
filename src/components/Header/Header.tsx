import React from 'react';
import { SearchBar } from '../Board/SearchBar';
import { BoardMetadata, User } from '../../types';
import './Header.css';

interface HeaderProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  showStats: boolean;
  setShowStats: (show: boolean) => void;
  showArchived: boolean;
  setShowArchived: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentBoardId: string;
  handleBoardSelection: (boardId: string) => void;
  availableBoards: BoardMetadata[];
  setIsBoardDialogOpen: (isOpen: boolean) => void;
  setIsSharingDialogOpen: (isOpen: boolean) => void;
  isSharedBoard: boolean;
  user: User | null;
}

const Header: React.FC<HeaderProps> = ({
  theme,
  setTheme,
  showStats,
  setShowStats,
  showArchived,
  setShowArchived,
  showSettings,
  setShowSettings,
  searchTerm,
  setSearchTerm,
  currentBoardId,
  handleBoardSelection,
  availableBoards,
  setIsBoardDialogOpen,
  setIsSharingDialogOpen,
  isSharedBoard,
  user
}) => {
  return (
    <header className="App-header">
      <div className="header-content">
        <div className="header-left">
          <select
            value={currentBoardId}
            onChange={(e) => handleBoardSelection(e.target.value)}
            className={`board-selector ${theme}`}
          >
            <option value="">Select a board...</option>
            {availableBoards.map((board) => (
              <option
                key={`board-${board.id}${board.isShared ? '-shared' : ''}`}
                value={board.id}
              >
                {board.title} {board.isShared ? '(Shared)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={() => setIsBoardDialogOpen(true)}
            className={`header-button ${theme}`}
          >
            + New Board
          </button>
          {currentBoardId && !isSharedBoard && (
            <button
              onClick={() => setIsSharingDialogOpen(true)}
              className={`header-button ${theme}`}
            >
              Share Board
            </button>
          )}
        </div>
        <div className={`header-right ${theme}`}>
          <div className={`header-controls ${theme}`}>
            <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} theme={theme} />
            <button
              className={`header-button ${showArchived ? 'active' : ''} ${theme}`}
              onClick={() => setShowArchived(!showArchived)}
              title={showArchived ? "Hide archived cards" : "Show archived cards"}
            >
              {showArchived ? "Hide Archived" : "Show Archived"}
            </button>
            <button
              className={`header-button ${showStats ? 'active' : ''} ${theme}`}
              onClick={() => setShowStats(!showStats)}
              title={showStats ? "Hide stats panel" : "Show stats panel"}
            >
              {showStats ? "Hide Stats" : "Show Stats"}
            </button>
            <button
              className={`header-button ${showSettings ? 'active' : ''} ${theme}`}
              onClick={() => setShowSettings(!showSettings)}
              title={showSettings ? "Hide Project Settings" : "Show Project Settings"}
            >
              {showSettings ? "Hide Settings" : "Settings"}
            </button>
            <button
              className={`header-button ${theme}`}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              {theme === 'dark' ? "Light Mode" : "Dark Mode"}
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

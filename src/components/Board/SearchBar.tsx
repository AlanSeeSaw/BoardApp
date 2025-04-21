import React from 'react';
import './SearchBar.css';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  theme?: 'dark' | 'light';
}

export const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm, theme = 'dark' }) => {
  const handleClear = () => {
    setSearchTerm('');
  };

  return (
    <div className={`search-container ${theme}`}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search cards..."
        className={`search-input ${theme}`}
        aria-label="Search cards"
      />
      {searchTerm && (
        <button 
          onClick={handleClear} 
          className={`clear-button ${theme}`}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};
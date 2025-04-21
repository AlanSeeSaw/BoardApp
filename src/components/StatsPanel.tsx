import React from 'react';
import { Board } from '../types';
import { formatTimeDuration } from '../utils/CardMovement';

interface StatsPanelProps {
  board: Board;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ board }) => {
  // Calculate total cards using the card IDs rather than the cards array
  const totalCards = board.columns.reduce((total, col) => total + col.cardIds.length, 0);
  
  // Use archivedCardIds instead of archivedCards for the normalized structure
  const totalArchivedCards = board.archivedCardIds ? board.archivedCardIds.length : 0;
  
  // Get cards per column using cardIds
  const cardsPerColumn = board.columns.map(col => ({ 
    name: col.title, 
    count: col.cardIds.length 
  }));
  
  // Get the latest activities (up to 10)
  const recentActivities = board.activities?.slice(0, 10) || [];

  return (
    <div className="stats-panel">
      <h2>Board Statistics</h2>
      
      <div className="stats-section">
        <h3>Card Counts</h3>
        <p>Total Active Cards: {totalCards}</p>
        <p>Archived Cards: {totalArchivedCards}</p>
      </div>
      
      <div className="stats-section">
        <h3>Cards per Column</h3>
        <ul className="column-stats">
          {cardsPerColumn.map((col, index) => (
            <li key={index}>
              <span className="column-name">{col.name}:</span> {col.count} cards
            </li>
          ))}
        </ul>
      </div>
      
      <div className="stats-section">
        <h3>Recent Activity</h3>
        {recentActivities.length > 0 ? (
          <ul className="activity-list">
            {recentActivities.map(activity => (
              <li key={activity.id}>
                <span className="activity-time">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
                <span className="activity-action">{activity.action}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No recent activity</p>
        )}
      </div>
      
      <div className="stats-section">
        <h3>Cycle Time Analytics</h3>
        
        {/* Average time cards spend in each column */}
        <div className="stat-group">
          <h4>Average Time in Columns</h4>
          {board.columns.map(column => {
            // Calculate average time for all cards that have been in this column
            const cardsWithTimeInColumn = Object.values(board.cards).filter(
              card => card.timeInColumns?.some(t => t.columnId === column.id)
            );
            
            const totalTime = cardsWithTimeInColumn.reduce((total, card) => {
              const timeRecords = card.timeInColumns?.filter(t => t.columnId === column.id) || [];
              const columnTime = timeRecords.reduce((sum, record) => {
                if (record.durationMs) return sum + record.durationMs;
                
                const start = record.enteredAt instanceof Date ? 
                  record.enteredAt.getTime() : 
                  new Date(record.enteredAt).getTime();
                  
                const end = record.exitedAt ? 
                  (record.exitedAt instanceof Date ? record.exitedAt.getTime() : new Date(record.exitedAt).getTime()) : 
                  new Date().getTime();
                  
                return sum + (end - start);
              }, 0);
              
              return total + columnTime;
            }, 0);
            
            const avgTime = cardsWithTimeInColumn.length > 0 ? 
              totalTime / cardsWithTimeInColumn.length : 
              0;
            
            return (
              <div key={column.id} className="stat-item">
                <span>{column.title}:</span>
                <span>{formatTimeDuration(avgTime)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StatsPanel; 
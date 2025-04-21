import React from 'react';
import { ColumnType } from '../../types';

interface ColumnCapacityProps {
  column: ColumnType;
}

const ColumnCapacity: React.FC<ColumnCapacityProps> = ({ column }) => {
  const { cardIds, wipLimit } = column;
  const count = cardIds.length;
  
  // If no WIP limit is set, return a simple indicator
  if (!wipLimit || wipLimit === Infinity) {
    return <div className="column-capacity-container">
      <span className="text-xs text-gray-500">No limit</span>
    </div>;
  }
  
  // Calculate percentage of capacity used
  const percentage = Math.min((count / wipLimit) * 100, 100);
  
  // Determine color based on capacity
  const getColor = () => {
    if (percentage < 70) return 'green';
    if (percentage < 90) return 'yellow';
    return 'red';
  };

  // Status text based on capacity
  const getStatusText = () => {
    if (percentage < 70) return 'Available';
    if (percentage < 90) return 'Filling up';
    if (percentage < 100) return 'Almost full';
    return 'At capacity';
  };

  return (
    <div className="column-capacity-container">
      <div className="capacity-header">
        <span>{count}/{wipLimit} cards</span>
        <span>{getStatusText()}</span>
      </div>
      <div className="capacity-bar">
        <div 
          className={`capacity-fill ${getColor()}`} 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ColumnCapacity;
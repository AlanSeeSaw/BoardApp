import React, { useEffect, useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';

interface DragDropContextWrapperProps {
  onDragEnd: (result: DropResult) => void;
  children: React.ReactNode;
}

const DragDropContextWrapper: React.FC<DragDropContextWrapperProps> = ({ onDragEnd, children }) => {
  // This is a workaround for React 18 StrictMode
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // This is needed for react-beautiful-dnd to work in StrictMode
    const animation = requestAnimationFrame(() => setEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {children}
    </DragDropContext>
  );
};

export default DragDropContextWrapper; 
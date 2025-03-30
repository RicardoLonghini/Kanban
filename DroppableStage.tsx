import React from 'react';
import { useDroppable } from "@dnd-kit/core";


interface DroppableStageProps {
  id: string;
  children: React.ReactNode;
}

export default function DroppableStage({ id, children }: DroppableStageProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
    data: {
      type: 'stage',
      id: id
    }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[200px] p-2 rounded transition-colors ${
        isOver ? 'bg-blue-50 border-2 border-blue-300' : 'bg-gray-50'
      }`}
      style={{ position: 'relative' }}
    >
      {children}
    </div>
  );
}
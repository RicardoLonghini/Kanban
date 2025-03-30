import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/lib/api';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onComplete?: () => void;
}

export default function TaskCard({ task, onClick, onComplete }: TaskCardProps) {
  console.log('[DEBUG] Renderizando TaskCard para tarefa:', task);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ 
    id: `task-${task.id}`,
    data: {
      type: 'task',
      task
    }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  // Determinar a cor de fundo com base no status
  const getBgColor = () => {
    switch (task.status) {
      case 'em_andamento':
        return 'bg-yellow-100';
      case 'concluido':
        return 'bg-green-100';
      default:
        return 'bg-white';
    }
  };
  
  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onComplete) {
      onComplete();
    }
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`${getBgColor()} p-3 rounded shadow-sm border border-gray-200 hover:shadow cursor-grab active:cursor-grabbing mb-2`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-2">
        <p className="font-medium">Tarefa #{task.id} (Ordem #{task.ordem_id})</p>
        <div>
          {task.status === 'concluido' ? (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              Concluída
            </span>
          ) : onComplete ? (
            <button
              onClick={handleComplete}
              className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              Concluir
            </button>
          ) : null}
        </div>
      </div>
      <p className="text-sm text-gray-600">
        Descrição: {task.descricao || 'N/A'}
      </p>
      <p className="text-sm text-gray-600">
        Quantidade: {task.quantidade || 'N/A'}
      </p>
      {task.funcionario_id && (
        <p className="text-sm text-gray-600">
          Funcionário: #{task.funcionario_id}
        </p>
      )}
    </div>
  );
} 
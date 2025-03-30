import React, { useState, useEffect } from 'react';
import TaskCard from './TaskCard';
import { Task, Order } from '@/lib/api';

interface TasksViewProps {
  stageId: number;
  tasks?: Task[];
  orders?: Order[];
  onTaskClick?: (task: Task) => void;
  onTaskComplete?: (taskId: number) => void;
}

export default function TasksView({ stageId, tasks: propTasks, orders, onTaskClick, onTaskComplete }: TasksViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (propTasks) {
      console.log(`[DEBUG] TasksView recebeu ${propTasks.length} tarefas, filtrando para etapa ${stageId}`);
      
      // Verificar se há tarefas para esta etapa
      const filteredTasks = propTasks.filter(task => task.etapa_id === stageId);
      
      console.log(`[DEBUG] Após filtro: ${filteredTasks.length} tarefas para etapa ${stageId}`);
      console.log('[DEBUG] Tarefas filtradas:', filteredTasks);
      
      setTasks(filteredTasks);
    } else {
      const fetchTasks = async () => {
        setLoading(true);
        try {
          const response = await fetch(`/api/tasks?etapa_id=${stageId}`);
          const data = await response.json();
          console.log(`[DEBUG] Buscou ${data.length} tarefas da API para etapa ${stageId}`);
          setTasks(data);
        } catch (error) {
          console.error('[DEBUG] Erro ao buscar tarefas:', error);
        } finally {
          setLoading(false);
        }
      };
      
      fetchTasks();
    }
  }, [stageId, propTasks]);
  
  // Log fora do JSX
  console.log(`[DEBUG] TasksView renderizando ${tasks.length} tarefas para etapa ${stageId}`);
  
  // Log das tarefas que serão renderizadas
  if (tasks.length > 0) {
    console.log('[DEBUG] Renderizando lista de tarefas:', tasks);
  }
  
  // Filtrar apenas tarefas não concluídas desta etapa
  const stageTasks = tasks.filter(task => 
    task.etapa_id === stageId && 
    task.status !== 'concluido'  // Apenas tarefas não concluídas
  );

  return (
    <div className="space-y-2">
      {loading ? (
        <p>Carregando tarefas...</p>
      ) : stageTasks.length === 0 ? (
        <p className="text-gray-500 text-sm italic">
          Não há tarefas pendentes nesta etapa
        </p>
      ) : (
        stageTasks.map((task) => {
          // Encontrar a ordem correspondente
          const order = orders?.find(o => o.id === task.ordem_id);
          
          return (
            <TaskCard 
              key={task.id} 
              task={task}
              onClick={onTaskClick ? () => onTaskClick(task) : undefined}
              onComplete={onTaskComplete ? () => onTaskComplete(task.id) : undefined}
            />
          );
        })
      )}
    </div>
  );
}
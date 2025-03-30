"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { 
  DndContext, 
  DragEndEvent, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import OrdersView from '../components/Ordersview';
import EmployeesView from '../components/EmployeesView';
import DroppableStage from '../components/DroppableStage';
import TasksView from '../components/TasksView';
import CreateParallelTasksModal from '../components/CreateParallelTasksModal';
import { api } from '../lib/api';
import dynamic from 'next/dynamic';

const DndContextWithNoSSR = dynamic(
  () => import('@dnd-kit/core').then(mod => mod.DndContext),
  { ssr: false }
);

interface Stage {
  id: number;
  nome: string;
  status: string;
  setor: string; // 'inicio', 'producao', ou 'expedicao'
  capacidade_alocada: number;
  capacidade_necessaria: number;
}

interface Order {
  id: number;
  OS: number;
  cliente_final: string;
  produto: string;
  estampa: string;
  quantidade: number;
  data_entrega: string;
  etapa: string;
  etapa_id: number;
}

interface Employee {
  id: number;
  nome: string;
  etapa: string;
  etapa_id: number;
  producao_media: number;
}

interface Task {
  id: number;
  ordem_id: number;
  OS?: number;
  produto?: string;
  estampa?: string;
  data_entrega?: string;
  etapa_id: number;
  etapa_nome?: string;
  descricao: string;
  quantidade: number;
  status: string;
  data_criacao?: string;
  data_atualizacao?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState('orders');
  const [stages, setStages] = useState<Stage[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [viewMode, setViewMode] = useState<'orders' | 'tasks'>('orders');
  const [showCreateTasksModal, setShowCreateTasksModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stagesData, ordersData, employeesData, tasksData] = await Promise.all([
          api.fetchStages(),
          api.fetchOrders(),
          api.fetchEmployees(),
          api.fetchTasks()
        ]);
        
        setStages(stagesData as Stage[]);
        setOrders(ordersData as Order[]);
        setEmployees(employeesData as Employee[]);
        setTasks(tasksData as Task[]);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    
    fetchData();
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    // Extrair IDs
    const activeId = active.id.toString();
    const overId = over.id.toString();
    
    // Verificar se é um arrastar de ordem
    if (activeId.startsWith('order-') && overId.startsWith('stage-')) {
      const orderId = parseInt(activeId.replace('order-', ''));
      const newStageId = parseInt(overId.replace('stage-', ''));
      
      // Encontrar a ordem
      const order = orders.find(o => o.id === orderId);
      const stage = stages.find(s => s.id === newStageId);
      
      if (!order || !stage) return;
      
      // Verificar se a ordem tem tarefas
      const orderTasks = tasks.filter(t => t.ordem_id === orderId);
      
      if (orderTasks.length > 0) {
        // Verificar se todas as tarefas estão concluídas
        const allTasksCompleted = orderTasks.every(t => t.status === 'concluido');
        
        if (!allTasksCompleted) {
          alert('Não é possível mover esta ordem para a próxima etapa. Todas as tarefas devem estar concluídas.');
          return;
        }
      }
      
      // Se não houver tarefas ou todas estiverem concluídas, permitir a movimentação
      try {
        console.log(`Movendo ordem ${orderId} para etapa ${newStageId}`);
        
        // Atualizar no backend
        await api.updateOrder(orderId, { etapa_id: newStageId });
        
        // Atualizar estado local
        const updatedOrder = { ...order, etapa_id: newStageId };
        setOrders(prev => 
          prev.map(o => 
            o.id === orderId ? updatedOrder : o
          )
        );

        // Se a etapa de destino for "Producao", abrir o modal de dividir automaticamente
        if (stage.nome === 'Producao') {
          console.log('Abrindo modal para dividir ordem:', updatedOrder);
          setSelectedOrder(updatedOrder);
          setShowCreateTasksModal(true);
        }
      } catch (error) {
        console.error('Erro ao mover ordem:', error);
        alert('Erro ao mover ordem. Verifique o console para mais detalhes.');
      }
    }
    
    // Verificar se é um arrastar de tarefa
    else if (activeId.startsWith('task-') && overId.startsWith('stage-')) {
      const taskId = parseInt(activeId.replace('task-', ''));
      const newStageId = parseInt(overId.replace('stage-', ''));
      
      try {
        console.log(`Movendo tarefa ${taskId} para etapa ${newStageId}`);
        
        // Atualizar no backend
        await api.updateTask(taskId, { etapa_id: newStageId });
        
        // Atualizar estado local
        setTasks(prev => 
          prev.map(t => 
            t.id === taskId ? { ...t, etapa_id: newStageId } : t
          )
        );
      } catch (error) {
        console.error('Erro ao mover tarefa:', error);
        alert('Erro ao mover tarefa. Verifique o console para mais detalhes.');
      }
    }
  };
 
  const handleOpenCreateTasksModal = (order: Order) => {
    console.log("Abrindo modal para ordem:", order);
    setSelectedOrder(order);
    setShowCreateTasksModal(true);
  };

  const handleCreateTasks = async (orderId: number, tasksToCreate: Array<{
    descricao: string;
    etapa_id: number;
    quantidade: number;
  }>) => {
    try {
      console.log("Criando tarefas para ordem:", orderId, tasksToCreate);
      const createdTasks = await api.createOrderTasks(orderId, tasksToCreate);
      setTasks(prev => [...prev, ...createdTasks]);
      
      // Encontrar a etapa "Producao"
      const producaoStage = stages.find(s => s.nome === 'Producao');
      
      if (producaoStage) {
        // Mover a ordem para a etapa "Producao"
        await api.updateOrder(orderId, { etapa_id: producaoStage.id });
        
        // Atualizar o estado local
        setOrders(prev => 
          prev.map(o => 
            o.id === orderId ? { ...o, etapa_id: producaoStage.id } : o
          )
        );
      }
      
      setShowCreateTasksModal(false);
      setSelectedOrder(null);
      
      // Recarregar tarefas após criar novas
      const allTasks = await api.fetchTasks();
      setTasks(allTasks);
    } catch (error) {
      console.error('Erro ao criar tarefas:', error);
      alert('Erro ao criar tarefas. Verifique o console para mais detalhes.');
    }
  };
  const MAIN_STAGES = ['OS no email', 'OS na fabrica', 'Producao', 'Embalagem', 'Romaneio'];
  const PRODUCTION_SUB_STAGES = ['Fechar fronha', 'Bainha lencol', 'Elastico', 'Cortar canto', 'Bainha fronha'];

  const handleUpdateTaskStatus = async (taskId: number, status: string) => {
    try {
      console.log(`Atualizando status da tarefa ${taskId} para ${status}`);
      const updatedTask = await api.updateTask(taskId, { status });
      
      // Atualiza o estado local
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? { ...task, status } : task
        )
      );
      
      // Opcional: mostrar uma mensagem de sucesso
      if (status === 'concluido') {
        alert('Tarefa concluída com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao atualizar status da tarefa:', error);
      alert('Erro ao atualizar status da tarefa. Verifique o console para mais detalhes.');
    }
  };

  const openCreateTasksModal = (order: Order) => {
    console.log("Abrindo modal para ordem:", order);
    setSelectedOrder(order);
    setShowCreateTasksModal(true);
  };

  const checkAndMoveCompletedOrders = useCallback(async () => {
    // Encontrar a etapa "Embalagem"
    const embalagemStage = stages.find(s => s.nome === 'Embalagem');
    if (!embalagemStage) return;

    // Para cada ordem na etapa "Producao"
    const producaoStage = stages.find(s => s.nome === 'Producao');
    if (!producaoStage) return;

    const ordersInProducao = orders.filter(o => o.etapa_id === producaoStage.id);
    
    for (const order of ordersInProducao) {
      // Verificar se todas as tarefas desta ordem estão concluídas
      const orderTasks = tasks.filter(t => t.ordem_id === order.id);
      const allTasksCompleted = orderTasks.length > 0 && orderTasks.every(t => t.status === 'concluido');
      
      if (allTasksCompleted) {
        console.log(`Todas as tarefas da ordem #${order.OS} foram concluídas. Movendo para Embalagem.`);
        
        try {
          // Atualizar no backend
          await api.updateOrder(order.id, { etapa_id: embalagemStage.id });
          
          // Atualizar estado local
          setOrders(prev => 
            prev.map(o => 
              o.id === order.id ? { ...o, etapa_id: embalagemStage.id } : o
            )
          );
        } catch (error) {
          console.error('Erro ao mover ordem para Embalagem:', error);
        }
      }
    }
  }, [orders, tasks, stages]);

  useEffect(() => {
    // Verificar quando o componente montar
    checkAndMoveCompletedOrders();
    
    // Também verificar sempre que as tarefas forem atualizadas
    const intervalId = setInterval(checkAndMoveCompletedOrders, 5000); // Verificar a cada 5 segundos
    
    return () => clearInterval(intervalId);
  }, [checkAndMoveCompletedOrders]);

  const handleTaskComplete = async (taskId: number) => {
    try {
      // Atualizar a tarefa no backend
      await api.updateTask(taskId, { status: 'concluido' });
      
      // Atualizar o estado local
      setTasks(prev => 
        prev.map(t => 
          t.id === taskId ? { ...t, status: 'concluido' } : t
        )
      );
      
      // Verificar se todas as tarefas da ordem foram concluídas
      const completedTask = tasks.find(t => t.id === taskId);
      if (completedTask) {
        const orderTasks = tasks.filter(t => t.ordem_id === completedTask.ordem_id);
        const allTasksCompleted = orderTasks.every(t => 
          t.id === taskId ? true : t.status === 'concluido'
        );
        
        if (allTasksCompleted) {
          // Encontrar a ordem
          const order = orders.find(o => o.id === completedTask.ordem_id);
          if (order) {
            // Encontrar a etapa "Embalagem"
            const embalagemStage = stages.find(s => s.nome === 'Embalagem');
            if (embalagemStage) {
              console.log(`Todas as tarefas da ordem #${order.OS} foram concluídas. Movendo para Embalagem.`);
              
              // Atualizar no backend
              await api.updateOrder(order.id, { etapa_id: embalagemStage.id });
              
              // Atualizar estado local
              setOrders(prev => 
                prev.map(o => 
                  o.id === order.id ? { ...o, etapa_id: embalagemStage.id } : o
                )
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao concluir tarefa:', error);
      alert('Erro ao concluir tarefa. Verifique o console para mais detalhes.');
    }
  };

  const handleMoveToEmbalagem = async (orderId: number) => {
    try {
      // Encontrar a ordem
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        console.error(`Ordem com ID ${orderId} não encontrada`);
        return;
      }
      
      // Encontrar a etapa "Embalagem"
      const embalagemStage = stages.find(s => s.nome === 'Embalagem');
      if (!embalagemStage) {
        console.error(`Etapa 'Embalagem' não encontrada`);
        return;
      }
      
      // Atualizar no backend
      await api.updateOrder(orderId, { etapa_id: embalagemStage.id });
      
      // Atualizar estado local
      setOrders(prev => 
        prev.map(o => 
          o.id === orderId ? { ...o, etapa_id: embalagemStage.id } : o
        )
      );
      
      alert(`Ordem #${order.OS} movida para Embalagem com sucesso!`);
    } catch (error) {
      console.error('Erro ao mover ordem para Embalagem:', error);
      alert('Erro ao mover ordem para Embalagem. Verifique o console para mais detalhes.');
    }
  };

  // Função para renderizar o conteúdo da etapa
  const renderStageContent = (stage: Stage) => {
    // Log antes de renderizar
    const tasksForCurrentStage = tasks.filter(t => t.etapa_id === stage.id);
    console.log(`[DEBUG] Renderizando conteúdo para etapa ${stage.id} (${stage.nome}) com ${tasksForCurrentStage.length} tarefas`);
    
    // Retornar o componente apropriado
    if (viewMode === 'orders') {
      return (
        <OrdersView
          orders={orders.filter(order => order.etapa_id === stage.id)}
          stageId={stage.id}
          onCreateTasks={handleOpenCreateTasksModal}
          tasks={tasks}
          onMoveToEmbalagem={handleMoveToEmbalagem}
        />
      );
    } else {
      return (
        <TasksView 
          stageId={stage.id}
          tasks={tasks}
          orders={orders}
          onTaskClick={(task) => {
            // Implemente a lógica que deseja quando uma tarefa é clicada
            console.log('Tarefa clicada:', task);
            // Por exemplo, abrir um modal de detalhes da tarefa
            // ou marcar como concluída
          }}
          onTaskComplete={handleTaskComplete}
        />
      );
    }
  };

  return (
    <main className="min-h-screen p-4">
      <div className="mb-6">
        <div className="flex space-x-4 mb-4">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded ${
              activeTab === 'orders' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Ordens de Serviço
          </button>
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-4 py-2 rounded ${
              activeTab === 'employees' ? 'bg-blue-600 text-white' : 'bg-gray-200'
            }`}
          >
            Funcionários
          </button>
          
          {activeTab === 'orders' && (
            <div className="ml-auto flex space-x-4">
              <button
                onClick={() => setViewMode('orders')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'orders' ? 'bg-green-600 text-white' : 'bg-gray-200'
                }`}
              >
                Ver Ordens
              </button>
              <button
                onClick={() => setViewMode('tasks')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'tasks' ? 'bg-green-600 text-white' : 'bg-gray-200'
                }`}
              >
                Ver Tarefas
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'orders' && (
        <DndContextWithNoSSR 
          sensors={sensors} 
          collisionDetection={closestCorners} 
          onDragEnd={handleDragEnd}
        >
          {viewMode === 'orders' ? (
            // Visualização de Ordens - mostrar apenas etapas principais
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {stages
                .filter(stage => MAIN_STAGES.includes(stage.nome))
                .map(stage => (
                  <div key={stage.id} className="bg-white rounded-lg shadow p-4">
                    <h2 className="text-lg font-bold mb-2">{stage.nome}</h2>
                    <DroppableStage id={`stage-${stage.id}`}>
                      {renderStageContent(stage)}
                    </DroppableStage>
                  </div>
                ))}
            </div>
          ) : (
            // Visualização de Tarefas - mostrar apenas etapas de produção
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-800">Detalhamento da Produção</h3>
                <p className="text-sm text-blue-600">
                  Visualizando as etapas de produção detalhadas
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stages
                  .filter(stage => PRODUCTION_SUB_STAGES.includes(stage.nome))
                  .map(stage => (
                    <div key={stage.id} className="bg-white rounded-lg shadow p-4">
                      <h2 className="text-lg font-bold mb-2">{stage.nome}</h2>
                      <DroppableStage id={`stage-${stage.id}`}>
                        {renderStageContent(stage)}
                      </DroppableStage>
                    </div>
                  ))}
              </div>
            </>
          )}
        </DndContextWithNoSSR>
      )}
      
      {activeTab === 'employees' && (
        <EmployeesView 
          stageId={stages[0].id}
          employees={employees as Employee[]} 
          stages={stages as Stage[]} 
        />
      )}
      
      {showCreateTasksModal && selectedOrder && (
        <CreateParallelTasksModal
          order={selectedOrder}
          stages={stages}
          onClose={() => {  
            setShowCreateTasksModal(false);
            setSelectedOrder(null);
          }}
          onConfirm={(tasksToCreate) => {
            handleCreateTasks(selectedOrder.id, tasksToCreate);
          }}
        />
      )}
    </main>
  );
}
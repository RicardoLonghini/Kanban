import React, { useState, useEffect } from 'react';

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

interface Stage {
  id: number;
  nome: string;
  status: string;
  setor: string;
  capacidade_alocada: number;
  capacidade_necessaria: number;
}

interface CreateParallelTasksModalProps {
  order: Order;
  stages: Stage[];
  onClose: () => void;
  onConfirm: (tasks: Array<{
    descricao: string;
    etapa_id: number;
    quantidade: number;
  }>) => void;
}

export default function CreateParallelTasksModal({
  order,
  stages,
  onClose,
  onConfirm
}: CreateParallelTasksModalProps) {
  // Predefinições de tarefas comuns baseadas no produto
  const [taskTemplates, setTaskTemplates] = useState<Array<{
    descricao: string;
    etapa_id: number;
    quantityMultiplier: number;
  }>>([]);
  
  // Tarefas que o usuário selecionou
  const [selectedTasks, setSelectedTasks] = useState<Array<{
    descricao: string;
    etapa_id: number;
    quantidade: number;
    selected: boolean;
  }>>([]);
  
  // Carregar templates de tarefas com base no produto
  useEffect(() => {
    // Definir os templates de acordo com seu processo real
    setTaskTemplates([
      { 
        descricao: "Bainha lencol", 
        etapa_id: stages.find(s => s.nome === 'Bainha lencol')?.id || 0,
        quantityMultiplier: 1
      },
      { 
        descricao: "Bainha fronha", 
        etapa_id: stages.find(s => s.nome === 'Bainha fronha')?.id || 0,
        quantityMultiplier: 1
      },
      { 
        descricao: "Fechar fronha", 
        etapa_id: stages.find(s => s.nome === 'Fechar fronha')?.id || 0,
        quantityMultiplier: 1
      },
      { 
        descricao: "Elastico", 
        etapa_id: stages.find(s => s.nome === 'Elastico')?.id || 0,
        quantityMultiplier: 1
      },
      { 
        descricao: "Cortar canto", 
        etapa_id: stages.find(s => s.nome === 'Cortar canto')?.id || 0,
        quantityMultiplier: 1
      }
    ]);
  }, [stages]);
  
  // Inicializar tarefas selecionadas com base nos templates
  useEffect(() => {
    if (taskTemplates.length > 0) {
      setSelectedTasks(
        taskTemplates.map(template => ({
          descricao: template.descricao,
          etapa_id: template.etapa_id,
          quantidade: order.quantidade * template.quantityMultiplier,
          selected: true
        }))
      );
    }
  }, [taskTemplates, order]);
  
  // Atualizar uma tarefa específica
  const updateTask = (index: number, updates: Partial<typeof selectedTasks[0]>) => {
    setSelectedTasks(prev => 
      prev.map((task, i) => 
        i === index ? { ...task, ...updates } : task
      )
    );
  };
  
  // Adicionar nova tarefa em branco
  const addNewTask = () => {
    setSelectedTasks(prev => [
      ...prev,
      {
        descricao: "",
        etapa_id: 0,
        quantidade: order.quantidade,
        selected: true
      }
    ]);
  };
  
  // Confirmar criação de tarefas
  const handleConfirm = () => {
    const tasksToCreate = selectedTasks
      .filter(task => task.selected && task.descricao && task.etapa_id)
      .map(({ descricao, etapa_id, quantidade }) => ({
        descricao,
        etapa_id,
        quantidade
      }));
    
    onConfirm(tasksToCreate);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          Dividir OS #{order.OS} em Processos Paralelos
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-700">
            Produto: {order.produto} | Quantidade Original: {order.quantidade}
          </p>
        </div>
        
        <div className="space-y-4 mb-6">
          {selectedTasks.map((task, index) => (
            <div key={index} className="border p-3 rounded">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={task.selected}
                  onChange={e => updateTask(index, { selected: e.target.checked })}
                  className="mr-2"
                />
                <input
                  type="text"
                  value={task.descricao}
                  onChange={e => updateTask(index, { descricao: e.target.value })}
                  placeholder="Descrição da tarefa"
                  className="flex-grow p-2 border rounded"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Etapa</label>
                  <select
                    value={task.etapa_id}
                    onChange={e => updateTask(index, { etapa_id: Number(e.target.value) })}
                    className="w-full p-2 border rounded"
                  >
                    <option value={0}>Selecione uma etapa</option>
                    {stages.map(stage => (
                      <option key={stage.id} value={stage.id}>
                        {stage.nome}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Quantidade</label>
                  <input
                    type="number"
                    value={task.quantidade}
                    onChange={e => updateTask(index, { quantidade: Number(e.target.value) })}
                    className="w-full p-2 border rounded"
                    min={1}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <button
          onClick={addNewTask}
          className="mb-6 px-4 py-2 bg-gray-200 text-gray-700 rounded"
        >
          + Adicionar Outro Processo
        </button>
        
        <div className="flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded"
            disabled={!selectedTasks.some(t => t.selected && t.descricao && t.etapa_id)}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
} 
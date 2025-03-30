const API_BASE = "http://127.0.0.1:5000";

export interface Stage {
  id: number;
  setor: string;
  nome: string;
  status: string;
  capacidade_alocada: number;
  capacidade_necessaria: number;
}

export interface Order {
  id: number;
  OS: number;
  cliente_final: string;
  produto: string;
  quantidade: number;
  etapa: string;
  etapa_id: number;
  estampa: string;
  data_entrega: string;
  ready_to_move?: boolean;
}

export interface Employee {
  id: number;
  nome: string;
  etapa_id: number;
  producao_media: number;
}

export interface Task {
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
  funcionario_id?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
}

export const api = {
  fetchStages: async (): Promise<Stage[]> => {
    const response = await fetch(`${API_BASE}/etapas`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
    
  fetchOrders: async (): Promise<Order[]> => {
    const response = await fetch(`${API_BASE}/produtos`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
    
  fetchEmployees: async (): Promise<Employee[]> => {
    const response = await fetch(`${API_BASE}/funcionarios`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  fetchTasks: async (): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}/tarefas`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  fetchOrderTasks: async (orderId: number): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}/produtos/${orderId}/tarefas`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  fetchStageTasks: async (stageId: number): Promise<Task[]> => {
    const response = await fetch(`${API_BASE}/etapas/${stageId}/tarefas`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  createOrderTasks: async (orderId: number, tasks: Partial<Task>[]) => {
    const response = await fetch(`${API_BASE}/produtos/${orderId}/tarefas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tasks),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  updateTask: async (taskId: number, updates: Partial<Task>) => {
    const response = await fetch(`${API_BASE}/tarefas/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  },
  
  updateOrder: async (orderId: number, updates: Partial<Order>) => {
    try {
      console.log(`Atualizando ordem ${orderId} com:`, updates);
      
      // Remover propriedades que não existem no backend
      const { ready_to_move, ...backendUpdates } = updates;
      
      // Verificar qual endpoint está sendo usado para outras operações
      console.log(`API_BASE: ${API_BASE}`);
      console.log(`Endpoint para atualizar ordem: ${API_BASE}/produtos/${orderId}`);
      console.log(`Dados enviados:`, JSON.stringify(backendUpdates));
      
      // Tentar com método PATCH em vez de PUT
      const response = await fetch(`${API_BASE}/produtos/${orderId}`, {
        method: 'PATCH', // Tentar PATCH em vez de PUT
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backendUpdates),
      });
      
      console.log(`Resposta status: ${response.status}`);
      
      if (!response.ok) {
        let errorText = '';
        try {
          errorText = await response.text();
        } catch (e) {
          errorText = 'Não foi possível ler o texto de erro';
        }
        
        console.log(`Erro ao atualizar ordem: ${response.status} - ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      let responseData;
      try {
        responseData = await response.json();
        console.log(`Resposta de sucesso:`, responseData);
      } catch (e) {
        console.log(`Não foi possível converter a resposta para JSON:`, e);
        responseData = { success: true };
      }
      
      return responseData;
    } catch (error) {
      console.log('Erro na função updateOrder:', error);
      throw error;
    }
  }
}; 
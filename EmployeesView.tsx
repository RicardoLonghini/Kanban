import { useState, useEffect } from "react";
import { api, Stage } from "@/lib/api";

interface Employee {
  id: number;
  nome: string;
  etapa_id: number;
  producao_media: number;
}

interface EmployeesViewProps {
  stageId: number;
  employees: Employee[];
  stages: Stage[];
}

export default function EmployeesView({ stageId }: EmployeesViewProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("http://127.0.0.1:5000/funcionarios")
      .then(res => res.json())
      .then(data => {
        const stageEmployees = data.filter((emp: any) => emp.etapa_id === stageId);
        setEmployees(stageEmployees);
        setLoading(false);
      })
      .catch(error => {
        console.error("Error fetching employees:", error);
        setError("Failed to load employees");
        setLoading(false);
      });
  }, [stageId]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Verificar se é um arquivo Excel
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setUploadMessage({
        text: 'Por favor, selecione um arquivo Excel (.xlsx ou .xls)',
        type: 'error'
      });
      return;
    }

    setIsUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://127.0.0.1:5000/importar/funcionarios', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        setUploadMessage({
          text: `${result.message || 'Funcionários importados com sucesso!'}`,
          type: 'success'
        });
        // Recarregar a página para mostrar os novos funcionários
        window.location.reload();
      } else {
        setUploadMessage({
          text: `Erro: ${result.error || 'Falha ao importar funcionários'}`,
          type: 'error'
        });
      }
    } catch (error) {
      console.error('Erro ao importar funcionários:', error);
      setUploadMessage({
        text: 'Erro ao conectar com o servidor',
        type: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Limpar a mensagem após 5 segundos
  useEffect(() => {
    if (uploadMessage) {
      const timer = setTimeout(() => {
        setUploadMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadMessage]);

  if (loading) return <p className="text-gray-500">Carregando funcionários...</p>;
  if (error) return <p className="text-red-500">{error}</p>;

  return (
    <div>
      {/* Botão de importação de Excel */}
      <div className="mb-4">
        <label 
          htmlFor={`import-employees-${stageId}`}
          className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md cursor-pointer transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Importar Funcionários Excel
          <input
            id={`import-employees-${stageId}`}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
          />
        </label>
        
        {isUploading && (
          <span className="ml-3 text-sm text-gray-600">
            Importando...
          </span>
        )}
        
        {uploadMessage && (
          <div className={`mt-2 text-sm ${uploadMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
            {uploadMessage.text}
          </div>
        )}
      </div>

      {/* Lista de funcionários */}
      {employees.length === 0 ? (
        <p className="text-gray-500 text-sm italic">Sem funcionários nesta etapa</p>
      ) : (
        <div className="space-y-2">
          {employees.map(employee => (
            <div key={employee.id} className="p-3 bg-white rounded shadow-sm border border-gray-200">
              <p className="font-medium">{employee.nome}</p>
              <p className="text-sm text-gray-600">
                Produção média: {employee.producao_media} unidades/dia
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
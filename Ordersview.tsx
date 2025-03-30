import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface OrdersViewProps {
  stageId: number;
  orders: Order[];
  onCreateTasks?: (order: Order) => void;
  tasks?: any[];
  onMoveToEmbalagem?: (orderId: number) => void;
}

function OrderCard({ order }: { order: Order }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `order-${order.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 bg-white rounded-lg shadow-sm border border-gray-200 cursor-move"
    >
      <p className="font-medium">OS #{order.OS}</p>
      <p className="text-gray-800">
        {order.produto} - {order.quantidade} units
      </p>
      <p className="text-sm text-gray-600">
        Cliente: {order.cliente_final}
      </p>
      <p className="text-sm text-gray-600">
        Estampa: {order.estampa}
      </p>
      <p className="text-sm text-gray-600">
        Data de Entrega: {order.data_entrega}
      </p>
    </div>
  );
}

export default function OrdersView({ 
  stageId, 
  orders,
  onCreateTasks,
  tasks,
  onMoveToEmbalagem 
}: OrdersViewProps) {
  const stageOrders = orders.filter(order => order.etapa_id === stageId);

  return (
    <div className="space-y-2">
      {stageOrders.map(order => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
}
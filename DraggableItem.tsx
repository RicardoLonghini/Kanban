
interface DraggableItemProps {
  id: string;
  children: React.ReactNode;
}
import { useDraggable } from '@dnd-kit/core';

export default function DraggableItem({ id, children }: DraggableItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      type: 'item',
      id
    }
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 1000 : 1,
    position: 'relative',
    opacity: isDragging ? 0.8 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style as React.CSSProperties}
      {...listeners}
      {...attributes}
      className="cursor-move"
    >
      {children}
    </div>
  );
}
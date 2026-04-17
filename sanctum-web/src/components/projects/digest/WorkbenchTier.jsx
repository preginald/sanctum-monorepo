import React from 'react';
import { Wrench } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import WorkbenchCard from '../WorkbenchCard';
import { useToast } from '../../../context/ToastContext';

function reorder(list, startIndex, endIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

export default function WorkbenchTier({
  pins,
  maxPins,
  onUnpin,
  onNavigate,
  onOpenTicket,
  onOpenMilestone,
  onOpenProject,
  onReorder,
  notifications = [],
  onMarkNotificationRead,
}) {
  const { addToast } = useToast();

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    if (result.source.index === result.destination.index) return;
    if (!onReorder) return;
    const newOrder = reorder(pins, result.source.index, result.destination.index);
    try {
      await onReorder(newOrder);
      // Silent success — no toast.
    } catch (e) {
      addToast("Couldn't save new order — reverted.", 'error');
    }
  };

  return (
    <section className="border-l-4 border-sanctum-gold/50 bg-slate-800/30 p-4 rounded-r-lg">
      <div className="flex items-center gap-2 mb-3">
        <Wrench size={16} className="text-sanctum-gold" />
        <h3 className="font-bold text-[11px] uppercase tracking-[0.05em] text-sanctum-gold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Workbench
        </h3>
        <span className="text-[10px] text-slate-500 ml-1">{pins.length}/{maxPins}</span>
      </div>
      {/*
        DragDropContext is rendered unconditionally (even when pins.length === 0)
        per AC #9 — do not conditionally mount/unmount the context on first pin.
        The empty-state message is rendered inside the Droppable so the container
        still exists with zero Draggables.
      */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="workbench-pins" direction="horizontal">
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={pins.length > 0 ? 'grid grid-cols-1 md:grid-cols-3 gap-3' : ''}
            >
              {pins.length === 0 && (
                <p className="text-sm text-slate-500 py-2">Pin projects you're working on</p>
              )}
              {pins.map((pin, index) => {
                const cardNotifications = notifications.filter(n => String(n.project_id) === String(pin.project_id));
                return (
                  <Draggable key={pin.project_id} draggableId={String(pin.project_id)} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        style={dragProvided.draggableProps.style}
                      >
                        <WorkbenchCard
                          pin={pin}
                          onUnpin={onUnpin}
                          onNavigate={onNavigate}
                          onOpenTicket={onOpenTicket}
                          onOpenMilestone={onOpenMilestone}
                          onOpenProject={onOpenProject}
                          notifications={cardNotifications}
                          onDismiss={onMarkNotificationRead}
                          dragHandleProps={dragProvided.dragHandleProps}
                          isDragging={dragSnapshot.isDragging}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </section>
  );
}

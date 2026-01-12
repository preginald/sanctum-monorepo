import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

export default function KanbanBoard({ columns, items, onDragEnd, renderCard, statusField = 'status' }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
      <DragDropContext onDragEnd={onDragEnd}>
        {Object.values(columns).map((col) => {
          // Filter items that belong to this column
          const colItems = items.filter(item => item[statusField] === col.id);
          
          return (
            <div key={col.id} className="min-w-[320px] w-1/4 bg-slate-900/30 rounded-xl border border-slate-700/50 flex flex-col">
              {/* Column Header */}
              <div className={`p-4 border-b-2 ${col.color} bg-black/20 rounded-t-xl sticky top-0 backdrop-blur-sm z-10`}>
                <h3 className="font-bold text-sm uppercase flex justify-between text-white">
                  {col.label}
                  <span className="opacity-50 bg-white/10 px-2 rounded-full text-xs flex items-center">{colItems.length}</span>
                </h3>
              </div>

              {/* Droppable Area */}
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-3 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                  >
                    {colItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={String(item.id)} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{ ...provided.draggableProps.style }}
                            className={`mb-3 transition-transform ${snapshot.isDragging ? 'rotate-2 scale-105 z-50' : ''}`}
                          >
                            {/* Render the specific card content */}
                            {renderCard(item)}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
}
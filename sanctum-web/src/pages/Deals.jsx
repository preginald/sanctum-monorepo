import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // <--- NEW IMPORT
import useAuthStore from '../store/authStore';
import Layout from '../components/Layout';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Loader2, DollarSign, Plus } from 'lucide-react';
import api from '../lib/api';

const STAGES = {
  'Infiltration': { id: 'Infiltration', label: 'Infiltration', prob: 10, color: 'border-slate-500' },
  'Filtration': { id: 'Filtration', label: 'Filtration', prob: 30, color: 'border-blue-500' },
  'Diagnosis': { id: 'Diagnosis', label: 'Diagnosis', prob: 50, color: 'border-yellow-500' },
  'Prescription': { id: 'Prescription', label: 'Prescription', prob: 80, color: 'border-purple-500' },
  'Accession': { id: 'Accession', label: 'Accession', prob: 100, color: 'border-green-500' },
};

export default function Deals() {
  const navigate = useNavigate(); // <--- NEW HOOK INITIALIZATION
  const { token, user } = useAuthStore();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalValue, setTotalValue] = useState(0);

  useEffect(() => { fetchDeals(); }, [token]);

  const fetchDeals = async () => {
    try {
      const res = await api.get('/deals');
      setDeals(res.data);
      calculateTotal(res.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const calculateTotal = (data) => {
    const total = data.reduce((sum, deal) => sum + (deal.amount * (deal.probability / 100)), 0);
    setTotalValue(total);
  };

  const getDealsByStage = (stage) => deals.filter(d => d.stage === stage);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    const newProb = STAGES[newStage].prob;

    const updatedDeals = deals.map(d => 
      d.id === draggableId ? { ...d, stage: newStage, probability: newProb } : d
    );
    setDeals(updatedDeals);
    calculateTotal(updatedDeals);

    try {
      await api.put(`/deals/${draggableId}`, { stage: newStage, probability: newProb });
    } catch (err) {
      alert("Move failed");
      fetchDeals(); 
    }
  };

  return (
    <Layout title="Revenue Pipeline">
      
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-sm opacity-50 uppercase tracking-widest">Weighted Forecast</p>
          <h2 className="text-3xl font-bold text-sanctum-gold">
            {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(totalValue)}
          </h2>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-200px)]">
        <DragDropContext onDragEnd={onDragEnd}>
          {Object.values(STAGES).map((stage) => (
            <div key={stage.id} className="min-w-[280px] w-1/5 bg-slate-900/50 rounded-xl border border-slate-700 flex flex-col">
              <div className={`p-4 border-b-2 ${stage.color} bg-black/20 rounded-t-xl`}>
                <h3 className="font-bold text-sm uppercase">{stage.label}</h3>
                <div className="flex justify-between text-xs opacity-50 mt-1">
                  <span>{getDealsByStage(stage.id).length} Deals</span>
                  <span>{stage.prob}% Prob</span>
                </div>
              </div>

              <Droppable droppableId={stage.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`flex-1 p-3 transition-colors ${snapshot.isDraggingOver ? 'bg-white/5' : ''}`}
                  >
                    {getDealsByStage(stage.id).map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => navigate(`/deals/${deal.id}`)}
                            className={`p-4 mb-3 rounded bg-slate-800 border border-slate-600 shadow-sm hover:border-sanctum-gold transition-colors cursor-pointer group ${snapshot.isDragging ? 'rotate-2 shadow-xl' : ''}`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] uppercase font-bold tracking-wider opacity-50">{deal.account_name}</span>
                            </div>
                            <h4 className="font-bold text-sm mb-1 group-hover:text-sanctum-gold transition-colors">{deal.title}</h4>
                            <p className="text-white font-mono text-sm">
                              ${deal.amount.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </DragDropContext>
      </div>
    </Layout>
  );
}
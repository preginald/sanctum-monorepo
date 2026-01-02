import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState,
  Handle, 
  Position 
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';

// 1. THE CUSTOM NODE (The "Card" appearance)
const CustomNode = ({ data }) => {
  // Define color based on Persona
  let borderColor = 'border-slate-500';
  let bgColor = 'bg-slate-800';
  let badgeColor = 'bg-slate-600';

  switch (data.persona) {
    case 'Decision Maker':
      borderColor = 'border-sanctum-gold';
      badgeColor = 'bg-yellow-600 text-white';
      break;
    case 'Champion':
      borderColor = 'border-green-500';
      badgeColor = 'bg-green-600 text-white';
      break;
    case 'Blocker':
      borderColor = 'border-red-500';
      bgColor = 'bg-red-900/20';
      badgeColor = 'bg-red-600 text-white';
      break;
    case 'Influencer':
      borderColor = 'border-blue-400';
      badgeColor = 'bg-blue-500 text-white';
      break;
  }

  return (
    <div className={`px-4 py-3 shadow-xl rounded-lg border-2 ${borderColor} ${bgColor} min-w-[200px] text-center`}>
      <Handle type="target" position={Position.Top} className="!bg-slate-400" />
      
      <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 inline-block px-2 py-0.5 rounded ${badgeColor}`}>
        {data.persona || 'Unknown'}
      </div>
      <div className="font-bold text-white text-sm">{data.name}</div>
      <div className="text-xs text-slate-400">{data.role}</div>
      
      <Handle type="source" position={Position.Bottom} className="!bg-slate-400" />
    </div>
  );
};

const nodeTypes = { custom: CustomNode };

// 2. THE LAYOUT ENGINE (Dagre)
const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  dagreGraph.setGraph({ rankdir: 'TB' }); // Top to Bottom

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 100, // Center offset
      y: nodeWithPosition.y - 40,
    };
    return node;
  });

  return { nodes, edges };
};

export default function OrgChart({ contacts }) {
  // 3. TRANSFORM DATA (Flat List -> Graph)
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    if (!contacts) return { initialNodes: [], initialEdges: [] };

    contacts.forEach(c => {
      nodes.push({
        id: c.id,
        type: 'custom',
        data: {
          name: `${c.first_name} ${c.last_name}`,
          role: c.email,
          persona: c.persona
        },
        position: { x: 0, y: 0 }
      });

      if (c.reports_to_id) {
        edges.push({
          id: `e${c.reports_to_id}-${c.id}`,
          source: c.reports_to_id,
          target: c.id,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#64748b', strokeWidth: 2 }
        });
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [contacts]);

  // Initial Layout Calculation
  const layouted = getLayoutedElements(initialNodes, initialEdges);

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);

  // 4. REACTIVITY HOOK (The Fix)
  // When contacts change, recalculate layout and update state immediately.
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  return (
    <div className="h-[500px] w-full bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#334155" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

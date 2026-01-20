import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ArticleCard({ article, colorClass = "bg-slate-900 border-slate-700 hover:border-slate-500", textClass = "text-white" }) {
  const navigate = useNavigate();

  return (
    <div 
        onClick={() => navigate(`/wiki/${article.slug}`)} 
        className={`p-4 border rounded-lg cursor-pointer transition-all group ${colorClass}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs font-mono opacity-50 uppercase tracking-widest ${textClass}`}>
            {article.identifier || 'DOC'}
        </span>
        <span className="text-xs bg-white/10 px-2 py-0.5 rounded border border-white/5 font-mono text-slate-400">
            {article.version}
        </span>
      </div>
      <h3 className={`text-lg font-bold transition-colors ${textClass} group-hover:opacity-80`}>
          {article.title}
      </h3>
      {article.author_name && (
          <div className="mt-2 text-[10px] opacity-40">By {article.author_name}</div>
      )}
    </div>
  );
}
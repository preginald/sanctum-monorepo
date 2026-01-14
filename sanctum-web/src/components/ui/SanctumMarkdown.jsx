import React from 'react';
import ReactMarkdown from 'react-markdown';

// The "Sanctum Standard" Typography Definition
export const MarkdownComponents = {
    // Headers
    h1: ({node, ...props}) => <h1 className="text-3xl font-bold text-white mt-8 mb-4 border-b border-slate-700 pb-2" {...props} />,
    h2: ({node, ...props}) => <h2 className="text-2xl font-bold text-white mt-8 mb-4" {...props} />,
    h3: ({node, ...props}) => <h3 className="text-xl font-bold text-blue-200 mt-6 mb-3" {...props} />,
    
    // Text
    p: ({node, ...props}) => <p className="text-slate-300 leading-7 mb-4" {...props} />,
    strong: ({node, ...props}) => <strong className="font-bold text-white" {...props} />,
    
    // Lists
    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-2 text-slate-300" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-2 text-slate-300" {...props} />,
    li: ({node, ...props}) => <li className="pl-1" {...props} />,
    
    // Code & Terminal
    code: ({node, inline, className, children, ...props}) => {
        return inline ? (
            <code className="bg-black/50 text-green-400 font-mono text-sm px-1.5 py-0.5 rounded border border-white/5" {...props}>{children}</code>
        ) : (
            <div className="my-6 rounded-lg overflow-hidden border border-slate-700 bg-[#0d1117]">
                <div className="bg-slate-800/50 px-4 py-1 border-b border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-mono text-slate-500">TERMINAL / CODE</span>
                </div>
                <pre className="p-4 overflow-x-auto text-sm font-mono text-slate-300 leading-relaxed custom-scrollbar">
                    <code {...props}>{children}</code>
                </pre>
            </div>
        )
    },
    
    // Callouts / Blockquotes
    blockquote: ({node, ...props}) => (
        <blockquote className="border-l-4 border-sanctum-gold bg-sanctum-gold/5 p-4 my-6 rounded-r-lg italic text-slate-300" {...props} />
    ),

    // Links
    a: ({node, ...props}) => <a className="text-sanctum-gold hover:underline hover:text-white transition-colors" {...props} />
};

export default function SanctumMarkdown({ content, className="" }) {
    if (!content) return null;
    return (
        <div className={`max-w-none ${className}`}>
            <ReactMarkdown components={MarkdownComponents}>{content}</ReactMarkdown>
        </div>
    );
}
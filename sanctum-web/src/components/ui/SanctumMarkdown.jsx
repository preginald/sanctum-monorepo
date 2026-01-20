import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Terminal } from 'lucide-react';

// --- HELPER COMPONENT FOR CODE BLOCKS ---
const CodeBlock = ({ inline, className, children, ...props }) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || '');
    const hasNewline = String(children).includes('\n');
    const isInline = inline || (!match && !hasNewline);

    const handleCopy = () => {
        navigator.clipboard.writeText(String(children));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (isInline) {
        return (
            <code className="bg-slate-800 text-orange-300 font-mono text-sm px-1.5 py-0.5 rounded border border-white/10" {...props}>
                {children}
            </code>
        );
    }

    return (
        <div className="my-6 rounded-lg overflow-hidden border border-slate-700 bg-[#1e1e1e] group relative">
            {/* HEADER */}
            <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-slate-700 select-none">
                <div className="flex items-center gap-2">
                    <Terminal size={12} className="text-slate-500" />
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                        {match ? match[1] : 'TEXT'}
                    </span>
                </div>
                <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-slate-400 hover:text-white transition-colors"
                >
                    {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>

            {/* CONTENT */}
            <SyntaxHighlighter
                {...props}
                style={vscDarkPlus}
                language={match ? match[1] : 'text'}
                PreTag="div"
                customStyle={{
                    margin: 0,
                    padding: '1.5rem',
                    background: 'transparent',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                }}
            >
                {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
        </div>
    );
};

// --- MARKDOWN MAPPING ---
const MarkdownComponents = {
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
    
    // Tables
    table: ({node, ...props}) => (
        <div className="overflow-x-auto my-6 rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm text-slate-400" {...props} />
        </div>
    ),
    thead: ({node, ...props}) => <thead className="bg-slate-800 text-xs uppercase font-bold text-slate-300" {...props} />,
    tbody: ({node, ...props}) => <tbody className="divide-y divide-slate-800" {...props} />,
    tr: ({node, ...props}) => <tr className="hover:bg-white/5 transition-colors" {...props} />,
    th: ({node, ...props}) => <th className="px-4 py-3 whitespace-nowrap" {...props} />,
    td: ({node, ...props}) => <td className="px-4 py-3" {...props} />,

    // Code (Delegated to Helper)
    code: CodeBlock,
    
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
            <ReactMarkdown 
                components={MarkdownComponents}
                remarkPlugins={[remarkGfm]}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
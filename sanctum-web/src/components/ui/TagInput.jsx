import React, { useState, useRef } from 'react';
import { X } from 'lucide-react';

export default function TagInput({ 
  value = '', 
  onChange, 
  placeholder = 'Type and press Enter...',
  validateTag = null,
  maxTags = null
}) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  
  // Parse existing value into tags array
  const tags = value ? value.split('\n').filter(t => t.trim()) : [];

  const validateAndAddTag = (tagValue) => {
    const trimmed = tagValue.trim();
    
    if (!trimmed) {
      setError('');
      return false;
    }

    // Check for duplicates
    if (tags.includes(trimmed)) {
      setError('Already added');
      setTimeout(() => setError(''), 2000);
      return false;
    }

    // Check max tags
    if (maxTags && tags.length >= maxTags) {
      setError(`Maximum ${maxTags} entries allowed`);
      setTimeout(() => setError(''), 2000);
      return false;
    }

    // Custom validation
    if (validateTag) {
      const validationError = validateTag(trimmed);
      if (validationError) {
        setError(validationError);
        setTimeout(() => setError(''), 3000);
        return false;
      }
    }

    return true;
  };

  const addTag = () => {
    if (!validateAndAddTag(input)) return;

    const newTags = [...tags, input.trim()];
    onChange(newTags.join('\n'));
    setInput('');
    setError('');
    inputRef.current?.focus();
  };

  const removeTag = (indexToRemove) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    onChange(newTags.join('\n'));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      removeTag(tags.length - 1);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    
    // Split by newlines or commas
    const entries = pastedText
      .split(/[\n,]/)
      .map(entry => entry.trim())
      .filter(entry => entry);

    // Add each valid entry
    const validEntries = [];
    for (const entry of entries) {
      if (validateAndAddTag(entry)) {
        validEntries.push(entry);
      }
    }

    if (validEntries.length > 0) {
      const newTags = [...tags, ...validEntries];
      onChange(newTags.join('\n'));
    }
  };

  return (
    <div>
      {/* Tags Display */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-300 border border-blue-500/50 rounded-lg text-sm font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="hover:bg-blue-500/30 rounded p-0.5 transition-colors"
                aria-label={`Remove ${tag}`}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input Field */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          className="w-full p-4 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:border-blue-500 outline-none"
        />
        
        {error && (
          <p className="absolute -bottom-6 left-0 text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Help Text */}
      <p className="mt-2 text-xs text-slate-500">
        {tags.length === 0 
          ? 'Type and press Enter to add'
          : `${tags.length} ${tags.length === 1 ? 'entry' : 'entries'} added. Press Enter to add more.`
        }
      </p>
    </div>
  );
}

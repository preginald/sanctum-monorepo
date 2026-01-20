/**
 * Handles "Smart Wrap" logic for textareas.
 * If text is selected and a wrapper key is pressed, it wraps the text.
 * 
 * @param {Event} e - The keydown event
 * @param {String} value - Current text value
 * @param {Function} setValue - State setter function (v) => ...
 */
export const handleSmartWrap = (e, value, setValue) => {
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 1. If no text selected, do nothing (normal typing)
    if (start === end) return;

    // 2. Define Wrapper Pairs
    const pairs = {
        '(': ')',
        '[': ']',
        '{': '}',
        '"': '"',
        "'": "'",
        '`': '`',
        '*': '*',
        '_': '_',
        '~': '~'
    };

    // 3. Check if key is a wrapper
    if (pairs[e.key]) {
        e.preventDefault(); // Stop the character from replacing the text
        
        const open = e.key;
        const close = pairs[e.key];
        const selectedText = value.substring(start, end);
        const replacement = `${open}${selectedText}${close}`;
        
        const newValue = value.substring(0, start) + replacement + value.substring(end);
        
        // 4. Update State
        setValue(newValue);

        // 5. Restore Selection (User expects the wrapped text to stay selected)
        // Timeout needed because React render cycle might reset cursor otherwise
        setTimeout(() => {
            textarea.selectionStart = start;
            textarea.selectionEnd = end + 2; // +2 accounts for the added chars
        }, 0);
    }
};
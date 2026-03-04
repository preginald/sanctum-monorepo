export default function TruncatedText({ text, className = '', maxWidth }) {
  return (
    <span
      title={text}
      className={`block truncate ${className}`}
      style={maxWidth ? { maxWidth } : undefined}
    >
      {text}
    </span>
  );
}

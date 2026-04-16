import React from 'react';

const COLOURS = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

export default function HealthDot({ colour, tooltip }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ backgroundColor: COLOURS[colour] || COLOURS.green }}
      title={tooltip}
    />
  );
}

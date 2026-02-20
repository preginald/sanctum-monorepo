import React from 'react';
import {
  priorityStyles,
  ticketStatusStyles,
  ticketTypeStyles,
  invoiceStatusStyles,
  dealStageStyles,
  assetStatusStyles,
  clientStatusStyles,
  auditStatusStyles,
  fallbackStyle,
} from '../../lib/statusStyles';

const maps = {
  priority:      priorityStyles,
  ticketStatus:  ticketStatusStyles,
  ticketType:    ticketTypeStyles,
  invoiceStatus: invoiceStatusStyles,
  dealStage:     dealStageStyles,
  assetStatus:   assetStatusStyles,
  clientStatus:  clientStatusStyles,
  auditStatus:   auditStatusStyles,
};

export default function StatusBadge({ value, map }) {
  if (!value) return null;
  const styles = maps[map] || {};
  const className = styles[value] || fallbackStyle;
  return (
    <span className={className}>
      {value}
    </span>
  );
}

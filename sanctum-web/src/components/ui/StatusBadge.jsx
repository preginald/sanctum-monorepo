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
  milestoneStatusStyles,
  projectStatusStyles,
  campaignStatusStyles,
  fallbackStyle,
} from '../../lib/statusStyles';

const maps = {
  priority:        priorityStyles,
  ticketStatus:    ticketStatusStyles,
  ticketType:      ticketTypeStyles,
  invoiceStatus:   invoiceStatusStyles,
  dealStage:       dealStageStyles,
  assetStatus:     assetStatusStyles,
  clientStatus:    clientStatusStyles,
  auditStatus:     auditStatusStyles,
  milestoneStatus: milestoneStatusStyles,
  projectStatus:   projectStatusStyles,
  campaignStatus:  campaignStatusStyles,
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

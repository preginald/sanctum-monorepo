import React from 'react';
import { CheckCircle, Loader2, Clock, AlertCircle } from 'lucide-react';

/**
 * StatusBadge - Displays status with appropriate icon and color
 * 
 * Supports: draft, in_progress, finalized, pending, resolved, etc.
 */
export default function StatusBadge({ 
  status, 
  variant = 'default',
  size = 'md',
  showIcon = true,
  customLabel
}) {
  // Size variants
  const sizes = {
    sm: { text: 'text-xs', icon: 12, padding: 'px-2 py-1' },
    md: { text: 'text-sm', icon: 14, padding: 'px-3 py-1' },
    lg: { text: 'text-base', icon: 16, padding: 'px-4 py-2' }
  };

  const sizeConfig = sizes[size] || sizes.md;

  // Status configurations
  const statusConfig = {
    // Assessment statuses
    draft: {
      label: 'Assessment Requested',
      icon: Clock,
      color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      emoji: '📝'
    },
    in_progress: {
      label: 'In Progress',
      icon: Loader2,
      color: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      iconClass: 'animate-spin'
    },
    finalized: {
      label: 'Completed',
      icon: CheckCircle,
      color: 'bg-green-500/20 text-green-500 border-green-500/30'
    },
    
    // Ticket statuses
    new: {
      label: 'New',
      icon: AlertCircle,
      color: 'bg-purple-500/20 text-purple-500 border-purple-500/30'
    },
    open: {
      label: 'Open',
      icon: Clock,
      color: 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    },
    pending: {
      label: 'Pending',
      icon: Clock,
      color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    },
    resolved: {
      label: 'Resolved',
      icon: CheckCircle,
      color: 'bg-green-500/20 text-green-500 border-green-500/30'
    },
    
    // Generic
    success: {
      label: 'Success',
      icon: CheckCircle,
      color: 'bg-green-500/20 text-green-500 border-green-500/30'
    },
    warning: {
      label: 'Warning',
      icon: AlertCircle,
      color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
    },
    error: {
      label: 'Error',
      icon: AlertCircle,
      color: 'bg-red-500/20 text-red-500 border-red-500/30'
    },
    info: {
      label: 'Info',
      icon: AlertCircle,
      color: 'bg-blue-500/20 text-blue-500 border-blue-500/30'
    }
  };

  const config = statusConfig[status] || statusConfig.info;
  const Icon = config.icon;
  const label = customLabel || config.label;

  return (
    <span 
      className={`inline-flex items-center gap-1.5 ${sizeConfig.padding} ${sizeConfig.text} font-medium rounded-full border ${config.color}`}
    >
      {showIcon && (
        config.emoji ? (
          <span>{config.emoji}</span>
        ) : Icon ? (
          <Icon size={sizeConfig.icon} className={config.iconClass} />
        ) : null
      )}
      {label}
    </span>
  );
}

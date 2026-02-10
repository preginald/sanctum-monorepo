import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, CheckCircle, Loader2, ArrowRight } from 'lucide-react';
import Card from './Card';
import StatusBadge from './StatusBadge';
import ProgressBar from './ProgressBar';

/**
 * HealthScoreWidget - Expandable health score widget with multi-assessment support
 * 
 * Features:
 * - Shows primary assessment when collapsed
 * - Badge count for multiple assessments
 * - Expand to see all assessments
 * - Status-based rendering (draft/in_progress/finalized)
 * - Click to navigate to report
 */
export default function HealthScoreWidget({
  category,
  label,
  icon: Icon,
  color,
  assessments = [],
  isNaked = false,
  onNavigate
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();
  
  const hasAssessments = assessments.length > 0;
  const primary = assessments[0]; // Highest priority assessment
  const additionalCount = assessments.length - 1;

  // Theme
  const theme = {
    textMain: isNaked ? 'text-slate-900' : 'text-white'
  };

  // Score color helper
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  // Determine display content for primary assessment
  let primaryDisplay = null;
  let isClickable = false;
  
  if (!hasAssessments) {
    // No assessments
    primaryDisplay = <span className="text-2xl opacity-30">Not Assessed</span>;
  } else if (primary.status === 'draft') {
    primaryDisplay = (
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-yellow-500">Assessment Requested</span>
        <span className="text-xs opacity-50 mt-1">Our team will contact you soon</span>
      </div>
    );
  } else if (primary.status === 'in_progress') {
    primaryDisplay = (
      <div className="flex flex-col">
        <span className="text-2xl font-bold text-blue-500 flex items-center gap-2">
          In Progress <Loader2 size={20} className="animate-spin" />
        </span>
        <span className="text-xs opacity-50 mt-1">Assessment underway</span>
      </div>
    );
  } else if (primary.status === 'finalized') {
    primaryDisplay = (
      <>
        <span className={`text-5xl font-bold ${getScoreColor(primary.score)}`}>{primary.score}</span>
        <span className={`text-xl opacity-30 mb-1 ${theme.textMain}`}>/ 100</span>
      </>
    );
    isClickable = true;
  }

  const handlePrimaryClick = () => {
    if (isClickable) {
      if (onNavigate) {
        onNavigate(`/portal/audit/${category}`);
      } else {
        navigate(`/portal/audit/${category}`);
      }
    }
  };

  return (
    <Card
      isNaked={isNaked}
      className="flex flex-col justify-between group"
    >
      {/* WIDGET HEADER */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-bold uppercase tracking-widest opacity-50 flex items-center gap-2">
          {Icon && <Icon size={16} />}
          {label}
        </h3>
        {assessments.length > 1 && (
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-bold">
            {assessments.length}
          </span>
        )}
      </div>

      {/* COLLAPSED VIEW */}
      {!isExpanded && (
        <>
          <div 
            className={`flex items-end gap-2 mb-2 ${isClickable ? 'cursor-pointer' : ''}`}
            onClick={handlePrimaryClick}
          >
            {primaryDisplay}
          </div>
          
          {hasAssessments && (
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="text-xs opacity-70 flex items-center gap-1">
                {primary.status === 'finalized' && <CheckCircle size={14} className="text-green-500" />}
                {primary.status === 'in_progress' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                {primary.status === 'draft' && <span className="text-yellow-500">📝</span>}
                {primary.template_name}
              </div>
              
              {isClickable && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrimaryClick();
                  }}
                  className="text-xs text-blue-400 opacity-70 hover:opacity-100 transition-opacity whitespace-nowrap"
                >
                  View Report →
                </button>
              )}
            </div>
          )}
          
          {additionalCount > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
            >
              <ChevronDown size={14} />
              + {additionalCount} more assessment{additionalCount > 1 ? 's' : ''}
            </button>
          )}
        </>
      )}

      {/* EXPANDED VIEW */}
      {isExpanded && (
        <div className="space-y-3">
          <button
            onClick={() => setIsExpanded(false)}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-2 transition-colors"
          >
            <ChevronUp size={14} />
            Collapse
          </button>
          
          {assessments.map((assessment) => {
            const canView = assessment.status === 'finalized';
            
            return (
              <div
                key={assessment.id}
                className="p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="text-sm font-bold">{assessment.template_name}</div>
                    <div className="text-xs opacity-50 mt-1 flex items-center gap-1">
                      {assessment.status === 'draft' && (
                        <StatusBadge status="draft" size="sm" customLabel="Requested" />
                      )}
                      {assessment.status === 'in_progress' && (
                        <StatusBadge status="in_progress" size="sm" />
                      )}
                      {assessment.status === 'finalized' && (
                        <span className={`flex items-center gap-1 ${getScoreColor(assessment.score)}`}>
                          <CheckCircle size={12} /> Score: {assessment.score}/100
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {canView && (
                    <button
                      onClick={() => {
                        if (onNavigate) {
                          onNavigate(`/portal/audit/${category}`);
                        } else {
                          navigate(`/portal/audit/${category}`);
                        }
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      View <ArrowRight size={12} />
                    </button>
                  )}
                </div>
                
                {assessment.status === 'finalized' && (
                  <div className="mt-2">
                    <ProgressBar 
                      score={assessment.score} 
                      colorMode="score"
                      height="h-2"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

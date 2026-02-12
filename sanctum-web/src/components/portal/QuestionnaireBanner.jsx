import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, ArrowRight, Sparkles } from 'lucide-react';

export default function QuestionnaireBanner({ lifecycleStage }) {
  if (lifecycleStage === 'onboarding') {
    // Questionnaire completed, awaiting review
    return (
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/30 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="flex-none p-3 bg-blue-900/50 rounded-lg">
            <Sparkles size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg mb-2">
              Questionnaire Received!
            </h3>
            <p className="text-slate-300 mb-4">
              Thank you for completing the Pre-Engagement Questionnaire. Our team is reviewing your responses and will contact you within 48 hours to schedule your audit engagement.
            </p>
            <div className="flex items-center gap-2 text-sm text-blue-400">
              <div className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-400"></span>
              </div>
              <span>Under review by Digital Sanctum team</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (lifecycleStage === 'prospect') {
    // New prospect - show questionnaire prompt
    return (
      <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-xl border border-blue-500/30 p-6 mb-6">
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="flex-none p-3 bg-blue-900/50 rounded-lg">
            <ClipboardList size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white text-lg mb-2">
              📋 Complete Your Pre-Engagement Questionnaire
            </h3>
            <p className="text-slate-300 mb-4">
              Help us prepare for your audit by answering 8 quick questions about your technology environment. Takes approximately 5 minutes.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link to="/portal/questionnaire">
                <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center gap-2 transition-all">
                  Start Questionnaire
                  <ArrowRight size={18} />
                </button>
              </Link>
              <div className="flex items-center gap-2 text-sm text-green-400">
                <Sparkles size={16} />
                <span className="font-medium">Complete now and unlock 10% discount on your first assessment</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active client - no banner needed
  return null;
}

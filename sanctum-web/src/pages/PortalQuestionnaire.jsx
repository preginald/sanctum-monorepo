import React from 'react';
import { useNavigate } from 'react-router-dom';
import QuestionnaireForm from '../components/audits/QuestionnaireForm';
import api from '../lib/api';

export default function PortalQuestionnaire() {
  const navigate = useNavigate();

  // Load drafts if they exist
  const savedDraft = localStorage.getItem('questionnaire_draft');
  const initialData = savedDraft ? JSON.parse(savedDraft) : {};

  const handleSubmit = async (formData) => {
    // Client submission to their own account
    await api.post('/portal/questionnaire/submit', formData);
    
    // Clear draft on success
    localStorage.removeItem('questionnaire_draft');
    
    // Redirect to completion page
    navigate('/portal/questionnaire/complete');
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <QuestionnaireForm 
          initialData={initialData}
          onSubmit={handleSubmit}
          mode="client"
        />
        
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Your progress is automatically saved to your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

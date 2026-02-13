import React, { useState, useEffect } from 'react';
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Shield, HelpCircle, Cloud, Server } from 'lucide-react';
import { Card } from '../portal';
import TagInput from '../ui/TagInput';
import SearchableSelect from '../ui/SearchableSelect';
import api from '../../lib/api';

// REUSABLE QUESTIONNAIRE LOGIC
// Used by: PortalQuestionnaire.jsx (Client) and AdminClientDiscovery.jsx (Admin)

export const SECTION_1_QUESTIONS = [
  {
    id: 'company_size',
    label: 'How many people work at the organisation?',
    type: 'select',
    options: ['< 10 employees', '11-50 employees', '51-200 employees', '201+ employees'],
    required: true
  },
  {
    id: 'assessment_interest',
    label: 'What type of assessment is required?',
    type: 'select_with_descriptions',
    options: [
      {
        value: 'Security Assessment',
        label: 'Security Assessment',
        description: 'Comprehensive review of cybersecurity posture, vulnerabilities, and compliance',
        price: 'Standard'
      },
      {
        value: 'Infrastructure Review',
        label: 'Infrastructure Review',
        description: 'Evaluation of servers, networks, and IT infrastructure',
        price: 'Standard'
      },
      {
        value: 'Digital Presence Audit',
        label: 'Digital Presence Audit',
        description: 'Analysis of websites, domains, hosting, and online brand consistency',
        price: 'Standard'
      },
      {
        value: 'Multiple Assessments',
        label: 'Multiple Assessments',
        description: 'Interested in more than one type of assessment',
        price: 'Custom'
      },
      {
        value: 'Not sure yet',
        label: 'General Discovery',
        description: 'General information gathering',
        price: 'N/A'
      }
    ],
    required: true,
    helpText: 'This categorises the audit data.'
  },
  {
    id: 'domain_names',
    label: 'What domain names do they own?',
    type: 'tags',
    placeholder: 'Type domain and press Enter (e.g., example.com.au)',
    required: false,
    helpText: 'List all domains. System will verify ownership and check security.',
    validate: (value) => {
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.([a-zA-Z]{2,}\.)?[a-zA-Z]{2,}$/;
      if (!domainRegex.test(value)) {
        return 'Please enter a valid domain (e.g., example.com or example.com.au)';
      }
      return null;
    }
  },
  {
    id: 'hosting_providers',
    label: 'Who hosts the website/email?',
    type: 'vendor_select',
    category: 'hosting',
    icon: Server,
    required: false,
    helpText: 'Search from known hosting providers'
  },
  {
    id: 'saas_platforms',
    label: 'Critical software/platforms?',
    type: 'vendor_select',
    category: 'saas',
    icon: Cloud,
    required: false,
    helpText: 'Search from known SaaS platforms'
  }
];

export const SECURITY_QUESTIONS = [
  {
    id: 'antivirus',
    label: 'Current Antivirus / Endpoint Protection?',
    type: 'vendor_select',
    category: 'antivirus',
    icon: Shield,
    required: false,
    securityOnly: true,
    helpText: 'Search from security vendors'
  },
  {
    id: 'firewall_type',
    label: 'Firewall Protection?',
    type: 'select',
    options: ['Yes - Hardware firewall', 'Yes - Software firewall', 'Yes - Cloud firewall (e.g., Cloudflare)', 'No', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'password_management',
    label: 'Password Management Strategy?',
    type: 'select',
    options: ['Password manager (1Password, LastPass, Bitwarden)', 'Browser saved passwords', 'Written down / Spreadsheet', 'Memory only', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'mfa_enabled',
    label: 'MFA Status?',
    type: 'select',
    options: ['Yes - for all critical accounts', 'Yes - for some accounts', 'No', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'backup_solution',
    label: 'Backup Strategy?',
    type: 'select',
    options: ['Daily cloud backups', 'Weekly cloud backups', 'External drive backups', 'No backups currently', 'Not sure'],
    required: false,
    securityOnly: true
  }
];

export const SECTION_2_QUESTIONS = [
  {
    id: 'primary_pain_point',
    label: "Primary Technology Challenge / Notes",
    type: 'textarea',
    placeholder: 'Enter notes about current pain points or infrastructure issues...',
    required: false,
    maxLength: 1000,
    helpText: 'Internal notes or client-stated challenges.'
  },
  {
    id: 'current_it_support',
    label: 'Current IT Management?',
    type: 'select',
    options: ['Self-managed', 'External MSP', 'Break-fix provider', 'In-house IT team', 'None'],
    required: false
  },
  {
    id: 'timeline',
    label: "Assessment Timeline",
    type: 'select',
    options: ['Urgent (< 30 days)', 'Normal (30-90 days)', 'Flexible (> 90 days)'],
    required: false
  }
];

export default function QuestionnaireForm({ 
  initialData = {}, 
  onSubmit, 
  mode = 'client', // 'client' or 'admin'
  onCancel 
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  
  const [vendors, setVendors] = useState({
    hosting: [],
    saas: [],
    antivirus: []
  });
  const [loadingVendors, setLoadingVendors] = useState(false);

  useEffect(() => {
    const loadVendors = async () => {
      setLoadingVendors(true);
      try {
        const [hosting, saas, antivirus] = await Promise.all([
          api.get('/vendors/by-category/hosting'),
          api.get('/vendors/by-category/saas'),
          api.get('/vendors/by-category/antivirus')
        ]);
        
        setVendors({
          hosting: hosting.data,
          saas: saas.data,
          antivirus: antivirus.data
        });
      } catch (error) {
        console.error('Failed to load vendors:', error);
      } finally {
        setLoadingVendors(false);
      }
    };
    
    loadVendors();
  }, []);

  const showSecurityQuestions = 
    formData.assessment_interest === 'Security Assessment' || 
    formData.assessment_interest === 'Multiple Assessments' ||
    formData.assessment_interest === 'Not sure yet';

  const ALL_QUESTIONS = [
    ...SECTION_1_QUESTIONS,
    ...(showSecurityQuestions ? SECURITY_QUESTIONS : []),
    ...SECTION_2_QUESTIONS
  ];

  const currentQuestion = ALL_QUESTIONS[currentStep];
  const MAX_QUESTIONS = SECTION_1_QUESTIONS.length + SECURITY_QUESTIONS.length + SECTION_2_QUESTIONS.length;
  const displayProgress = ((currentStep + 1) / MAX_QUESTIONS) * 100;

  const getProgressColor = () => {
    if (displayProgress < 34) return 'bg-red-500';
    if (displayProgress < 67) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const validateCurrentStep = () => {
    const question = ALL_QUESTIONS[currentStep];
    const value = formData[question.id];

    if (question.required && (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.trim() === ''))) {
      setErrors({ [question.id]: 'This field is required' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    
    // Auto-save draft only in client mode
    if (mode === 'client') {
      localStorage.setItem('questionnaire_draft', JSON.stringify(formData));
    }

    if (currentStep < ALL_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0); 
    } else {
      handleFinalSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      console.error('Submission error:', err);
      setErrors({ submit: 'Failed to submit questionnaire. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVendorSelect = (questionId, vendor) => {
    const currentVendors = formData[questionId] || [];
    if (currentVendors.includes(vendor.id)) return;
    setFormData({
      ...formData,
      [questionId]: [...currentVendors, vendor.id]
    });
  };

  const handleVendorRemove = (questionId, vendorId) => {
    const currentVendors = formData[questionId] || [];
    setFormData({
      ...formData,
      [questionId]: currentVendors.filter(id => id !== vendorId)
    });
  };

  const renderInput = () => {
    const value = formData[currentQuestion.id] || '';

    if (currentQuestion.type === 'vendor_select') {
      const categoryVendors = vendors[currentQuestion.category] || [];
      const selectedVendorIds = formData[currentQuestion.id] || [];
      const selectedVendors = categoryVendors.filter(v => selectedVendorIds.includes(v.id));

      return (
        <div className="space-y-3">
          {selectedVendors.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              {selectedVendors.map(vendor => (
                <span
                  key={vendor.id}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-600/20 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-500/50 rounded-lg text-sm font-medium"
                >
                  {currentQuestion.icon && <currentQuestion.icon size={14} />}
                  {vendor.name}
                  <button
                    type="button"
                    onClick={() => handleVendorRemove(currentQuestion.id, vendor.id)}
                    className="hover:bg-blue-500/30 rounded px-1 transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          {loadingVendors ? (
            <div className="text-center p-4 text-slate-400">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} />
              Loading vendors...
            </div>
          ) : (
            <SearchableSelect
              key={currentStep}
              items={categoryVendors}
              selectedIds={selectedVendorIds}
              onSelect={(vendor) => handleVendorSelect(currentQuestion.id, vendor)}
              placeholder={`Search ${currentQuestion.category} providers...`}
              labelKey="name"
              subLabelKey="website"
              valueKey="id"
              icon={currentQuestion.icon}
            />
          )}
        </div>
      );
    }

    if (currentQuestion.type === 'tags') {
      return (
        <TagInput
          value={value}
          onChange={(newValue) => setFormData({ ...formData, [currentQuestion.id]: newValue })}
          placeholder={currentQuestion.placeholder}
          validateTag={currentQuestion.validate}
        />
      );
    }

    if (currentQuestion.type === 'select_with_descriptions') {
      return (
        <div className="space-y-3">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFormData({ ...formData, [currentQuestion.id]: opt.value })}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                formData[currentQuestion.id] === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20'
                  : 'border-slate-200 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-slate-900 dark:text-white">{opt.label}</span>
                {mode === 'client' && <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">{opt.price}</span>}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">{opt.description}</p>
            </button>
          ))}
        </div>
      );
    }

    if (currentQuestion.type === 'select' && currentQuestion.options.length <= 5) {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {currentQuestion.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFormData({ ...formData, [currentQuestion.id]: opt })}
              className={`p-4 rounded-lg border-2 transition-all text-left font-medium ${
                formData[currentQuestion.id] === opt
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-white'
                  : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    if (currentQuestion.type === 'select') {
      return (
        <select
          autoFocus
          className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg focus:border-blue-500 outline-none"
          value={value}
          onChange={(e) => setFormData({ ...formData, [currentQuestion.id]: e.target.value })}
        >
          <option value="">-- Please select --</option>
          {currentQuestion.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    if (currentQuestion.type === 'textarea') {
      return (
        <textarea
          autoFocus
          className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white text-lg focus:border-blue-500 outline-none resize-none"
          rows={currentQuestion.rows || 4}
          maxLength={currentQuestion.maxLength}
          value={value}
          onChange={(e) => setFormData({ ...formData, [currentQuestion.id]: e.target.value })}
          placeholder={currentQuestion.placeholder}
        />
      );
    }

    return null;
  };

  return (
    <div className="w-full">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {mode === 'admin' ? 'Admin Discovery Mode' : 'Pre-Engagement Questionnaire'}
          </h1>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Question {currentStep + 1} of {ALL_QUESTIONS.length}
          </span>
        </div>
        
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${getProgressColor()}`}
            style={{ width: `${displayProgress}%` }}
          />
        </div>
      </div>

      <Card>
        <div className="p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            {currentQuestion.label}
            {!currentQuestion.required && (
              <span className="text-sm text-slate-500 ml-2 font-normal">(Optional)</span>
            )}
          </h2>

          {currentQuestion.helpText && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-500/20 rounded-lg">
              <HelpCircle size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-slate-600 dark:text-slate-400">{currentQuestion.helpText}</p>
            </div>
          )}

          {renderInput()}

          {errors[currentQuestion.id] && (
            <p className="mt-2 text-sm text-red-500 dark:text-red-400">{errors[currentQuestion.id]}</p>
          )}

          {currentQuestion.maxLength && formData[currentQuestion.id] && (
            <p className="mt-2 text-xs text-slate-500">
              {formData[currentQuestion.id].length} / {currentQuestion.maxLength} characters
            </p>
          )}
        </div>

        <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <ArrowLeft size={20} />
            Back
          </button>

          <button
            onClick={handleNext}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Submitting...
              </>
            ) : currentStep === ALL_QUESTIONS.length - 1 ? (
              <>
                <CheckCircle2 size={20} />
                {mode === 'admin' ? 'Save Discovery' : 'Submit'}
              </>
            ) : (
              <>
                Next
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </div>
      </Card>
      
      {onCancel && (
        <div className="mt-4 text-center">
            <button onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Cancel Discovery Session
            </button>
        </div>
      )}

      {errors.submit && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/50 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{errors.submit}</p>
        </div>
      )}
    </div>
  );
}

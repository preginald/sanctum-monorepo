import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2, Shield, HelpCircle } from 'lucide-react';
import api from '../lib/api';
import { Card } from '../components/portal';
import TagInput from '../components/ui/TagInput';

// PRIORITY 2: Restructured into 2 sections with clear purposes

const SECTION_1_QUESTIONS = [
  {
    id: 'company_size',
    label: 'How many people work at your organisation?',
    type: 'select',
    options: ['< 10 employees', '11-50 employees', '51-200 employees', '201+ employees'],
    required: true
  },
  {
    id: 'assessment_interest',
    label: 'What type of assessment are you interested in?',
    type: 'select_with_descriptions',
    options: [
      {
        value: 'Security Assessment',
        label: 'Security Assessment',
        description: 'Comprehensive review of your cybersecurity posture, vulnerabilities, and compliance',
        price: '$1,450'
      },
      {
        value: 'Infrastructure Review',
        label: 'Infrastructure Review',
        description: 'Evaluation of servers, networks, and IT infrastructure performance and reliability',
        price: '$1,200'
      },
      {
        value: 'Digital Presence Audit',
        label: 'Digital Presence Audit',
        description: 'Analysis of websites, domains, hosting, and online brand consistency',
        price: '$950'
      },
      {
        value: 'Multiple Assessments',
        label: 'Multiple Assessments',
        description: 'I\'m interested in more than one type of assessment',
        price: 'Custom pricing'
      },
      {
        value: 'Not sure yet',
        label: 'Not Sure Yet',
        description: 'I need help determining which assessment is right for my business',
        price: 'Free consultation'
      }
    ],
    required: true,
    helpText: 'This helps us ask relevant questions and prepare an accurate quote.'
  },
  {
    id: 'domain_names',
    label: 'What domain names do you own?',
    type: 'tags',
    placeholder: 'Type domain and press Enter (e.g., example.com.au)',
    required: false,
    helpText: 'List all domains your business owns. We\'ll verify ownership and check security.',
    validate: (value) => {
      // Domain validation - accepts multi-part TLDs like .com.au, .co.uk
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]\.([a-zA-Z]{2,}\.)?[a-zA-Z]{2,}$/;
      if (!domainRegex.test(value)) {
        return 'Please enter a valid domain (e.g., example.com or example.com.au)';
      }
      return null;
    }
  },
  {
    id: 'hosting_providers',
    label: 'Who hosts your website, email, or other services?',
    type: 'tags',
    placeholder: 'Type provider and press Enter (e.g., VentraIP)',
    required: false,
    helpText: 'Add each hosting provider separately. Include web hosting, email hosting, cloud services, etc.'
  },
  {
    id: 'saas_platforms',
    label: 'What critical software/platforms do you rely on?',
    type: 'tags',
    placeholder: 'Type platform and press Enter (e.g., Microsoft 365)',
    required: false,
    helpText: 'List essential SaaS platforms like Microsoft 365, Xero, Salesforce, Slack, etc.'
  }
];

const SECURITY_QUESTIONS = [
  {
    id: 'antivirus',
    label: 'What antivirus or endpoint protection do you use?',
    type: 'select',
    options: ['Windows Defender', 'Norton/Symantec', 'McAfee', 'Trend Micro', 'CrowdStrike', 'SentinelOne', 'Sophos', 'ESET', 'None', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'firewall_type',
    label: 'Do you have a firewall protecting your network?',
    type: 'select',
    options: ['Yes - Hardware firewall', 'Yes - Software firewall', 'Yes - Cloud firewall (e.g., Cloudflare)', 'No', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'password_management',
    label: 'How does your team manage passwords?',
    type: 'select',
    options: ['Password manager (1Password, LastPass, Bitwarden)', 'Browser saved passwords', 'Written down / Spreadsheet', 'Memory only', 'Not sure'],
    required: false,
    securityOnly: true
  },
  {
    id: 'mfa_enabled',
    label: 'Is multi-factor authentication (MFA) enabled?',
    type: 'select',
    options: ['Yes - for all critical accounts', 'Yes - for some accounts', 'No', 'Not sure what MFA is'],
    required: false,
    securityOnly: true
  },
  {
    id: 'backup_solution',
    label: 'How are your files backed up?',
    type: 'select',
    options: ['Daily cloud backups', 'Weekly cloud backups', 'External drive backups', 'No backups currently', 'Not sure'],
    required: false,
    securityOnly: true
  }
];

const SECTION_2_QUESTIONS = [
  {
    id: 'primary_pain_point',
    label: "What's your biggest technology challenge right now?",
    type: 'textarea',
    placeholder: 'e.g., We need better security, our systems are slow, we want to automate processes...',
    required: true,
    maxLength: 500,
    helpText: 'This helps us understand your priorities and tailor our recommendations.'
  },
  {
    id: 'current_it_support',
    label: 'How do you currently manage IT?',
    type: 'select',
    options: ['Self-managed', 'External MSP', 'Break-fix provider', 'In-house IT team', 'None'],
    required: false
  },
  {
    id: 'timeline',
    label: "When would you like to start an assessment?",
    type: 'select',
    options: ['Urgent (< 30 days)', 'Normal (30-90 days)', 'Flexible (> 90 days)'],
    required: true
  },
  {
    id: 'referral_source',
    label: 'How did you hear about Digital Sanctum?',
    type: 'select',
    options: ['Google Search', 'LinkedIn', 'Referral from colleague', 'Event/Conference', 'Other'],
    required: true
  }
];

export default function PortalQuestionnaire() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Build dynamic question list
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
  
  // PRIORITY 2 FIX #175: Always calculate progress based on MAX possible questions
  const MAX_QUESTIONS = SECTION_1_QUESTIONS.length + SECURITY_QUESTIONS.length + SECTION_2_QUESTIONS.length;
  const actualProgress = ((currentStep + 1) / ALL_QUESTIONS.length) * 100;
  const displayProgress = ((currentStep + 1) / MAX_QUESTIONS) * 100;

  const getProgressColor = () => {
    if (displayProgress < 34) return 'bg-red-500';
    if (displayProgress < 67) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getProgressMessage = () => {
    if (displayProgress < 34) return 'Just started';
    if (displayProgress < 67) return 'Halfway there!';
    return 'Almost done!';
  };

  const validateCurrentStep = () => {
    const question = ALL_QUESTIONS[currentStep];
    const value = formData[question.id];

    if (question.required && (!value || value.trim() === '')) {
      setErrors({ [question.id]: 'This field is required' });
      return false;
    }

    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;

    localStorage.setItem('questionnaire_draft', JSON.stringify(formData));

    if (currentStep < ALL_QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/portal/questionnaire/submit', formData);
      localStorage.removeItem('questionnaire_draft');
      navigate('/portal/questionnaire/complete');
    } catch (err) {
      console.error('Submission error:', err);
      setErrors({ submit: 'Failed to submit questionnaire. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = () => {
    const isSection1 = currentStep < SECTION_1_QUESTIONS.length;
    const isSection2Start = currentStep === (SECTION_1_QUESTIONS.length + (showSecurityQuestions ? SECURITY_QUESTIONS.length : 0));
    const isSecurityStart = currentStep === SECTION_1_QUESTIONS.length && showSecurityQuestions;

    if (currentStep === 0) {
      return (
        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <h3 className="font-bold text-white text-lg mb-2">Section 1: Your Technology</h3>
          <p className="text-sm text-slate-300">
            These questions help us prepare your environment ahead of time, reducing the time spent in discovery during your assessment.
          </p>
        </div>
      );
    }

    if (isSecurityStart) {
      return (
        <div className="mb-6 p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Shield className="text-purple-400" size={24} />
            <div>
              <h3 className="font-bold text-white">Security Questions</h3>
              <p className="text-sm text-slate-300">
                These questions help us understand your current security posture.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isSection2Start) {
      return (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-500/30 rounded-lg">
          <h3 className="font-bold text-white text-lg mb-2">Section 2: Help Us Serve You Better</h3>
          <p className="text-sm text-slate-300">
            These questions help us understand your needs and provide the best possible service.
          </p>
        </div>
      );
    }

    return null;
  };

  const renderInput = () => {
    const value = formData[currentQuestion.id] || '';

    // PRIORITY 2 TICKET #167, #168: Tag inputs
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

    // PRIORITY 2 TICKET #176: Assessment type with descriptions
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
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800'
              }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-white">{opt.label}</span>
                <span className="text-sm text-blue-400 font-medium">{opt.price}</span>
              </div>
              <p className="text-sm text-slate-400">{opt.description}</p>
            </button>
          ))}
        </div>
      );
    }

    // Button grid for select fields with ≤5 options
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
                  ? 'border-blue-500 bg-blue-500/20 text-white'
                  : 'border-slate-600 text-slate-300 hover:border-slate-500 hover:bg-slate-800'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      );
    }

    // Dropdown for select fields with >5 options
    if (currentQuestion.type === 'select') {
      return (
        <select
          autoFocus
          className="w-full p-4 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:border-blue-500 outline-none"
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
          className="w-full p-4 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:border-blue-500 outline-none resize-none"
          rows={currentQuestion.rows || 4}
          maxLength={currentQuestion.maxLength}
          value={value}
          onChange={(e) => setFormData({ ...formData, [currentQuestion.id]: e.target.value })}
          placeholder={currentQuestion.placeholder}
        />
      );
    }

    return (
      <input
        autoFocus
        type="text"
        className="w-full p-4 bg-slate-800 border border-slate-600 rounded-lg text-white text-lg focus:border-blue-500 outline-none"
        value={value}
        onChange={(e) => setFormData({ ...formData, [currentQuestion.id]: e.target.value })}
        placeholder={currentQuestion.placeholder}
      />
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <h1 className="text-2xl font-bold text-white">Pre-Engagement Questionnaire</h1>
            <span className="text-sm text-slate-400">
              Question {currentStep + 1} of {ALL_QUESTIONS.length}
            </span>
          </div>
          
          {/* Progress Bar - Fixed to max questions */}
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${getProgressColor()}`}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>{Math.round(displayProgress)}% Complete</span>
            <span className={displayProgress < 34 ? 'text-red-400' : displayProgress < 67 ? 'text-yellow-400' : 'text-green-400'}>
              {getProgressMessage()}
            </span>
          </div>
        </div>

        {/* Section Header */}
        {renderSectionHeader()}

        {/* Question Card */}
        <Card>
          <div className="p-8">
            <h2 className="text-xl font-bold text-white mb-2">
              {currentQuestion.label}
              {!currentQuestion.required && (
                <span className="text-sm text-slate-500 ml-2 font-normal">(Optional)</span>
              )}
            </h2>

            {currentQuestion.helpText && (
              <div className="flex items-start gap-2 mb-4 p-3 bg-blue-900/10 border border-blue-500/20 rounded-lg">
                <HelpCircle size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-slate-400">{currentQuestion.helpText}</p>
              </div>
            )}

            {renderInput()}

            {errors[currentQuestion.id] && (
              <p className="mt-2 text-sm text-red-400">{errors[currentQuestion.id]}</p>
            )}

            {currentQuestion.maxLength && formData[currentQuestion.id] && (
              <p className="mt-2 text-xs text-slate-500">
                {formData[currentQuestion.id].length} / {currentQuestion.maxLength} characters
              </p>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center p-6 bg-slate-800/50 border-t border-slate-700">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-slate-400 hover:text-white hover:bg-slate-700"
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
                  Submit
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

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-slate-500">
            Your progress is automatically saved. You can close this and resume later.
          </p>
        </div>

        {errors.submit && (
          <div className="mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{errors.submit}</p>
          </div>
        )}
      </div>
    </div>
  );
}

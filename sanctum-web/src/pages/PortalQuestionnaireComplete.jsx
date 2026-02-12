import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Clock } from 'lucide-react';
import { Card } from '../components/portal';

export default function PortalQuestionnaireComplete() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <Card>
          <div className="p-12 text-center">
            {/* Success Icon */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-green-900/20 rounded-full border-2 border-green-500/50">
                <CheckCircle2 size={64} className="text-green-400" />
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-white mb-4">
              Thank You!
            </h1>
            <p className="text-xl text-slate-300 mb-8">
              Your Pre-Engagement Questionnaire has been submitted successfully.
            </p>

            {/* What Happens Next */}
            <div className="bg-slate-800/50 rounded-lg p-6 mb-8 text-left">
              <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Clock size={20} className="text-blue-400" />
                What Happens Next?
              </h2>
              <ol className="space-y-3 text-slate-300">
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 bg-blue-900/50 border border-blue-500/50 rounded-full flex items-center justify-center text-blue-400 text-sm font-bold">
                    1
                  </span>
                  <span>Our team is reviewing your responses</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 bg-blue-900/50 border border-blue-500/50 rounded-full flex items-center justify-center text-blue-400 text-sm font-bold">
                    2
                  </span>
                  <span>We'll prepare a customised audit scope based on your environment</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-none w-6 h-6 bg-blue-900/50 border border-blue-500/50 rounded-full flex items-center justify-center text-blue-400 text-sm font-bold">
                    3
                  </span>
                  <span>
                    <strong className="text-white">You'll hear from us within 48 hours</strong> to schedule your audit engagement
                  </span>
                </li>
              </ol>
            </div>

            {/* CTA */}
            <Link to="/portal">
              <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-colors">
                Return to Portal Dashboard
                <ArrowRight size={20} />
              </button>
            </Link>

            {/* Footer Note */}
            <p className="mt-6 text-sm text-slate-500">
              You can now explore the assessment catalogue and review available frameworks.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

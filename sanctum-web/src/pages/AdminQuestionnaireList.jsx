import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Download, Eye, Calendar, Users, Clock, Package } from 'lucide-react';
import api from '../lib/api';
import Layout from '../components/Layout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Card } from '../components/portal';

export default function AdminQuestionnaireList() {
  const navigate = useNavigate();
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    dateRange: 'all',
    companySize: 'all',
    timeline: 'all',
    assessmentType: 'all'
  });

  useEffect(() => {
    fetchResponses();
  }, []);

  const fetchResponses = async () => {
    try {
      const res = await api.get('/admin/accounts/questionnaires');
      setResponses(res.data);
    } catch (error) {
      console.error('Failed to fetch questionnaire responses:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['Account', 'Submitted', 'Company Size', 'Assessment Interest', 'Timeline', 'Assets Created'];
    const rows = filteredResponses.map(r => [
      r.account_name,
      new Date(r.submitted_at).toLocaleDateString(),
      r.company_size,
      r.assessment_interest || 'Not specified',
      r.timeline,
      r.draft_assets_count
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questionnaire-responses-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Apply filters
  const filteredResponses = responses.filter(r => {
    if (filter.companySize !== 'all' && r.company_size !== filter.companySize) return false;
    if (filter.timeline !== 'all' && r.timeline !== filter.timeline) return false;
    if (filter.assessmentType !== 'all' && r.assessment_interest !== filter.assessmentType) return false;
    
    // Date range filter
    if (filter.dateRange !== 'all') {
      const submittedDate = new Date(r.submitted_at);
      const now = new Date();
      const daysDiff = Math.floor((now - submittedDate) / (1000 * 60 * 60 * 24));
      
      if (filter.dateRange === 'week' && daysDiff > 7) return false;
      if (filter.dateRange === 'month' && daysDiff > 30) return false;
      if (filter.dateRange === 'quarter' && daysDiff > 90) return false;
    }
    
    return true;
  });

  const getTimelineBadgeColor = (timeline) => {
    if (timeline?.includes('Urgent')) return 'bg-red-500/20 text-red-400 border-red-500/50';
    if (timeline?.includes('Normal')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
    return 'bg-green-500/20 text-green-400 border-green-500/50';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <ClipboardList size={32} className="text-blue-500" />
              Questionnaire Responses
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Pre-engagement questionnaires submitted by prospects
            </p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
          >
            <Download size={18} />
            Export CSV
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <ClipboardList className="text-blue-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">{responses.length}</div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Total Submissions</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Clock className="text-red-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {responses.filter(r => r.timeline?.includes('Urgent')).length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Urgent</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Users className="text-green-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {responses.filter(r => r.company_size?.includes('51+')).length}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Enterprise (51+)</div>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Package className="text-purple-500" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {responses.reduce((sum, r) => sum + r.draft_assets_count, 0)}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-400">Assets Created</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Date Range
              </label>
              <select
                value={filter.dateRange}
                onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Time</option>
                <option value="week">Last 7 Days</option>
                <option value="month">Last 30 Days</option>
                <option value="quarter">Last 90 Days</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Company Size
              </label>
              <select
                value={filter.companySize}
                onChange={(e) => setFilter({ ...filter, companySize: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Sizes</option>
                <option value="< 10 employees">{'< 10 employees'}</option>
                <option value="11-50 employees">11-50 employees</option>
                <option value="51-200 employees">51-200 employees</option>
                <option value="201+ employees">201+ employees</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Timeline
              </label>
              <select
                value={filter.timeline}
                onChange={(e) => setFilter({ ...filter, timeline: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Timelines</option>
                <option value="Urgent (< 30 days)">Urgent</option>
                <option value="Normal (30-90 days)">Normal</option>
                <option value="Flexible (> 90 days)">Flexible</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Assessment Type
              </label>
              <select
                value={filter.assessmentType}
                onChange={(e) => setFilter({ ...filter, assessmentType: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Types</option>
                <option value="Security Assessment">Security</option>
                <option value="Infrastructure Review">Infrastructure</option>
                <option value="Digital Presence Audit">Digital Presence</option>
                <option value="Multiple / Not sure">Multiple / Not Sure</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Results Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <TableRow>
                  <TableHead className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Account
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Submitted
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Company Size
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Assessment Interest
                  </TableHead>
                  <TableHead className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Timeline
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Assets
                  </TableHead>
                  <TableHead className="px-4 py-3 text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-slate-200 dark:divide-slate-700">
                {filteredResponses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan="7" className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                      No questionnaire responses found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResponses.map((response) => (
                    <TableRow
                      key={response.account_id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">
                          {response.account_name}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(response.submitted_at).toLocaleDateString('en-AU', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {response.company_size}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {response.assessment_interest || 'Not specified'}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 text-xs font-medium rounded border ${getTimelineBadgeColor(response.timeline)}`}>
                          {response.timeline?.split('(')[0].trim()}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/50 text-xs font-medium rounded">
                          {response.draft_assets_count}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <button
                          onClick={() => navigate(`/clients/${response.account_id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {filteredResponses.length > 0 && (
          <div className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            Showing {filteredResponses.length} of {responses.length} responses
          </div>
        )}

      </div>
    </Layout>
  );
}

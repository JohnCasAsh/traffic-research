import { useState } from 'react';
import { MessageSquare, Send, CheckCircle, AlertTriangle, MapPin, Fuel, Car, HelpCircle } from 'lucide-react';
import { useAuth } from '../auth';
import { API_URL, buildAuthHeaders } from '../api';

const CATEGORIES = [
  { value: 'traffic', label: 'Traffic Issue', icon: Car },
  { value: 'road', label: 'Road Condition', icon: AlertTriangle },
  { value: 'parking', label: 'Parking Problem', icon: MapPin },
  { value: 'gas', label: 'Gas Station Info', icon: Fuel },
  { value: 'other', label: 'Other', icon: HelpCircle },
];

export function FeedbackPage() {
  const { token, user } = useAuth();
  const [category, setCategory] = useState('traffic');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) { setError('Please enter a message.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const body = {
        category,
        location: location.trim(),
        message: message.trim(),
        submittedBy: user ? `${user.firstName} ${user.lastName}`.trim() : 'Anonymous',
      };
      await fetch(`${API_URL}/api/feedback`, {
        method: 'POST',
        headers: { ...buildAuthHeaders(token || ''), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-teal-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Thank you!</h2>
          <p className="text-sm text-slate-500">Your report has been submitted. We'll review it and update the map data accordingly.</p>
          <button
            onClick={() => { setSubmitted(false); setMessage(''); setLocation(''); setCategory('traffic'); }}
            className="px-6 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition"
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-8">
      <div className="max-w-xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Feedback & Report</h1>
            <p className="text-sm text-slate-500">Help improve the map data for Tuguegarao City</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition ${
                    category === value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Location <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="e.g. Rizal St., SM Center, Buntun Bridge"
              maxLength={150}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Message <span className="text-red-400">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe the issue or information you'd like to report..."
              maxLength={1000}
              rows={5}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white resize-none"
            />
            <p className="text-xs text-slate-400 text-right mt-1">{message.length}/1000</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>

        <p className="text-xs text-center text-slate-400">
          Reports are reviewed by the admin team and used to keep map data accurate.
        </p>
      </div>
    </div>
  );
}

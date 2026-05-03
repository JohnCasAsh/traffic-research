import { useState, useEffect } from 'react';
import { MessageCircle, X, Loader2 } from 'lucide-react';
import { API_URL, buildAuthHeaders } from '../api';
import { useAuth } from '../auth';

export function ChatBubble() {
  const { token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [chatUrl, setChatUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${API_URL}/api/auth/chat-token`, {
      headers: buildAuthHeaders(token),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setChatUrl(data.url))
      .catch(() => setChatUrl(null))
      .finally(() => setLoading(false));
  }, [token]);

  const panelContent = loading ? (
    <div className="flex-1 flex items-center justify-center bg-white">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
    </div>
  ) : chatUrl ? (
    <iframe
      src={chatUrl}
      className="flex-1 border-0 w-full"
      title="Route Assistant Chat"
      allow="microphone; camera"
    />
  ) : (
    <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-500 gap-2 px-6 text-center">
      <MessageCircle className="w-8 h-8 text-slate-300" />
      <p className="text-sm">Route Assistant is temporarily unavailable.</p>
    </div>
  );

  return (
    <>
      {/* ── Desktop panel (lg+) ── */}
      <div
        className={`hidden lg:flex fixed bottom-24 right-6 z-50 flex-col w-96 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
          isOpen
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible translate-y-4 pointer-events-none'
        }`}
        style={{ height: '600px' }}
      >
        <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200 shrink-0">
          <h3 className="font-semibold text-slate-900 text-sm">Route Assistant</h3>
          <button
            onClick={() => setIsOpen(false)}
            className="text-slate-500 hover:text-slate-700 transition"
            aria-label="Close chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {panelContent}
      </div>

      {/* ── Desktop FAB ── */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="hidden lg:flex fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-orange-600 border-none cursor-pointer shadow-lg hover:bg-orange-700 hover:scale-110 transition-all items-center justify-center"
        aria-label="Toggle Route Assistant"
      >
        {isOpen ? <X className="w-7 h-7 text-white" /> : <MessageCircle className="w-7 h-7 text-white" />}
      </button>

      {/* ── Mobile FAB (< lg) ── */}
      <button
        onClick={() => setIsOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-orange-600 shadow-lg flex items-center justify-center hover:bg-orange-700 active:scale-95 transition-all"
        aria-label="Open Route Assistant"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>

      {/* ── Mobile slide-up drawer ── */}
      {isOpen && (
        <div className="lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setIsOpen(false)}
          />
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ height: '82vh' }}
          >
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
              <h3 className="text-sm font-semibold text-slate-900">Route Assistant</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              {panelContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

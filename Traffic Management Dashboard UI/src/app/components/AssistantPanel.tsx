import { useState } from 'react';
import { MessageCircle, X, Loader2 } from 'lucide-react';

type Props = {
  chatUrl: string | null;
  chatLoading: boolean;
};

export function AssistantPanel({ chatUrl, chatLoading }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const panelContent = chatLoading ? (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
    </div>
  ) : chatUrl ? (
    <iframe
      src={chatUrl}
      width="100%"
      height="100%"
      frameBorder="0"
      allow="microphone; camera"
      title="Route Assistant Chat"
      className="w-full h-full"
    />
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white text-slate-500 gap-2 px-6 text-center">
      <MessageCircle className="w-8 h-8 text-slate-300" />
      <p className="text-sm">Route Assistant is temporarily unavailable.</p>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar — hidden on mobile */}
      <div className="hidden lg:flex lg:w-96 bg-white border-l border-slate-200 flex-col sticky top-16 h-[calc(100vh-4rem)] self-start">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h3 className="text-sm font-semibold text-slate-900">Route Assistant</h3>
          {chatUrl && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {panelContent}
        </div>
      </div>

      {/* Mobile FAB — visible only on small screens */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-orange-600 shadow-lg flex items-center justify-center hover:bg-orange-700 active:scale-95 transition-all"
        aria-label="Open Route Assistant"
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Slide-up panel */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col"
            style={{ height: '82vh' }}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Route Assistant</h3>
                {chatUrl && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition p-1 rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Chat content */}
            <div className="flex-1 overflow-hidden">
              {panelContent}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { MessageCircle, X, Loader2, ChevronRight } from 'lucide-react';

type Props = {
  chatUrl: string | null;
  chatLoading: boolean;
};

export function AssistantPanel({ chatUrl, chatLoading }: Props) {
  const [open, setOpen] = useState(false);

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
      {/* Toggle tab — always visible on the right edge */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Route Assistant' : 'Open Route Assistant'}
        className={`fixed top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-200 bg-white px-2 py-4 shadow-lg transition-all duration-300 hover:bg-orange-50 hover:border-orange-200 group ${
          open ? 'right-96' : 'right-0'
        }`}
      >
        <MessageCircle className="w-5 h-5 text-orange-500" />
        <span
          className="text-[10px] font-semibold text-slate-500 group-hover:text-orange-600"
          style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.08em' }}
        >
          AI
        </span>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${open ? 'rotate-0' : 'rotate-180'}`}
        />
      </button>

      {/* Backdrop (mobile only) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div
        className={`fixed top-16 right-0 bottom-0 z-40 flex flex-col bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ width: '24rem' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-900">Route Assistant</h3>
            {chatUrl && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
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
    </>
  );
}

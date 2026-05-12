import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Loader2, ChevronRight, Car, PersonStanding } from 'lucide-react';

type Props = {
  chatUrl: string | null;
  chatLoading: boolean;
};

const ROLE_PROMPTS = [
  { label: "I'm a Driver", icon: Car, message: "I'm a driver", color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
  { label: "I'm a Commuter", icon: PersonStanding, message: "I'm a commuter", color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
];

export function AssistantPanel({ chatUrl, chatLoading }: Props) {
  const [open, setOpen] = useState(false);
  const [navHeight, setNavHeight] = useState(64);
  const [roleSent, setRoleSent] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const nav = document.querySelector('nav');
    if (!nav) return;
    const update = () => setNavHeight(nav.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Reset role selection when panel closes
  useEffect(() => {
    if (!open) setRoleSent(false);
  }, [open]);

  function sendRole(message: string) {
    // Try postMessage to the GenAI iframe
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        { type: 'user-input', input: message },
        '*'
      );
    }
    setRoleSent(true);
  }

  const panelContent = chatLoading ? (
    <div className="w-full h-full flex items-center justify-center bg-white">
      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
    </div>
  ) : chatUrl ? (
    <div className="flex flex-col h-full">
      {/* Role quick-start buttons — shown until user picks one */}
      {!roleSent && (
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <p className="text-xs text-slate-500 mb-2 font-medium">Who are you? Pick one to start:</p>
          <div className="flex gap-2">
            {ROLE_PROMPTS.map(({ label, icon: Icon, message, color }) => (
              <button
                key={label}
                onClick={() => sendRole(message)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition ${color}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat iframe with "Powered by Gemini API" covered */}
      <div className="relative flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          src={chatUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="microphone; camera"
          title="Navocs AI Route Assistant"
          className="w-full h-full"
        />
        {/* Cover the "Powered by Gemini API" footer branding */}
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-center border-t border-slate-100"
          style={{ height: 36, background: '#ffffff', zIndex: 10 }}
        >
          <span className="text-xs font-medium text-slate-400">Navocs AI Assistant &mdash; Tuguegarao City</span>
        </div>
      </div>
    </div>
  ) : (
    <div className="w-full h-full flex flex-col items-center justify-center bg-white text-slate-500 gap-2 px-6 text-center">
      <MessageCircle className="w-8 h-8 text-slate-300" />
      <p className="text-sm">Route Assistant is temporarily unavailable.</p>
    </div>
  );

  return (
    <>
      {/* Toggle tab */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Route Assistant' : 'Open Route Assistant'}
        className={`fixed top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-200 bg-white px-2 py-4 shadow-lg transition-all duration-300 hover:bg-orange-50 hover:border-orange-200 group ${
          open ? 'right-[min(24rem,100vw)]' : 'right-0'
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
        className={`fixed right-0 bottom-0 z-40 flex flex-col bg-white border-l border-slate-200 shadow-2xl transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ top: navHeight, width: '24rem', maxWidth: '100vw' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-slate-900">Navocs AI Assistant</h3>
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

import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

export function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 flex flex-col w-96 rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${
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
        <iframe
          src="https://genai-app-navocstrafficassistant-1-1777735107346-986182900435.us-central1.run.app/?key=MIVJIWWAeD9kZwK5uysO8DmpIMrXoDp1"
          className="flex-1 border-0 w-full"
          title="Route Assistant Chat"
          allow="microphone; camera"
        />
      </div>

      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 rounded-full bg-orange-600 border-none cursor-pointer shadow-lg hover:bg-orange-700 hover:scale-110 transition-all flex items-center justify-center"
        aria-label="Toggle Route Assistant"
        title="Route Assistant"
      >
        {isOpen
          ? <X className="w-7 h-7 text-white" />
          : <MessageCircle className="w-7 h-7 text-white" />
        }
      </button>
    </>
  );
}

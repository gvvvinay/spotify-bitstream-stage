import React from 'react';
import { ToastMessage } from '../types';
import { Heart, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-slate-900/95 border border-white/[0.1] text-white px-3.5 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3 text-xs animate-in slide-in-from-top-2 fade-in duration-200"
          style={{
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 15px var(--theme-accent-glow)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {toast.type === 'heart' ? (
              <Heart className="w-4 h-4 fill-rose-500 text-rose-500 shrink-0 animate-bounce" />
            ) : toast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 theme-text-accent shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 theme-text-accent shrink-0" />
            )}
            <span className="font-semibold truncate">{toast.text}</span>
          </div>
          <button
            onClick={() => onDismiss(toast.id)}
            className="p-1 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

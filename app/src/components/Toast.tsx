import { useEffect } from 'react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';

export interface ToastItem { id: string; message: string; type: string; }

interface Props { toasts: ToastItem[]; onDismiss: (id: string) => void; }

const STYLE: Record<string, { bar: string; Icon: React.ElementType; iconCls: string }> = {
  error:   { bar: 'border-l-[var(--color-red)]',   Icon: AlertCircle,   iconCls: 'text-red' },
  warning: { bar: 'border-l-[var(--color-amber)]', Icon: AlertTriangle, iconCls: 'text-amber' },
  success: { bar: 'border-l-[var(--color-green)]', Icon: CheckCircle,   iconCls: 'text-green' },
  info:    { bar: 'border-l-[var(--color-blue)]',  Icon: Info,          iconCls: 'text-blue' },
};

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), 4500);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const s = STYLE[toast.type] || STYLE.info;
  return (
    <div className={`flex items-start gap-2.5 bg-surface border border-border ${s.bar} border-l-[3px] rounded-lg px-3 py-2.5 shadow-xl w-72`}>
      <s.Icon size={13} className={`${s.iconCls} shrink-0 mt-0.5`} />
      <p className="flex-1 text-xs text-text leading-snug break-words">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="text-faint hover:text-text shrink-0 ml-1">
        <X size={11} />
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[200] flex flex-col gap-1.5 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <Toast toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

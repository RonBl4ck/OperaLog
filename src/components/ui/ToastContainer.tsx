import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { ToastMessage } from '../../types/operalog';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const TOAST_STYLES: Record<
  ToastMessage['type'],
  { borderColor: string; iconColor: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  success: {
    borderColor: 'var(--pluz-success)',
    iconColor: 'var(--pluz-success)',
    Icon: CheckCircle2,
  },
  error: {
    borderColor: 'var(--pluz-danger)',
    iconColor: 'var(--pluz-danger)',
    Icon: AlertCircle,
  },
  info: {
    borderColor: 'var(--pluz-primary)',
    iconColor: 'var(--pluz-primary)',
    Icon: Info,
  },
};

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const style = TOAST_STYLES[toast.type];
        const Icon = style.Icon;

        return (
          <div
            key={toast.id}
            role="status"
            style={{
              borderLeftColor: style.borderColor,
              backgroundColor: 'var(--pluz-surface)',
              borderColor: 'var(--pluz-border)',
              borderLeftWidth: '4px',
            }}
            className="toast-item pointer-events-auto flex items-start gap-3 rounded-lg border p-3.5 shadow-lg"
          >
            <span style={{ color: style.iconColor }} className="mt-0.5 shrink-0">
              <Icon className="w-5 h-5" />
            </span>

            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold leading-snug"
                style={{ color: 'var(--pluz-ink)' }}
              >
                {toast.title}
              </p>
              {toast.description && (
                <p
                  className="mt-0.5 text-xs leading-relaxed break-words"
                  style={{ color: 'var(--pluz-muted)' }}
                >
                  {toast.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label="Cerrar notificación"
              className="tactile-btn shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;

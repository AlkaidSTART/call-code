import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '删除',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="confirm-overlay fixed inset-0 z-50 grid place-items-center p-4 sm:p-6"
      style={{
        background: 'rgb(0 0 0 / 0.5)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="confirm-dialog w-full max-w-[480px] rounded-[14px] border"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--panel-shadow)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4 p-6 sm:p-7">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
            aria-hidden="true"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3
              id="confirm-dialog-title"
              className="text-[17px] font-semibold leading-snug"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-description"
              className="mt-1.5 text-[14px] leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {description}
            </p>
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2.5 border-t px-6 py-4 sm:px-7"
          style={{ borderColor: 'rgb(var(--panel-border))' }}
        >
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="dialog-cancel h-10 rounded-lg px-4 text-[13px] font-medium transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn-danger h-10 rounded-lg px-4 text-[13px] font-medium transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

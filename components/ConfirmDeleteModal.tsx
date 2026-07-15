"use client";

type ConfirmDeleteModalProps = {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  isDeleting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  confirmLabel = "Delete",
  isDeleting = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end bg-violet-950/55 p-4 backdrop-blur-sm sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirmation-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-2xl shadow-violet-950/30">
        <div className="bg-gradient-to-r from-violet-950 via-violet-800 to-violet-600 px-5 py-5 text-white sm:px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-2xl backdrop-blur">
            ⚠️
          </div>

          <h2
            id="delete-confirmation-title"
            className="mt-4 text-xl font-black sm:text-2xl"
          >
            {title}
          </h2>

          <p className="mt-2 text-sm leading-6 text-violet-100 sm:text-base">
            Please review this destructive action before continuing.
          </p>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-sm leading-6 text-slate-600 sm:text-base">
            {description}
          </p>

          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800 sm:text-sm">
            This action cannot be undone from the app. A secure audit record
            will be retained for your business history.
          </p>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="w-full rounded-xl border border-violet-200 bg-white px-5 py-3 font-bold text-violet-800 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="w-full rounded-xl bg-red-600 px-5 py-3 font-black text-white shadow-lg shadow-red-200 transition hover:-translate-y-0.5 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isDeleting ? "Deleting..." : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
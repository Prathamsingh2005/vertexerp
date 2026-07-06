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
      className="fixed inset-0 z-[100] flex items-end bg-slate-950/45 p-4 sm:items-center sm:justify-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirmation-title"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
          ⚠️
        </div>

        <h2
          id="delete-confirmation-title"
          className="mt-4 text-xl font-bold text-slate-900 sm:text-2xl"
        >
          {title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          {description}
        </p>

        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium leading-5 text-amber-800 sm:text-sm">
          This action cannot be undone from the app. A secure audit record will
          be retained for your business history.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="w-full rounded-xl bg-red-600 px-5 py-3 font-bold text-white shadow-lg transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isDeleting ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
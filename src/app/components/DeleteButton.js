// components/DeleteButton.jsx
'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function DeleteButton({
  label = 'Delete',
  onDelete,
  disabled = false,
  variant = 'danger',          // 'danger' | 'light' | 'subtle'
  triggerClassName = '',       // extra classes for the trigger
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // lock body scroll + close on Esc while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onEsc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const baseTrigger = 'cursor-pointer rounded-md px-3 py-1 transition';
  const variants = {
    danger: 'border text-red-600 border-red-300 hover:bg-red-50 disabled:opacity-50',
    subtle: 'border text-zinc-700 border-zinc-300 hover:bg-zinc-50 disabled:opacity-50',
    // for dark/gradient surfaces — force white text to beat global CSS
    light: 'border border-white/30 bg-white/10 hover:bg-white/20 !text-white disabled:opacity-50',
  };
  const triggerClasses = [baseTrigger, variants[variant] || variants.danger, triggerClassName]
    .filter(Boolean)
    .join(' ');

  const modal = (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-base font-semibold text-zinc-900">
            Are you sure you want to delete?
          </h3>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              className="cursor-pointer rounded-full border border-zinc-300 bg-white px-4 py-2 font-semibold text-zinc-700 hover:bg-zinc-50"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>

            <button
              type="button"
              className="cursor-pointer inline-flex items-center justify-center rounded-full border border-white/30 bg-gradient-to-r from-[#A5724A] to-[#7A4E2A] px-4 py-2 font-semibold !text-white shadow-md shadow-[#A5724A]/20 hover:shadow-[#A5724A]/40"
              onClick={async () => {
                await onDelete?.();
                setOpen(false);
              }}
            >
              Yes, delete!
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className={triggerClasses}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {label}
      </button>

      {mounted && open && createPortal(modal, document.body)}
    </>
  );
}

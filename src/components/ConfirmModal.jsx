import React from "react";
import { C, GlassCard, SolidButton } from "./ui";

export default function ConfirmModal({ open, title, body, confirmLabel = "Yes", cancelLabel = "No", onConfirm, onCancel }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <GlassCard className="w-full max-w-xs p-5 space-y-3" style={{ background: C.cardSolid }}>
        <div className="text-sm font-bold" style={{ color: C.text }}>{title}</div>
        {body && <div className="text-xs leading-relaxed" style={{ color: C.muted }}>{body}</div>}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-transform"
            style={{ background: "rgba(255,255,255,0.04)", color: C.muted, border: `1px solid ${C.border}` }}
          >
            {cancelLabel}
          </button>
          <SolidButton tone="gold" className="flex-1 !py-2.5 text-xs" onClick={onConfirm}>{confirmLabel}</SolidButton>
        </div>
      </GlassCard>
    </div>
  );
}

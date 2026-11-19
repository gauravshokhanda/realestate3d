"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "./controls";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => {
    const node = ref.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => { node?.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);
  return <dialog ref={ref} className="crm-modal" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id={id}>{title}</h2>{children}
  </dialog>;
}
export function ConfirmDialog({ title, message, confirmLabel, onClose, onConfirm, pending }: {
  title: string; message: string; confirmLabel: string; onClose: () => void; onConfirm: () => void; pending?: boolean;
}) {
  return <Modal title={title} onClose={onClose}>
    <p>{message}</p><div className="crm-actions">
      <Button autoFocus onClick={onClose}>Cancel</Button>
      <Button variant="danger" disabled={pending} onClick={onConfirm}>{confirmLabel}</Button>
    </div>
  </Modal>;
}

"use client";

import { useEffect, useRef } from "react";

export type ToolbarPopupOption = { value: string; label: string };

export function useDelayedPanelClose(onClose: () => void) {
  const closeTimer = useRef<number | null>(null);
  const cancelClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(onClose, 240);
  };
  useEffect(() => cancelClose, []);
  return { cancelClose, scheduleClose };
}

export default function ToolbarPopupFilter({ label, value, options, open, className = "", onOpenChange, onChange }: {
  label: string;
  value?: string;
  options: ToolbarPopupOption[];
  open: boolean;
  className?: string;
  onOpenChange(open: boolean): void;
  onChange(value: string): void;
}) {
  const selected = options.find((option) => option.value === value);
  const { cancelClose, scheduleClose } = useDelayedPanelClose(() => onOpenChange(false));
  return <div
    className={`toolbar-popup-filter${open ? " open" : ""}${className ? ` ${className}` : ""}`}
    onMouseEnter={cancelClose}
    onMouseLeave={scheduleClose}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) onOpenChange(false); }}
  >
    <button type="button" className="toolbar-popup-trigger" onClick={() => onOpenChange(!open)} aria-haspopup="listbox" aria-expanded={open}>
      <span>{selected?.label ?? label}</span><i aria-hidden="true" />
    </button>
    {open && <div className="toolbar-popup-options" role="listbox" aria-label={label}>
      <div className="toolbar-popup-scroll">
        {options.length ? options.map((option) => <button type="button" key={option.value} className={option.value === value ? "active" : ""} onClick={() => { onChange(option.value); onOpenChange(false); }} role="option" aria-selected={option.value === value}><span>{option.label}</span><i aria-hidden="true" /></button>) : <p>Sin opciones disponibles.</p>}
      </div>
    </div>}
  </div>;
}

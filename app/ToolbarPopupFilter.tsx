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
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleOptions = options.length ? options : value ? [{ value, label: value }] : [];
  const selected = visibleOptions.find((option) => option.value === value);
  const forceScrollable = /(?:program|region|course)-filter/.test(className);
  const scrollHeight = Math.min(300, visibleOptions.length * 44 + 22);
  const { cancelClose, scheduleClose } = useDelayedPanelClose(() => onOpenChange(false));
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  useEffect(() => {
    const panel = scrollRef.current;
    if (!open || !forceScrollable || !panel) return;
    const keepWheelInsideMenu = (event: WheelEvent) => {
      if (panel.scrollHeight <= panel.clientHeight) return;
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1;
      panel.scrollTop += event.deltaY * multiplier;
      event.preventDefault();
      event.stopPropagation();
    };
    panel.addEventListener("wheel", keepWheelInsideMenu, { passive: false });
    return () => panel.removeEventListener("wheel", keepWheelInsideMenu);
  }, [forceScrollable, open, visibleOptions.length]);
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
      <div className="toolbar-popup-scroll" ref={scrollRef} style={forceScrollable ? { height: `${scrollHeight}px` } : undefined}>
        {visibleOptions.length ? visibleOptions.map((option) => <button type="button" key={option.value} className={option.value === value ? "active" : ""} onClick={() => { onChange(option.value); onOpenChange(false); }} role="option" aria-selected={option.value === value}><span>{option.label}</span><i aria-hidden="true" /></button>) : <p>Sin opciones disponibles.</p>}
      </div>
    </div>}
  </div>;
}

"use client";

import { useId, useRef, type ReactNode } from "react";

export default function Tabs({ tabs, value, onChange, label, children }: {
  tabs: readonly { key: string; label: string }[]; value: string; onChange: (key: string) => void; label: string; children: ReactNode;
}) {
  const id = useId(), list = useRef<HTMLDivElement>(null);
  return <>
    <div className="crm-tabs" ref={list} role="tablist" aria-label={label} onKeyDown={(event) => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const index = tabs.findIndex((tab) => tab.key === value);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      onChange(tabs[next].key);
      list.current?.querySelectorAll("button")[next]?.focus();
    }}>
      {tabs.map((tab) => <button key={tab.key} id={`${id}-${tab.key}`} type="button" role="tab" aria-selected={value === tab.key}
        aria-controls={`${id}-panel`} tabIndex={value === tab.key ? 0 : -1} onClick={() => onChange(tab.key)}>{tab.label}</button>)}
    </div>
    <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${value}`}>{children}</div>
  </>;
}

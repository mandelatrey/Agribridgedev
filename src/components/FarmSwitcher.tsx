import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  IconCheck,
  IconChevronDown,
  IconPlus,
  IconSeedling,
} from "@tabler/icons-react";
import { useApp } from "../context/AppContext";
import { setActiveFarmId, useActiveFarm } from "../lib/active-farm";
import "../styles/farm-switcher.css";

export function FarmSwitcher({ onNavigate }: { onNavigate: () => void }) {
  const { data, user } = useApp();
  const navigate = useNavigate();
  const active = useActiveFarm(user?.id, data.farms);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!active)
    return (
      <Link to="/farms" className="workspace-name" onClick={onNavigate}>
        <span>Add your first farm</span>
        <IconPlus size={16} aria-hidden="true" />
      </Link>
    );

  const choose = (farmId: string) => {
    setActiveFarmId(user?.id, farmId);
    setOpen(false);
    onNavigate();
    navigate("/");
  };

  return (
    <div className="farm-switcher" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="workspace-name"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Current farm: ${active.name}. Switch farm`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="farm-switcher-current">
          <small>Your farm</small>
          <span>{active.name}</span>
        </span>
        <IconChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="farm-switcher-menu" id={listId}>
          <p className="farm-switcher-heading">Your registered farms</p>
          <ul>
            {data.farms.map((farm) => {
              const current = farm.id === active.id;
              return (
                <li key={farm.id}>
                  <button
                    type="button"
                    aria-current={current || undefined}
                    onClick={() => choose(farm.id)}
                  >
                    <IconSeedling size={16} aria-hidden="true" />
                    <span>
                      <strong>{farm.name}</strong>
                      <small>
                        {[farm.district, farm.crop].filter(Boolean).join(" · ")}
                      </small>
                    </span>
                    {current && <IconCheck size={16} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            to="/farms"
            className="farm-switcher-manage"
            onClick={() => {
              setOpen(false);
              onNavigate();
            }}
          >
            <IconPlus size={16} aria-hidden="true" />
            Manage or add farms
          </Link>
        </div>
      )}
    </div>
  );
}

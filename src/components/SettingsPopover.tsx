import { useState, useEffect, useRef } from 'react';
import type { ColorModeSetting, SnapMode } from '../constants';
import './SettingsPopover.css';

interface SettingsPopoverProps {
  colorMode: ColorModeSetting;
  onColorModeChange: (mode: ColorModeSetting) => void;
  snapMode: SnapMode;
  onSnapCycle: () => void;
}

export default function SettingsPopover({ colorMode, onColorModeChange, snapMode, onSnapCycle }: SettingsPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const cycleColorMode = () => {
    const next: Record<ColorModeSetting, ColorModeSetting> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    onColorModeChange(next[colorMode]);
  };

  return (
    <div className="settings-popover-container" ref={ref}>
      <button
        className="settings-popover-trigger"
        onClick={() => setOpen(!open)}
        title="Settings"
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover-panel">
          <button className="settings-popover-item" onClick={onSnapCycle}>
            Snap<span className="settings-value">
              {snapMode === 'grid' ? 'Grid' : snapMode === 'guides' ? 'Guides' : 'Off'}
            </span>
          </button>
          <button className="settings-popover-item" onClick={cycleColorMode}>
            Theme<span className="settings-value">
              {colorMode === 'light' ? 'Light' : colorMode === 'dark' ? 'Dark' : 'System'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

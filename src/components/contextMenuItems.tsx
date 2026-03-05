import React from 'react';
import { COLORS, COLOR_NAMES } from '../constants';
import type { Stereotype } from '../types/schema';

export function ColorRow({ onSelect }: { onSelect: (color: string) => void }) {
  return (
    <div className="context-menu-color-row">
      {COLORS.map((color, i) => (
        <div
          key={color}
          role="button"
          tabIndex={-1}
          aria-label={COLOR_NAMES[i] ?? color}
          title={COLOR_NAMES[i] ?? color}
          className="context-menu-color-swatch"
          style={{ background: color }}
          onClick={() => onSelect(color)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(color); } }}
        />
      ))}
    </div>
  );
}

export function StereotypeMenuItems({ onSet, current }: { onSet: (stereotype: Stereotype | undefined) => void; current?: Stereotype }) {
  return (
    <>
      <div className="context-menu-item" role="menuitem" tabIndex={-1} onClick={() => onSet('interface')}>
        Set &laquo;interface&raquo;
      </div>
      <div className="context-menu-item" role="menuitem" tabIndex={-1} onClick={() => onSet('abstract')}>
        Set &laquo;abstract&raquo;
      </div>
      <div className="context-menu-item" role="menuitem" tabIndex={-1} onClick={() => onSet('enum')}>
        Set &laquo;enum&raquo;
      </div>
      {current && (
        <div className="context-menu-item" role="menuitem" tabIndex={-1} onClick={() => onSet(undefined)}>
          Remove stereotype
        </div>
      )}
    </>
  );
}

const BORDER_STYLES: { value: string; label: string; preview: React.CSSProperties }[] = [
  { value: 'solid', label: 'Solid', preview: { borderBottom: '3px solid currentColor' } },
  { value: 'dashed', label: 'Dashed', preview: { borderBottom: '3px dashed currentColor' } },
  { value: 'dotted', label: 'Dotted', preview: { borderBottom: '3px dotted currentColor' } },
  { value: 'double', label: 'Double', preview: { borderBottom: '4px double currentColor' } },
  { value: 'none', label: 'None', preview: { borderBottom: '3px solid transparent' } },
];

export function BorderStyleRow({ onSelect, current }: { onSelect: (style: string) => void; current?: string }) {
  return (
    <div className="context-menu-icon-row">
      {BORDER_STYLES.map((bs) => (
        <div
          key={bs.value}
          role="button"
          aria-label={bs.label}
          className={`context-menu-icon-swatch${current === bs.value ? ' active' : ''}`}
          title={bs.label}
          onClick={() => onSelect(bs.value)}
        >
          <div style={{ width: '100%', ...bs.preview }} />
        </div>
      ))}
    </div>
  );
}

const EDGE_STROKE_STYLES: { value: string; label: string; preview: React.CSSProperties }[] = [
  { value: 'solid', label: 'Solid', preview: { borderBottom: '3px solid currentColor' } },
  { value: 'dashed', label: 'Dashed', preview: { borderBottom: '3px dashed currentColor' } },
  { value: 'dotted', label: 'Dotted', preview: { borderBottom: '3px dotted currentColor' } },
  { value: 'double', label: 'Double', preview: { borderBottom: '4px double currentColor' } },
];

export function EdgeStrokeStyleRow({ onSelect, current }: { onSelect: (style: string) => void; current?: string }) {
  return (
    <div className="context-menu-icon-row">
      {EDGE_STROKE_STYLES.map((bs) => (
        <div
          key={bs.value}
          role="button"
          aria-label={bs.label}
          className={`context-menu-icon-swatch${current === bs.value ? ' active' : ''}`}
          title={bs.label}
          onClick={() => onSelect(bs.value)}
        >
          <div style={{ width: '100%', ...bs.preview }} />
        </div>
      ))}
    </div>
  );
}

const TEXT_ALIGNS: { value: string; label: string }[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export function TextAlignRow({ onSelect, current }: { onSelect: (align: string) => void; current?: string }) {
  return (
    <div className="context-menu-icon-row">
      {TEXT_ALIGNS.map((ta) => (
        <div
          key={ta.value}
          role="button"
          aria-label={ta.label}
          className={`context-menu-icon-swatch${current === ta.value ? ' active' : ''}`}
          title={ta.label}
          onClick={() => onSelect(ta.value)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            {ta.value === 'left' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="10" height="2" rx="0.5" />
                <rect x="1" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'center' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="3" y="7" width="10" height="2" rx="0.5" />
                <rect x="2" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'right' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="5" y="7" width="10" height="2" rx="0.5" />
                <rect x="3" y="12" width="12" height="2" rx="0.5" />
              </>
            )}
            {ta.value === 'justify' && (
              <>
                <rect x="1" y="2" width="14" height="2" rx="0.5" />
                <rect x="1" y="7" width="14" height="2" rx="0.5" />
                <rect x="1" y="12" width="14" height="2" rx="0.5" />
              </>
            )}
          </svg>
        </div>
      ))}
    </div>
  );
}

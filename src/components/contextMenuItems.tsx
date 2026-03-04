import { COLORS } from '../constants';
import type { Stereotype } from '../types/schema';

export function ColorRow({ onSelect }: { onSelect: (color: string) => void }) {
  return (
    <div className="context-menu-color-row">
      {COLORS.map((color) => (
        <div
          key={color}
          className="context-menu-color-swatch"
          style={{ background: color }}
          onClick={() => onSelect(color)}
        />
      ))}
    </div>
  );
}

export function StereotypeMenuItems({ onSet }: { onSet: (stereotype: Stereotype | undefined) => void }) {
  return (
    <>
      <div className="context-menu-item" onClick={() => onSet('interface')}>
        Set &laquo;interface&raquo;
      </div>
      <div className="context-menu-item" onClick={() => onSet('abstract')}>
        Set &laquo;abstract&raquo;
      </div>
      <div className="context-menu-item" onClick={() => onSet('enum')}>
        Set &laquo;enum&raquo;
      </div>
      <div className="context-menu-item" onClick={() => onSet(undefined)}>
        Remove stereotype
      </div>
    </>
  );
}

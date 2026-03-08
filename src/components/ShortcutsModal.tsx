import { useEffect } from 'react';
import './ShortcutsModal.css';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { section: 'Nodes' },
  { key: 'N', desc: 'New text node' },
  { key: 'Shift + N', desc: 'New class node' },
  { key: 'Double-click', desc: 'New text node at cursor' },
  { key: 'Shift + Double-click', desc: 'New class node at cursor' },
  { section: 'Editing' },
  { key: 'Ctrl + C', desc: 'Copy selected nodes' },
  { key: 'Ctrl + X', desc: 'Cut selected nodes' },
  { key: 'Ctrl + V', desc: 'Paste at cursor' },
  { key: 'Ctrl + D', desc: 'Duplicate selected nodes' },
  { key: 'Ctrl + A', desc: 'Select all nodes' },
  { key: 'Delete / Backspace', desc: 'Delete selected' },
  { section: 'History' },
  { key: 'Ctrl + Z', desc: 'Undo' },
  { key: 'Ctrl + Shift + Z', desc: 'Redo' },
  { key: 'Ctrl + Y', desc: 'Redo' },
  { section: 'File' },
  { key: 'Ctrl + S', desc: 'Save current file' },
  { key: 'Ctrl + Shift + S', desc: 'Save all files' },
  { section: 'View' },
  { key: 'Ctrl + F', desc: 'Search canvas' },
  { key: 'Ctrl + 0', desc: 'Fit view' },
  { key: 'Ctrl + =', desc: 'Zoom in' },
  { key: 'Ctrl + -', desc: 'Zoom out' },
  { key: 'Ctrl + B', desc: 'Toggle sidebar' },
  { key: '?', desc: 'Show this help' },
] as const;

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="shortcuts-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <button className="shortcuts-close" onClick={onClose} aria-label="Close shortcuts">&times;</button>
        <h2>Keyboard Shortcuts</h2>
        <table>
          <tbody>
            {SHORTCUTS.map((item, i) =>
              'section' in item ? (
                <tr key={i}>
                  <td className="section-label" colSpan={2}>{item.section}</td>
                </tr>
              ) : (
                <tr key={i}>
                  <td><kbd>{item.key}</kbd></td>
                  <td>{item.desc}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

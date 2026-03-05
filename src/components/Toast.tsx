import { useEffect, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import './Toast.css';

const AUTO_DISMISS_MS = 5000;

export default function Toast() {
  const error = useCanvasStore((s) => s._error);
  const clearError = useCanvasStore((s) => s.clearError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        clearError();
      }, AUTO_DISMISS_MS);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [error, clearError]);

  if (!visible || !error) return null;

  return (
    <div className="toast-container">
      <div
        className="toast error"
        role="alert"
        onClick={() => { setVisible(false); clearError(); }}
        title="Click to dismiss"
      >
        {error}
      </div>
    </div>
  );
}

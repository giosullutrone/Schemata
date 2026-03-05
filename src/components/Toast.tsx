import { useEffect, useState } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import './Toast.css';

const ERROR_DISMISS_MS = 5000;
const INFO_DISMISS_MS = 2000;

export default function Toast() {
  const error = useCanvasStore((s) => s._error);
  const info = useCanvasStore((s) => s._info);
  const clearError = useCanvasStore((s) => s.clearError);
  const clearInfo = useCanvasStore((s) => s.clearInfo);
  const [visibleError, setVisibleError] = useState(false);
  const [visibleInfo, setVisibleInfo] = useState(false);

  useEffect(() => {
    if (error) {
      setVisibleError(true);
      const timer = setTimeout(() => {
        setVisibleError(false);
        clearError();
      }, ERROR_DISMISS_MS);
      return () => clearTimeout(timer);
    } else {
      setVisibleError(false);
    }
  }, [error, clearError]);

  useEffect(() => {
    if (info) {
      setVisibleInfo(true);
      const timer = setTimeout(() => {
        setVisibleInfo(false);
        clearInfo();
      }, INFO_DISMISS_MS);
      return () => clearTimeout(timer);
    } else {
      setVisibleInfo(false);
    }
  }, [info, clearInfo]);

  if (!visibleError && !visibleInfo) return null;

  return (
    <div className="toast-container">
      {visibleInfo && info && (
        <div
          className="toast info"
          role="status"
          onClick={() => { setVisibleInfo(false); clearInfo(); }}
          title="Click to dismiss"
        >
          {info}
        </div>
      )}
      {visibleError && error && (
        <div
          className="toast error"
          role="alert"
          onClick={() => { setVisibleError(false); clearError(); }}
          title="Click to dismiss"
        >
          {error}
        </div>
      )}
    </div>
  );
}

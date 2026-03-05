import { useCanvasStore } from '../store/useCanvasStore';
import './LoadingBar.css';

export default function LoadingBar() {
  const loading = useCanvasStore((s) => s._loading);
  if (!loading) return null;
  return <div className="loading-bar" role="progressbar" aria-label="Loading" />;
}

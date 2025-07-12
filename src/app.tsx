import { ErrorBoundary } from './components/error-boundary';
import { RecorderAudio } from './components/recorder-audio';
import { Toaster } from './components/ui/sonner';

export function App() {
  return (
    <ErrorBoundary>
      <RecorderAudio />
      <Toaster />
    </ErrorBoundary>
  );
}

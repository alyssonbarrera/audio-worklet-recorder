import { useEffect } from 'react';
import { isRecordingSupported } from '../../hooks/use-audio-recording';
import { Button } from '../ui/button';
import {
  useOpenAIConnection,
  useRecorderAudio,
  useRecordingControl,
} from './hooks';

const RECORDING_NOT_SUPPORTED_MESSAGE =
  'Your browser does not support audio recording.';

export function RecorderAudio() {
  const {
    closeConnection,
    connectionStatus,
    isStreamingAudio,
    isConnectedToOpenAI,
    initializeConnection,
    initializeAudioContext,
  } = useOpenAIConnection();

  const {
    audioUrl,
    cleanupAll,
    audioServiceRef,
    cleanupAudioUrl,
    setupAudioRecording,
    handleRecordingError,
    initializeAudioService,
    prepareForNewRecording,
    createAudioUrlFromRecordedData,
  } = useRecorderAudio();

  const {
    isRecording,
    stopRecording,
    getButtonText,
    setIsRecording,
    startRecording,
    isButtonDisabled,
  } = useRecordingControl({
    cleanupAll,
    connectionStatus,
    closeConnection,
    setupAudioRecording,
    handleRecordingError,
    initializeConnection,
    prepareForNewRecording,
    initializeAudioService,
    createAudioUrlFromRecordedData,
  });

  const handleStopRecording = () => stopRecording(audioServiceRef);

  useEffect(() => {
    if (connectionStatus === 'ready' && !isRecording) {
      setIsRecording(true);
    }
  }, [connectionStatus, isRecording, setIsRecording]);

  useEffect(() => {
    if (isConnectedToOpenAI) {
      initializeAudioContext();
    }
  }, [isConnectedToOpenAI, initializeAudioContext]);

  useEffect(() => {
    return () => {
      cleanupAudioUrl();
      cleanupAll();
    };
  }, [cleanupAudioUrl, cleanupAll]);

  if (!isRecordingSupported()) {
    return (
      <div className="text-center">
        <p className="text-red-500">{RECORDING_NOT_SUPPORTED_MESSAGE}</p>
      </div>
    );
  }

  return (
    <div className="flex h-svh w-full flex-col items-center justify-center space-y-4">
      <Button
        className="size-40 cursor-pointer rounded-full bg-gradient-to-b from-blue-500 to-blue-700 text-white shadow-lg transition-all hover:scale-105 active:scale-95 data-[is-recording=true]:bg-gradient-to-b data-[is-recording=true]:from-green-500 data-[is-recording=true]:to-green-700"
        data-is-recording={isRecording}
        disabled={isButtonDisabled}
        onClick={isRecording ? handleStopRecording : startRecording}
        size="lg"
        variant={isRecording ? 'destructive' : 'default'}
      >
        {getButtonText()}
      </Button>

      {isRecording ? (
        <p>Streaming audio to OpenAI (PCM 24kHz)...</p>
      ) : (
        <p>Disconnected</p>
      )}

      {isConnectedToOpenAI && (
        <p className="text-green-600 text-sm">🟢 Connected to OpenAI</p>
      )}
      {isStreamingAudio && (
        <p className="text-blue-600 text-sm">🔊 Streaming AI audio...</p>
      )}

      {audioUrl && (
        <div className="mx-auto mt-4 flex w-full flex-col items-center justify-center">
          <p className="mb-2">Recording completed:</p>
          <audio className="w-full max-w-md" controls src={audioUrl}>
            <track kind="captions" />
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
}

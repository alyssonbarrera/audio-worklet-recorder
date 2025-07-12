/** biome-ignore-all lint/suspicious/noConsole: console.error */
import type React from 'react';
import { useCallback, useState } from 'react';
import { isRecordingSupported } from '@/hooks/use-audio-recording';
import type { AudioRecordingService } from '@/services/audio-recording-service';
import { testAudioConversionPipeline } from '@/utils/audio-validation';
import type { ConnectionStatus } from './use-openai-connection';

const RECORDING_NOT_SUPPORTED_MESSAGE =
  'Your browser does not support audio recording.';

type UseRecordingControlProps = {
  connectionStatus: ConnectionStatus;
  initializeConnection: (audioService: AudioRecordingService) => Promise<void>;
  closeConnection: (audioService: AudioRecordingService | null) => void;
  prepareForNewRecording: () => void;
  initializeAudioService: () => AudioRecordingService;
  setupAudioRecording: () => Promise<void>;
  createAudioUrlFromRecordedData: () => void;
  handleRecordingError: (error: unknown) => void;
  cleanupAll: () => void;
};

export function useRecordingControl({
  connectionStatus,
  closeConnection,
  setupAudioRecording,
  handleRecordingError,
  initializeConnection,
  prepareForNewRecording,
  initializeAudioService,
  createAudioUrlFromRecordedData,
  cleanupAll,
}: UseRecordingControlProps) {
  const [isRecording, setIsRecording] = useState(false);

  const startRecording = useCallback(async () => {
    if (!isRecordingSupported()) {
      alert(RECORDING_NOT_SUPPORTED_MESSAGE);
      return;
    }

    prepareForNewRecording();
    const audioService = initializeAudioService();

    try {
      await initializeConnection(audioService);
      await setupAudioRecording();
    } catch (error) {
      handleRecordingError(error);
    }
  }, [
    prepareForNewRecording,
    initializeAudioService,
    initializeConnection,
    setupAudioRecording,
    handleRecordingError,
  ]);

  const stopRecording = useCallback(
    (audioServiceRef: React.MutableRefObject<AudioRecordingService | null>) => {
      setIsRecording(false);

      // Close OpenAI connection and cleanup streaming
      closeConnection(audioServiceRef.current);

      // Cleanup all audio-related resources
      cleanupAll();

      // Create audio URL from recorded data (if any)
      createAudioUrlFromRecordedData();
    },
    [closeConnection, cleanupAll, createAudioUrlFromRecordedData]
  );

  const handleTestAudioPipeline = useCallback(async () => {
    try {
      await testAudioConversionPipeline();
    } catch (error) {
      console.error('Error testing audio pipeline:', error);
    }
  }, []);

  const getButtonText = useCallback(() => {
    if (isRecording) {
      return 'Disconnect';
    }

    switch (connectionStatus) {
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Waiting for backend...';
      case 'ready':
        return 'Streaming...';
      default:
        return 'Connect';
    }
  }, [isRecording, connectionStatus]);

  const isButtonDisabled =
    connectionStatus === 'connecting' || connectionStatus === 'connected';

  return {
    isRecording,
    stopRecording,
    getButtonText,
    startRecording,
    setIsRecording,
    isButtonDisabled,
    handleTestAudioPipeline,
  };
}

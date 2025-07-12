/** biome-ignore-all lint/suspicious/noConsole: console.error */
import { useCallback, useEffect, useState } from 'react';
import type { AudioRecordingService } from '@/services/audio-recording-service';
import {
  defaultClient,
  setEventCallbacks,
} from '@/services/openai-websocket-client';
import { useAudioStreaming } from './use-audio-streaming';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'ready';

export function useOpenAIConnection() {
  const [isConnectedToOpenAI, setIsConnectedToOpenAI] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');

  const {
    addAudioChunk,
    resetStreaming,
    initializeAudioContext,
    isPlaying: isStreamingAudio,
    stopPlayback: stopAudioStreaming,
  } = useAudioStreaming();

  useEffect(() => {
    setEventCallbacks({
      onBackendReady: (data) => {
        console.log('Backend ready received:', data.message);
        setConnectionStatus('ready');
        resetStreaming();
      },
      onTranscriptionFinal: (message) => {
        console.log('Transcription final:', message);
      },
      onResponseTranscriptFinal: (message) => {
        console.log('AI response transcript (final):', message);
      },
      onResponseTextFinal: (message) => {
        console.log('AI response text (final):', message);
      },
      onResponseAudioDelta: (audioChunk) => {
        addAudioChunk(audioChunk);
      },
      onOpenAIError: (error) => {
        console.error('OpenAI error:', error);
        setConnectionStatus('disconnected');
        setIsConnectedToOpenAI(false);
      },
    });

    return () => {
      defaultClient.clearEventCallbacks();
    };
  }, [addAudioChunk, resetStreaming]);

  const initializeConnection = useCallback(
    async (audioService: AudioRecordingService) => {
      setConnectionStatus('connecting');
      await audioService.initializeOpenAIConnection();
      setIsConnectedToOpenAI(true);
      setConnectionStatus('connected');
    },
    []
  );

  const closeConnection = useCallback(
    (audioService: AudioRecordingService | null) => {
      setIsConnectedToOpenAI(false);
      setConnectionStatus('disconnected');

      // Stop audio streaming and reset streaming state
      stopAudioStreaming();
      resetStreaming();

      if (audioService) {
        audioService.closeOpenAIConnection();
      }
    },
    [stopAudioStreaming, resetStreaming]
  );

  return {
    closeConnection,
    connectionStatus,
    isStreamingAudio,
    stopAudioStreaming,
    isConnectedToOpenAI,
    initializeConnection,
    initializeAudioContext,
  };
}

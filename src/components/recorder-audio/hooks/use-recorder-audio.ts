/** biome-ignore-all lint/suspicious/noConsole: console.error */
import { useCallback, useRef, useState } from 'react';
import { useAudioRecording } from '@/hooks/use-audio-recording';
import { AudioRecordingService } from '@/services/audio-recording-service';
import { createWAVBlob } from '@/utils/wav-utils';

export function useRecorderAudio() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioServiceRef = useRef<AudioRecordingService | null>(null);

  const {
    isMuted,
    streamRef,
    toggleMute,
    cleanupAll,
    setAudioService,
    audioContextRef,
    audioWorkletNodeRef,
  } = useAudioRecording();

  const createAudioUrlFromRecordedData = useCallback(() => {
    const audioService = audioServiceRef.current;
    const audioContext = audioContextRef.current;

    if (!(audioService && audioContext)) {
      return;
    }

    const combinedBuffer = audioService.getAllRecordedData();
    if (combinedBuffer.length === 0) {
      return;
    }

    const audioBlob = createWAVBlob(combinedBuffer, audioContext.sampleRate);
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
  }, [audioContextRef]);

  const cleanupAudioUrl = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
  }, [audioUrl]);

  const handleRecordingError = useCallback((error: unknown) => {
    console.error('Error recording audio:', error);
  }, []);

  const prepareForNewRecording = useCallback(() => {
    cleanupAudioUrl();
    audioServiceRef.current = null;
  }, [cleanupAudioUrl]);

  const setupAudioRecording = useCallback(async () => {
    if (!audioServiceRef.current) {
      return;
    }

    try {
      const stream = await audioServiceRef.current.getMediaStream();
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const audioWorkletNode = await audioServiceRef.current.setupAudioWorklet(
        audioContext,
        stream
      );
      audioWorkletNodeRef.current = audioWorkletNode;
    } catch (error) {
      handleRecordingError(error);
      throw error;
    }
  }, [streamRef, audioContextRef, audioWorkletNodeRef, handleRecordingError]);

  const initializeAudioService = useCallback(() => {
    if (!audioServiceRef.current) {
      audioServiceRef.current = new AudioRecordingService();
      setAudioService(audioServiceRef.current);
    }
    return audioServiceRef.current;
  }, [setAudioService]);

  return {
    isMuted,
    audioUrl,
    toggleMute,
    cleanupAll,
    audioServiceRef,
    cleanupAudioUrl,
    setupAudioRecording,
    handleRecordingError,
    initializeAudioService,
    prepareForNewRecording,
    createAudioUrlFromRecordedData,
  };
}

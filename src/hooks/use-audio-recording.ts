import { useCallback, useRef, useState } from 'react';
import type { AudioRecordingService } from '../services/audio-recording-service';

export const AUDIO_CONFIG = {
  echoCancellation: true,
  noiseSuppression: true,
  sampleRate: 44_100,
} as const;

export const AUDIO_WORKLET_PATH = '/audio-processor.js';
export const PROCESSING_INTERVAL_MS = 50;

export const isRecordingSupported = (): boolean => {
  return (
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof window.AudioContext === 'function'
  );
};

export function useAudioRecording() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioServiceRef = useRef<AudioRecordingService | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const cleanupAudioNodes = useCallback(() => {
    if (audioWorkletNodeRef.current) {
      audioWorkletNodeRef.current.disconnect();
      audioWorkletNodeRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  const stopMediaStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (audioServiceRef.current) {
      const newMutedState = audioServiceRef.current.toggleMute();
      setIsMuted(newMutedState);
    }
  }, []);

  const setAudioService = useCallback(
    (service: AudioRecordingService | null) => {
      audioServiceRef.current = service;
    },
    []
  );

  const cleanupAll = useCallback(() => {
    cleanupAudioNodes();
    stopMediaStream();
  }, [cleanupAudioNodes, stopMediaStream]);

  return {
    isMuted,
    streamRef,
    toggleMute,
    cleanupAll,
    setAudioService,
    audioContextRef,
    audioWorkletNodeRef,
  };
}

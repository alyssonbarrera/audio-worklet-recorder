/** biome-ignore-all lint/suspicious/noConsole: console.error */
import { useCallback, useEffect, useRef, useState } from 'react';

// Regex for base64 cleanup
const DATA_URL_REGEX = /^data:audio\/[^;]+;base64,/;

/**
 * Hook for real-time audio streaming using Web Audio API
 *
 * How it works:
 * 1. Receives audio chunks in base64 via WebSocket (response_audio_delta event)
 * 2. Converts each chunk to Float32Array (PCM)
 * 3. Creates AudioBuffer for each chunk
 * 4. Uses AudioBufferSourceNode to play sequentially
 * 5. Calculates correct timing for continuous playback without gaps
 *
 * This allows playing audio as it arrives from the server,
 * without waiting for the complete audio, creating a streaming experience.
 */
export function useAudioStreaming() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const activeSourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sampleRateRef = useRef<number>(24_000);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const initializeAudioContext = useCallback(async () => {
    if (
      !audioContextRef.current ||
      audioContextRef.current.state === 'closed'
    ) {
      audioContextRef.current = new AudioContext({
        sampleRate: sampleRateRef.current,
      });

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }
  }, []);

  const base64ToFloat32Array = useCallback((base64: string): Float32Array => {
    const cleanBase64 = base64.replace(DATA_URL_REGEX, '');

    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);

    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32_768;
    }

    return float32Array;
  }, []);

  const addAudioChunk = useCallback(
    async (base64Chunk: string) => {
      try {
        await initializeAudioContext();

        if (!audioContextRef.current) {
          return;
        }

        const audioData = base64ToFloat32Array(base64Chunk);

        const audioBuffer = audioContextRef.current.createBuffer(
          1,
          audioData.length,
          sampleRateRef.current
        );

        const channelData = audioBuffer.getChannelData(0);
        channelData.set(audioData);

        const sourceNode = audioContextRef.current.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(audioContextRef.current.destination);

        activeSourceNodesRef.current.add(sourceNode);

        if (stopTimeoutRef.current) {
          clearTimeout(stopTimeoutRef.current);
          stopTimeoutRef.current = null;
        }

        sourceNode.addEventListener('ended', () => {
          activeSourceNodesRef.current.delete(sourceNode);

          if (stopTimeoutRef.current) {
            clearTimeout(stopTimeoutRef.current);
          }

          // If no more active nodes, set a timeout before setting isPlaying to false
          // This prevents rapid toggling when chunks arrive with small gaps
          if (activeSourceNodesRef.current.size === 0) {
            stopTimeoutRef.current = setTimeout(() => {
              // Double-check that there are still no active nodes after the timeout
              if (activeSourceNodesRef.current.size === 0) {
                setIsPlaying(false);
              }
            }, 100);
          }
        });

        const currentTime = audioContextRef.current.currentTime;
        const startTime = Math.max(currentTime, nextStartTimeRef.current);

        sourceNode.start(startTime);

        // Only set isPlaying to true if not already playing
        if (activeSourceNodesRef.current.size === 1) {
          setIsPlaying(true);
        }

        nextStartTimeRef.current = startTime + audioBuffer.duration;
      } catch (error) {
        console.error('Error adding audio chunk:', error);
      }
    },
    [initializeAudioContext, base64ToFloat32Array]
  );

  const stopPlayback = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    for (const sourceNode of activeSourceNodesRef.current) {
      try {
        sourceNode.stop();
      } catch {
        // Ignore error if already stopped
      }
    }

    // Clear the active nodes set
    activeSourceNodesRef.current.clear();

    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Ignore error if already stopped
      }
      sourceNodeRef.current = null;
    }

    setIsPlaying(false);
    nextStartTimeRef.current = 0;
  }, []);

  useEffect(() => {
    return () => {
      stopPlayback();
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close();
      }
    };
  }, [stopPlayback]);

  const resetStreaming = useCallback(() => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }

    activeSourceNodesRef.current.clear();
    setIsPlaying(false);
    nextStartTimeRef.current = 0;
  }, []);

  return {
    isPlaying,
    addAudioChunk,
    stopPlayback,
    resetStreaming,
    initializeAudioContext,
  };
}

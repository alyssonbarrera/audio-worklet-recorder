/** biome-ignore-all lint/suspicious/noConsole: console.error */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  bytesToFloat32Array,
  combineWithLeftoverBytes,
  createAudioBufferFromFloat32Array,
  decodeBase64AudioChunk,
  processBytesForStreaming,
} from '../../../utils/audio-utils';

export function useAudioStreaming() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeSourceNodesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const sampleRateRef = useRef<number>(24_000);
  const stopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leftoverByteRef = useRef<Uint8Array | null>(null);

  const initializeAudioContext = useCallback(async () => {
    if (
      !audioContextRef.current ||
      audioContextRef.current.state === 'closed'
    ) {
      try {
        audioContextRef.current = new AudioContext({
          sampleRate: sampleRateRef.current,
        });

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        console.error('Error initializing AudioContext:', error);
      }
    }
  }, []);

  const processAudioChunkBytes = useCallback((base64Chunk: string) => {
    const newBytes = decodeBase64AudioChunk(base64Chunk);

    const combinedBytes = combineWithLeftoverBytes(
      leftoverByteRef.current,
      newBytes
    );

    const { bytesToProcess, leftoverByte } =
      processBytesForStreaming(combinedBytes);

    leftoverByteRef.current = leftoverByte;

    return bytesToProcess;
  }, []);

  const createAudioSource = useCallback(
    (audioContext: AudioContext, float32Array: Float32Array) => {
      const audioBuffer = createAudioBufferFromFloat32Array(
        audioContext,
        float32Array
      );
      const sourceNode = audioContext.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(audioContext.destination);

      activeSourceNodesRef.current.add(sourceNode);

      sourceNode.addEventListener('ended', () => {
        activeSourceNodesRef.current.delete(sourceNode);

        if (activeSourceNodesRef.current.size === 0) {
          stopTimeoutRef.current = setTimeout(() => {
            if (activeSourceNodesRef.current.size === 0) {
              setIsPlaying(false);
              leftoverByteRef.current = null;
            }
          }, 100);
        }
      });

      return sourceNode;
    },
    []
  );

  const scheduleAudioPlayback = useCallback(
    (audioContext: AudioContext, sourceNode: AudioBufferSourceNode) => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }

      const currentTime = audioContext.currentTime;
      const startTime = Math.max(currentTime, nextStartTimeRef.current);

      sourceNode.start(startTime);

      if (!isPlaying) {
        setIsPlaying(true);
      }

      nextStartTimeRef.current = startTime + (sourceNode.buffer?.duration ?? 0);
    },
    [isPlaying]
  );

  const addAudioChunk = useCallback(
    async (base64Chunk: string) => {
      if (!base64Chunk) {
        return;
      }

      try {
        await initializeAudioContext();
        const audioContext = audioContextRef.current;
        if (!audioContext) {
          return;
        }

        const bytesToProcess = processAudioChunkBytes(base64Chunk);

        if (bytesToProcess.length === 0) {
          return;
        }

        const float32Array = bytesToFloat32Array(bytesToProcess);

        if (float32Array.length === 0) {
          return;
        }

        const sourceNode = createAudioSource(audioContext, float32Array);
        scheduleAudioPlayback(audioContext, sourceNode);
      } catch (error) {
        console.error('Error adding audio chunk:', error);
      }
    },
    [
      initializeAudioContext,
      processAudioChunkBytes,
      createAudioSource,
      scheduleAudioPlayback,
    ]
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

    activeSourceNodesRef.current.clear();
    leftoverByteRef.current = null;
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

  return {
    isPlaying,
    addAudioChunk,
    stopPlayback,
    initializeAudioContext,
  };
}

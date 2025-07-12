/** biome-ignore-all lint/suspicious/noConsole: silence */
import { AUDIO_CONFIG, AUDIO_WORKLET_PATH } from '../hooks/use-audio-recording';
import { arrayBufferToBase64 } from '../utils/audio-utils';
import { AudioProcessor } from './audio-processor';
import {
  connect as connectOpenAI,
  disconnect as disconnectOpenAI,
  endSession as endOpenAISession,
  notifyMute,
  resetTransmissionStats,
  sendAudioChunk,
  startSession as startOpenAISession,
} from './openai-websocket-client';

/**
 * Service for managing audio recording sessions
 */
export class AudioRecordingService {
  private audioProcessor: AudioProcessor;
  private audioWorkletNode: AudioWorkletNode | null = null;

  constructor(onPCMDataReady?: (pcmBuffer: ArrayBuffer) => void) {
    // Create callback that will send to backend
    const handlePCMData = (pcmBuffer: ArrayBuffer) => {
      this.sendAudioToBackend(pcmBuffer);

      // Also call external callback if provided
      if (onPCMDataReady) {
        onPCMDataReady(pcmBuffer);
      }
    };

    this.audioProcessor = new AudioProcessor(handlePCMData);
  }

  /**
   * Sets up audio worklet and connects audio nodes
   */
  async setupAudioWorklet(
    audioContext: AudioContext,
    stream: MediaStream
  ): Promise<AudioWorkletNode> {
    await audioContext.audioWorklet.addModule(AUDIO_WORKLET_PATH);

    const source = audioContext.createMediaStreamSource(stream);
    const audioWorkletNode = new AudioWorkletNode(
      audioContext,
      'audio-processor',
      {
        processorOptions: {
          sampleRate: audioContext.sampleRate,
        },
      }
    );

    audioWorkletNode.port.onmessage = (event) => {
      if (event.data.type === 'audioData') {
        // Receive data from worklet
        const originalData = new Float32Array(event.data.originalData);
        this.audioProcessor.addAudioData(originalData);

        const resampledData = new Float32Array(event.data.resampledData);

        // Use AudioProcessor method that validates and processes
        this.audioProcessor.addResampledAudioData(resampledData);
      }
    };

    source.connect(audioWorkletNode);
    this.audioWorkletNode = audioWorkletNode;
    return audioWorkletNode;
  }

  /**
   * Gets media stream with audio constraints
   */
  getMediaStream(): Promise<MediaStream> {
    return navigator.mediaDevices.getUserMedia({
      audio: AUDIO_CONFIG,
    });
  }

  /**
   * Gets all recorded audio data
   */
  getAllRecordedData(): Float32Array {
    return this.audioProcessor.getAllRecordedData();
  }

  /**
   * Clears all recording data
   */
  clearAllData(): void {
    this.audioProcessor.clearAllData();
  }

  /**
   * Sets the mute state for audio processing
   */
  setMuted(muted: boolean): void {
    this.audioProcessor.setMuted(muted);

    // Also notify the worklet
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({
        type: 'setMuted',
        muted,
      });
    }

    // Notify WebSocket when muting
    if (muted) {
      notifyMute();
    }
  }

  /**
   * Gets the current mute state
   */
  getMuted(): boolean {
    return this.audioProcessor.getMuted();
  }

  /**
   * Toggles the mute state
   */
  toggleMute(): boolean {
    const newMutedState = !this.audioProcessor.getMuted();
    this.setMuted(newMutedState);
    return newMutedState;
  }

  /**
   * Sends audio data to backend via WebSocket (OpenAI integration)
   */
  sendAudioToBackend(arrayBuffer: ArrayBuffer): void {
    try {
      // Validate the PCM buffer before sending
      if (arrayBuffer.byteLength === 0) {
        return;
      }

      // Check for reasonable buffer size (should be even for PCM16)
      if (arrayBuffer.byteLength % 2 !== 0) {
        return;
      }

      const base64Data = arrayBufferToBase64(arrayBuffer);

      // Additional validation on base64 data
      if (base64Data.length === 0) {
        return;
      }

      sendAudioChunk(base64Data);
    } catch {
      console.error('Failed to send audio data to backend');
    }
  }

  /**
   * Initializes OpenAI WebSocket connection
   */
  async initializeOpenAIConnection(): Promise<void> {
    // Reset transmission stats for new session
    resetTransmissionStats();

    await connectOpenAI();
    await startOpenAISession();
  }

  /**
   * Closes OpenAI WebSocket connection
   */
  closeOpenAIConnection(): void {
    endOpenAISession();
    disconnectOpenAI();

    // Clear all recorded data when disconnecting
    this.clearAllData();

    // Reset audio worklet node reference
    this.audioWorkletNode = null;
  }
}

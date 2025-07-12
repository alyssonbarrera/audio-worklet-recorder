/** biome-ignore-all lint/suspicious/noConsole: log */
import { io, type Socket } from 'socket.io-client';
import type {
  ConversationItemInputAudioTranscriptionDelta,
  ResponseAudioTranscriptDelta,
} from '../components/recorder-audio/hooks/types';
import { createWAVBlobFromBase64Chunks } from '../utils/wav-utils';

type BackendReadyData = {
  message: string;
};

type ServerToClientEvents = {
  backend_ready: (data: BackendReadyData) => void;
  transcription_final: (message: string) => void;
  response_transcript_partial: (data: ResponseAudioTranscriptDelta) => void;
  response_transcript_final: (message: string) => void;
  response_text_delta: (message: string) => void;
  response_text_final: (message: string) => void;
  response_audio: (audioChunks: string[]) => void;
  response_audio_delta: (audioChunk: string) => void;
  openai_error: (error: unknown) => void;
};

type ClientToServerEvents = {
  start: () => void;
  audio_chunk: (audioData: string) => void;
  stop: () => void;
};

type EventCallbacks = {
  onBackendReady?: (data: BackendReadyData) => void;
  onTranscriptionPartial?: (
    data: ConversationItemInputAudioTranscriptionDelta
  ) => void;
  onTranscriptionFinal?: (message: string) => void;
  onResponseTranscriptFinal?: (message: string) => void;
  onResponseTextFinal?: (message: string) => void;
  onResponseAudio?: (audioChunks: string[], wavBlob?: Blob) => void;
  onResponseAudioDelta?: (audioChunk: string) => void;
  onOpenAIError?: (error: unknown) => void;
};

type TransmissionStats = {
  audioChunksSent: number;
  totalBytesBase64Sent: number;
  lastChunkSentAt: number;
  averageChunkSize: number;
};

type ConnectionStatus = {
  isConnected: boolean;
  isSessionActive: boolean;
};

/**
 * OpenAI WebSocket Client Class
 */
export class OpenAIWebSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null =
    null;
  private isConnected = false;
  private isSessionActive = false;
  private serverUrl: string;
  private eventCallbacks: EventCallbacks = {};

  // Transmission statistics
  private audioChunksSent = 0;
  private totalBytesBase64Sent = 0;
  private lastChunkSentAt = 0;

  constructor(serverUrl = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  /**
   * Sets up event handlers for all server events
   */
  private setupEventHandlers(): void {
    if (!this.socket) {
      return;
    }

    // Backend ready event
    this.socket.on('backend_ready', (data: BackendReadyData) => {
      console.log('Backend ready:', data.message);
      this.eventCallbacks.onBackendReady?.(data);
    });

    // Transcription events (user's voice)
    this.socket.on('transcription_final', (message: string) => {
      console.log('Received final transcription:', message);
      this.eventCallbacks.onTranscriptionFinal?.(message);
    });

    // Response transcript events (AI's voice transcription)
    this.socket.on('response_transcript_final', (message: string) => {
      console.log('Received final response transcript:', message);
      this.eventCallbacks.onResponseTranscriptFinal?.(message);
    });

    // Transcription events (final AI's voice transcription)
    this.socket.on('response_text_final', (message: string) => {
      console.log('Received final response text:', message);
      this.eventCallbacks.onResponseTextFinal?.(message);
    });

    // Response audio event (AI's voice)
    this.socket.on('response_audio', (audioChunks: string[]) => {
      console.log('Received response audio chunks:', audioChunks.length);

      try {
        const wavBlob = createWAVBlobFromBase64Chunks(audioChunks);
        this.eventCallbacks.onResponseAudio?.(audioChunks, wavBlob);
      } catch (error) {
        console.error('Error converting audio chunks to WAV:', error);
        this.eventCallbacks.onResponseAudio?.(audioChunks);
      }
    });

    // Response audio delta event (AI's voice streaming)
    this.socket.on('response_audio_delta', (audioChunk: string) => {
      console.log('Received response audio delta chunk');
      this.eventCallbacks.onResponseAudioDelta?.(audioChunk);
    });

    // Error handling
    this.socket.on('openai_error', (error: unknown) => {
      console.error('OpenAI error:', error);
      this.eventCallbacks.onOpenAIError?.(error);
    });
  }

  /**
   * Connects to the backend socket server
   */
  connect(): Promise<void> {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
    });

    return new Promise<void>((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Failed to create socket'));
        return;
      }

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.setupEventHandlers();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        reject(error);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.isSessionActive = false;
      });
    });
  }

  /**
   * Starts a session with WebSocket server
   */
  startSession(): Promise<void> {
    if (!(this.isConnected && this.socket)) {
      return Promise.reject(new Error('Socket is not connected'));
    }

    if (this.isSessionActive) {
      return Promise.resolve();
    }

    this.socket.emit('start');
    this.isSessionActive = true;
    return Promise.resolve();
  }

  /**
   * Sends audio chunk to OpenAI via WebSocket
   */
  sendAudioChunk(base64Audio: string): void {
    if (!(this.isConnected && this.isSessionActive && this.socket)) {
      return;
    }

    // Update transmission statistics
    this.audioChunksSent++;
    this.totalBytesBase64Sent += base64Audio.length;
    this.lastChunkSentAt = Date.now();

    this.socket.emit('audio_chunk', base64Audio);
  }

  /**
   * Stops the audio stream to OpenAI
   */
  stopAudioStream(): void {
    if (!(this.isConnected && this.isSessionActive && this.socket)) {
      return;
    }

    this.socket.emit('stop');
  }

  /**
   * Notifies backend when mute is activated
   */
  notifyMute(): void {
    if (!(this.isConnected && this.socket)) {
      return;
    }

    this.socket.emit('stop');
  }

  /**
   * Ends the session with OpenAI
   */
  endSession(): void {
    if (!(this.isConnected && this.isSessionActive && this.socket)) {
      return;
    }

    this.disconnect();
  }

  /**
   * Disconnects from the backend
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.isSessionActive = false;
  }

  /**
   * Gets the current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      isConnected: this.isConnected,
      isSessionActive: this.isSessionActive,
    };
  }

  /**
   * Gets transmission statistics
   */
  getTransmissionStats(): TransmissionStats {
    return {
      audioChunksSent: this.audioChunksSent,
      totalBytesBase64Sent: this.totalBytesBase64Sent,
      lastChunkSentAt: this.lastChunkSentAt,
      averageChunkSize:
        this.audioChunksSent > 0
          ? this.totalBytesBase64Sent / this.audioChunksSent
          : 0,
    };
  }

  /**
   * Resets transmission statistics
   */
  resetTransmissionStats(): void {
    this.audioChunksSent = 0;
    this.totalBytesBase64Sent = 0;
    this.lastChunkSentAt = 0;
  }

  /**
   * Sets event callback handlers
   */
  setEventCallbacks(callbacks: EventCallbacks): void {
    Object.assign(this.eventCallbacks, callbacks);
  }

  /**
   * Clears all event callbacks
   */
  clearEventCallbacks(): void {
    for (const key of Object.keys(this.eventCallbacks)) {
      delete this.eventCallbacks[key as keyof EventCallbacks];
    }
  }

  /**
   * Sets a specific event callback
   */
  on<K extends keyof EventCallbacks>(
    event: K,
    callback: EventCallbacks[K]
  ): void {
    this.eventCallbacks[event] = callback;
  }

  /**
   * Removes a specific event callback
   */
  off<K extends keyof EventCallbacks>(event: K): void {
    delete this.eventCallbacks[event];
  }
}

export const defaultClient = new OpenAIWebSocketClient();

export const connect = () => defaultClient.connect();
export const startSession = () => defaultClient.startSession();
export const sendAudioChunk = (data: string) =>
  defaultClient.sendAudioChunk(data);
export const stopAudioStream = () => defaultClient.stopAudioStream();
export const notifyMute = () => defaultClient.notifyMute();
export const endSession = () => defaultClient.endSession();
export const disconnect = () => defaultClient.disconnect();
export const getConnectionStatus = () => defaultClient.getConnectionStatus();
export const getTransmissionStats = () => defaultClient.getTransmissionStats();
export const resetTransmissionStats = () =>
  defaultClient.resetTransmissionStats();
export const setEventCallbacks = (callbacks: EventCallbacks) =>
  defaultClient.setEventCallbacks(callbacks);

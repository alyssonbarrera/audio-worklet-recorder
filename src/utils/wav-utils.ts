import { base64ToFloat32Array, combineAudioBuffers } from './audio-utils';

const WAV_HEADER_SIZE = 44;
const WAV_RIFF = 'RIFF';
const WAV_WAVE = 'WAVE';
const WAV_FMT = 'fmt ';
const WAV_DATA = 'data';

function writeStringToDataView(
  view: DataView,
  offset: number,
  string: string
): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function writeWAVHeader(
  view: DataView,
  audioDataLength: number,
  sampleRate: number
): void {
  const fileSize = WAV_HEADER_SIZE + audioDataLength * 2;

  writeStringToDataView(view, 0, WAV_RIFF);
  view.setUint32(4, fileSize - 8, true);
  writeStringToDataView(view, 8, WAV_WAVE);

  writeStringToDataView(view, 12, WAV_FMT);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);

  writeStringToDataView(view, 36, WAV_DATA);
  view.setUint32(40, audioDataLength * 2, true);
}

function writeAudioDataToView(view: DataView, audioData: Float32Array): void {
  const offset = WAV_HEADER_SIZE;

  for (let i = 0; i < audioData.length; i++) {
    const clampedSample = Math.max(-1, Math.min(1, audioData[i]));
    const intSample =
      clampedSample < 0 ? clampedSample * 0x80_00 : clampedSample * 0x7f_ff;
    view.setInt16(offset + i * 2, intSample, true);
  }
}

export function createWAVBlob(
  audioData: Float32Array,
  sampleRate: number
): Blob {
  const bufferSize = WAV_HEADER_SIZE + audioData.length * 2;
  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  writeWAVHeader(view, audioData.length, sampleRate);
  writeAudioDataToView(view, audioData);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Converts base64 audio chunks to WAV Blob
 */
export function createWAVBlobFromBase64Chunks(
  base64AudioChunks: string[],
  sampleRate = 24_000
): Blob {
  // Convert each base64 chunk to Float32Array
  const audioBuffers = base64AudioChunks.map((chunk) =>
    base64ToFloat32Array(chunk)
  );

  // Combine all audio buffers into a single Float32Array
  const combinedAudioData = combineAudioBuffers(audioBuffers);

  // Create WAV blob
  return createWAVBlob(combinedAudioData, sampleRate);
}

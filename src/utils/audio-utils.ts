export const SAMPLE_RATE_24KHZ = 24_000;
export const SAMPLE_RATE_44KHZ = 44_100;
export const PCM_16_BIT_MIN = -0x80_00;
export const PCM_16_BIT_MAX = 0x7f_ff;

export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  let offset = 0;
  for (let i = 0; i < float32Array.length; i++, offset += 2) {
    const clampedValue = Math.max(-1, Math.min(1, float32Array[i]));
    const sample = Math.round(clampedValue * 32_767);
    view.setInt16(offset, sample, true);
  }
  return buffer;
}

export function base64EncodeAudio(float32Array: Float32Array): string {
  const arrayBuffer = floatTo16BitPCM(float32Array);
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 32 * 1024;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function combineAudioBuffers(buffers: Float32Array[]): Float32Array {
  const totalLength = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const combinedBuffer = new Float32Array(totalLength);

  let offset = 0;
  for (const buffer of buffers) {
    combinedBuffer.set(buffer, offset);
    offset += buffer.length;
  }

  return combinedBuffer;
}
export function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 8192;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    let chunkString = '';
    for (const byte of chunk) {
      chunkString += String.fromCharCode(byte);
    }
    binary += chunkString;
  }

  return btoa(binary);
}

export function createPCMBuffer(float32Array: Float32Array): ArrayBuffer {
  return floatTo16BitPCM(float32Array);
}

export function createBase64PCMBuffer(float32Array: Float32Array): string {
  return base64EncodeAudio(float32Array);
}

/**
 * Converts a base64 string to ArrayBuffer
 */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Converts PCM16 ArrayBuffer to Float32Array
 */
export function pcm16ToFloat32Array(arrayBuffer: ArrayBuffer): Float32Array {
  const pcmView = new Int16Array(arrayBuffer);
  const float32Array = new Float32Array(pcmView.length);

  for (let i = 0; i < pcmView.length; i++) {
    float32Array[i] = pcmView[i] / 32_767;
  }

  return float32Array;
}

/**
 * Converts base64 PCM16 data to Float32Array
 */
export function base64ToFloat32Array(base64: string): Float32Array {
  const arrayBuffer = base64ToArrayBuffer(base64);
  return pcm16ToFloat32Array(arrayBuffer);
}

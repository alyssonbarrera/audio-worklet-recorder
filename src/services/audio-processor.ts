/** biome-ignore-all lint/suspicious/noConsole: needed for audio debugging */
import { combineAudioBuffers, createPCMBuffer } from '../utils/audio-utils';

export class AudioProcessor {
  private allRecordedData: Float32Array[] = [];
  private onPCMDataReady?: (pcmBuffer: ArrayBuffer) => void;
  private isMuted = false;

  constructor(onPCMDataReady?: (pcmBuffer: ArrayBuffer) => void) {
    this.onPCMDataReady = onPCMDataReady;
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  getMuted(): boolean {
    return this.isMuted;
  }

  addAudioData(data: Float32Array): void {
    this.allRecordedData.push(new Float32Array(data));
  }

  addResampledAudioData(data: Float32Array): void {
    if (this.validateAudioData(data) && !this.isMuted && this.onPCMDataReady) {
      const pcmBuffer = createPCMBuffer(data);
      this.onPCMDataReady(pcmBuffer);
    }
  }

  private validateAudioData(data: Float32Array): boolean {
    if (data.length === 0) {
      return false;
    }

    const invalidSamples = data.filter(
      (sample) => !Number.isFinite(sample)
    ).length;
    if (invalidSamples > 0) {
      console.warn(`Found ${invalidSamples} invalid audio samples`);
      return false;
    }

    const outOfRangeSamples = data.filter(
      (sample) => Math.abs(sample) > 1.0
    ).length;

    if (outOfRangeSamples > 0) {
      console.warn(
        `Found ${outOfRangeSamples} audio samples outside valid range`
      );
      return false;
    }

    const firstValue = data[0];
    const allSameValue = data.every((sample) => sample === firstValue);

    if (allSameValue && Math.abs(firstValue) > 0.001) {
      console.warn(
        'All audio samples have the same non-zero value (suspicious)'
      );
      return false;
    }

    return true;
  }

  getAllRecordedData(): Float32Array {
    return combineAudioBuffers(this.allRecordedData);
  }

  clearAllData(): void {
    this.allRecordedData = [];
  }
}

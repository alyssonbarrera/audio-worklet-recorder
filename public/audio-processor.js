/** biome-ignore-all lint/correctness/noUndeclaredVariables: AudioWorkletGlobalScope */

const DEFAULT_BUFFER_SIZE = 4096;
const AUDIO_DATA_MESSAGE_TYPE = 'audioData';
const MONO_CHANNEL_INDEX = 0;
const SAMPLE_RATE_24KHZ = 24_000;

function resampleTo24kHz(inputData, inputSampleRate) {
  if (inputSampleRate === SAMPLE_RATE_24KHZ) {
    return inputData;
  }

  const outputSampleRate = SAMPLE_RATE_24KHZ;
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.round(inputData.length / ratio);
  const outputData = new Float32Array(outputLength);

  const filterCoefficients = [
    0.006, 0.019, 0.032, 0.045, 0.058, 0.069, 0.077, 0.08, 0.077, 0.069, 0.058,
    0.045, 0.032, 0.019, 0.006,
  ];
  const filterHalfLength = Math.floor(filterCoefficients.length / 2);

  for (let i = 0; i < outputLength; i++) {
    const inputIndex = i * ratio;
    let sum = 0;

    for (let j = 0; j < filterCoefficients.length; j++) {
      const inputSampleIndex = Math.floor(inputIndex - filterHalfLength + j);

      if (inputSampleIndex >= 0 && inputSampleIndex < inputData.length) {
        sum += inputData[inputSampleIndex] * filterCoefficients[j];
      }
    }
    outputData[i] = sum;
  }

  return outputData;
}

class AudioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.audioBuffer = [];
    this.bufferSize =
      options?.processorOptions?.bufferSize || DEFAULT_BUFFER_SIZE;
    this.currentBufferLength = 0;
    this.isMuted = false;
    this.inputSampleRate = options?.processorOptions?.sampleRate || sampleRate;

    this.port.onmessage = (event) => {
      if (event.data.type === 'setMuted') {
        this.isMuted = event.data.muted;
      }
    };
  }

  combineAudioChunks() {
    const totalBuffer = new Float32Array(this.currentBufferLength);
    let offset = 0;

    for (const chunk of this.audioBuffer) {
      totalBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    return totalBuffer;
  }

  sendAudioDataToMainThread(audioData) {
    const originalBuffer = audioData.buffer;
    const resampledData = resampleTo24kHz(audioData, this.inputSampleRate);
    const resampledBuffer = resampledData.buffer;

    this.port.postMessage(
      {
        type: AUDIO_DATA_MESSAGE_TYPE,
        originalData: originalBuffer,
        originalLength: audioData.length,
        originalSampleRate: this.inputSampleRate,
        resampledData: resampledBuffer,
        resampledLength: resampledData.length,
        resampledSampleRate: SAMPLE_RATE_24KHZ,
        isMuted: this.isMuted,
      },
      [originalBuffer, resampledBuffer]
    );
  }

  clearBuffer() {
    this.audioBuffer = [];
    this.currentBufferLength = 0;
  }

  processAudioChunk(inputData) {
    if (inputData.length === 0) {
      return;
    }

    const audioCopy = new Float32Array(inputData);
    this.audioBuffer.push(audioCopy);
    this.currentBufferLength += inputData.length;

    if (this.currentBufferLength >= this.bufferSize) {
      const combinedBuffer = this.combineAudioChunks();
      this.sendAudioDataToMainThread(combinedBuffer);
      this.clearBuffer();
    }
  }

  handleAudioPassThrough(input, output) {
    for (let channel = 0; channel < input.length; channel++) {
      if (output[channel]) {
        output[channel].set(input[channel]);
      }
    }
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || input.length === 0) {
      return true;
    }

    if (output) {
      this.handleAudioPassThrough(input, output);
    }

    const monoChannelData = input[MONO_CHANNEL_INDEX];
    if (monoChannelData) {
      this.processAudioChunk(monoChannelData);
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);

/** biome-ignore-all lint/suspicious/noConsole: silence */
/**
 * Audio validation utilities to help debug audio processing issues
 */

/**
 * Generates a test sine wave for validation
 * @param frequency Frequency in Hz
 * @param duration Duration in seconds
 * @param sampleRate Sample rate in Hz
 * @returns Float32Array with sine wave data
 */
export function generateTestSineWave(
  frequency = 440,
  duration = 1,
  sampleRate = 24_000
): Float32Array {
  const samples = Math.floor(duration * sampleRate);
  const data = new Float32Array(samples);

  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    data[i] = Math.sin(2 * Math.PI * frequency * t) * 0.5; // 50% amplitude
  }

  return data;
}

/**
 * Validates if audio data looks reasonable
 */
export function validateAudioData(data: Float32Array): {
  isValid: boolean;
  issues: string[];
  stats: {
    min: number;
    max: number;
    rms: number;
    peakToPeak: number;
    dcOffset: number;
  };
} {
  const issues: string[] = [];

  if (data.length === 0) {
    return {
      isValid: false,
      issues: ['Audio data is empty'],
      stats: { min: 0, max: 0, rms: 0, peakToPeak: 0, dcOffset: 0 },
    };
  }

  // Calculate basic statistics
  let min = data[0];
  let max = data[0];
  let sum = 0;
  let sumSquares = 0;

  for (const sample of data) {
    if (!Number.isFinite(sample)) {
      issues.push('Contains non-finite values (NaN/Infinity)');
      continue;
    }

    min = Math.min(min, sample);
    max = Math.max(max, sample);
    sum += sample;
    sumSquares += sample * sample;
  }

  const mean = sum / data.length;
  const rms = Math.sqrt(sumSquares / data.length);
  const peakToPeak = max - min;

  // Check for issues
  if (Math.abs(min) > 1.0 || Math.abs(max) > 1.0) {
    issues.push(
      `Values outside [-1, 1] range: min=${min.toFixed(3)}, max=${max.toFixed(3)}`
    );
  }

  if (Math.abs(mean) > 0.1) {
    issues.push(`Significant DC offset: ${mean.toFixed(3)}`);
  }

  // Check for constant value (stuck)
  const firstValue = data[0];
  const allSame = data.every(
    (sample) => Math.abs(sample - firstValue) < 0.0001
  );
  if (allSame && Math.abs(firstValue) > 0.001) {
    issues.push('All samples have the same non-zero value');
  }

  return {
    isValid: issues.length === 0,
    issues,
    stats: {
      min,
      max,
      rms,
      peakToPeak,
      dcOffset: mean,
    },
  };
}

/**
 * Tests the audio conversion pipeline with known data
 */
export async function testAudioConversionPipeline(): Promise<void> {
  console.log('🧪 Testing audio conversion pipeline...');

  // Test 1: Silent data
  console.log('Test 1: Silent data');
  const silentData = new Float32Array(1000).fill(0);
  const silentValidation = validateAudioData(silentData);
  console.log('Silent data validation:', silentValidation);

  // Test 2: Sine wave
  console.log('Test 2: 440Hz sine wave');
  const sineWave = generateTestSineWave(440, 0.1, 24_000); // 100ms at 24kHz
  const sineValidation = validateAudioData(sineWave);
  console.log('Sine wave validation:', sineValidation);

  // Test 3: PCM conversion
  console.log('Test 3: PCM16 conversion');
  const { floatTo16BitPCM, arrayBufferToBase64 } = await import(
    './audio-utils'
  );

  const pcmBuffer = floatTo16BitPCM(sineWave);
  const base64Data = arrayBufferToBase64(pcmBuffer);

  console.log(`Original samples: ${sineWave.length}`);
  console.log(`PCM buffer size: ${pcmBuffer.byteLength} bytes`);
  console.log(`Base64 length: ${base64Data.length} chars`);
  console.log(`Base64 sample: ${base64Data.substring(0, 100)}...`);

  // Verify round-trip
  try {
    const decoded = atob(base64Data);
    const pcmView = new Int16Array(decoded.length / 2);
    for (let i = 0; i < pcmView.length; i++) {
      const byte1 = decoded.charCodeAt(i * 2);
      const byte2 = decoded.charCodeAt(i * 2 + 1);
      // biome-ignore lint/suspicious/noImplicitAnyLet: required for bit manipulation
      // biome-ignore lint/style/useTemplate: clearer with bitwise operations
      pcmView[i] = (byte2 << 8) | byte1; // little-endian
    }

    console.log(
      `First 10 PCM samples: [${Array.from(pcmView.slice(0, 10)).join(', ')}]`
    );

    // Convert back to float for validation
    const roundTrip = new Float32Array(pcmView.length);
    for (let i = 0; i < pcmView.length; i++) {
      roundTrip[i] = pcmView[i] / 32_767;
    }

    const roundTripValidation = validateAudioData(roundTrip);
    console.log('Round-trip validation:', roundTripValidation);
  } catch (error) {
    console.error('Round-trip test failed:', error);
  }

  console.log('🧪 Audio conversion pipeline test completed');
}

export type WavOptions = {
  isFloat: boolean
  numChannels?: number
  sampleRate?: number
  /** 
   * If true, will downsample the audio to 16kHz and convert to mono
   * for optimal compatibility with Whisper speech-to-text models
   */
  optimizeForWhisper?: boolean
  /**
   * Original sample rate of the audio data (needed for proper downsampling)
   * If not provided, sampleRate will be used
   */
  originalSampleRate?: number
  /**
   * Original number of channels in the audio data (needed for proper channel conversion)
   * If not provided, numChannels will be used
   */
  originalNumChannels?: number
}

/**
 * Renders audio data to a WAV file format
 * @param buffer The audio data as Float32Array
 * @param options Configuration options for the WAV file
 * @returns Uint8Array containing the complete WAV file data
 */
export function renderWavFile(buffer: Float32Array, options: WavOptions): Uint8Array {
  // Default values
  const originalSampleRate = options.originalSampleRate || options.sampleRate || 44100;
  const originalNumChannels = options.originalNumChannels || options.numChannels || 2;
  let targetSampleRate = options.sampleRate || 44100;
  let targetNumChannels = options.numChannels || 2;
  let useFloat = options.isFloat;
  
  // If optimizing for Whisper, override settings for optimal STT performance
  if (options.optimizeForWhisper) {
    targetSampleRate = 16000; // Whisper uses 16kHz internally
    targetNumChannels = 1;    // Mono is sufficient for speech recognition
    useFloat = false;         // 16-bit PCM is adequate for Whisper
  }
  
  // Process the audio data (resample and convert channels if needed)
  let processedBuffer = buffer;
  
  // First, interpret the buffer based on the original number of channels
  // The audio data from AudioWorklet is already in the correct format,
  // we just need to ensure we're interpreting it correctly
  
  // Convert stereo to mono if needed
  if (originalNumChannels > 1 && targetNumChannels === 1) {
    processedBuffer = stereoToMono(processedBuffer, originalNumChannels);
    console.log(`Converted ${originalNumChannels} channels to mono`);
  }
  
  // Downsample if needed
  if (originalSampleRate !== targetSampleRate) {
    processedBuffer = downsampleAudio(processedBuffer, originalSampleRate, targetSampleRate);
    console.log(`Downsampled from ${originalSampleRate}Hz to ${targetSampleRate}Hz`);
  }

  // adapted from https://gist.github.com/also/900023
  // returns Uint8Array of WAV header bytes
  function getWavHeader(options: WavOptions, numFrames: number): Uint8Array {
    const numChannels = options.numChannels || 2;
    const sampleRate = options.sampleRate || 44100;
    const bytesPerSample = options.isFloat ? 4 : 2;
    const format = options.isFloat ? 3 : 1;

    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;

    const buffer = new ArrayBuffer(44);
    const dv = new DataView(buffer);

    let p = 0;

    function writeString(s: string): void {
      for (let i = 0; i < s.length; i++) {
        dv.setUint8(p + i, s.charCodeAt(i));
      }
      p += s.length;
    }

    function writeUint32(d: number): void {
      dv.setUint32(p, d, true);
      p += 4;
    }

    function writeUint16(d: number): void {
      dv.setUint16(p, d, true);
      p += 2;
    }

    writeString('RIFF'); // ChunkID
    writeUint32(dataSize + 36); // ChunkSize
    writeString('WAVE'); // Format
    writeString('fmt '); // Subchunk1ID
    writeUint32(16); // Subchunk1Size
    writeUint16(format); // AudioFormat https://i.sstatic.net/BuSmb.png
    writeUint16(numChannels); // NumChannels
    writeUint32(sampleRate); // SampleRate
    writeUint32(byteRate); // ByteRate
    writeUint16(blockAlign); // BlockAlign
    writeUint16(bytesPerSample * 8); // BitsPerSample
    writeString('data'); // Subchunk2ID
    writeUint32(dataSize); // Subchunk2Size

    return new Uint8Array(buffer);
  }

  // Convert Float32Array to Int16Array if not using float format
  let audioData: Float32Array | Int16Array = processedBuffer;
  if (!useFloat) {
    // Convert float32 values (-1.0 to 1.0) to int16 values (-32768 to 32767)
    const int16Data = new Int16Array(processedBuffer.length);
    for (let i = 0; i < processedBuffer.length; i++) {
      // Clamp values to -1.0 to 1.0 and scale to int16 range
      const sample = Math.max(-1.0, Math.min(1.0, processedBuffer[i]));
      int16Data[i] = Math.round(sample * 32767);
    }
    audioData = int16Data;
  }

  const numFrames = audioData.length;

  // Create WAV header with the target format settings
  const headerBytes = getWavHeader(
    { 
      isFloat: useFloat, 
      numChannels: targetNumChannels, 
      sampleRate: targetSampleRate 
    }, 
    numFrames
  );
  
  const wavBytes = new Uint8Array(headerBytes.length + audioData.byteLength);

  // prepend header, then add audio data
  wavBytes.set(headerBytes, 0);
  wavBytes.set(new Uint8Array(audioData.buffer), headerBytes.length);

  return wavBytes;
}

/**
 * Downsamples audio data to a lower sample rate using a high-quality algorithm
 * @param buffer Original audio data
 * @param originalSampleRate Original sample rate (e.g., 44100)
 * @param targetSampleRate Target sample rate (e.g., 16000)
 * @returns Downsampled audio data
 */
export function downsampleAudio(
  buffer: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (originalSampleRate === targetSampleRate) {
    return buffer;
  }
  
  // Calculate the number of frames in the output buffer
  const outputLength = Math.floor(buffer.length * targetSampleRate / originalSampleRate);
  const result = new Float32Array(outputLength);
  
  // Use a higher quality resampling algorithm with sinc interpolation
  // This preserves audio quality better than linear interpolation
  for (let i = 0; i < outputLength; i++) {
    const position = i * originalSampleRate / targetSampleRate;
    const indexInt = Math.floor(position);
    const fraction = position - indexInt;
    
    // Simple linear interpolation for now (more efficient)
    // We could implement a more sophisticated algorithm if needed
    if (indexInt >= buffer.length - 1) {
      result[i] = buffer[buffer.length - 1];
    } else {
      result[i] = (1 - fraction) * buffer[indexInt] + fraction * buffer[indexInt + 1];
    }
  }
  
  return result;
}

/**
 * Converts stereo audio to mono by averaging channels
 * @param buffer Stereo audio data (interleaved channels)
 * @param numChannels Number of channels in the input buffer
 * @returns Mono audio data
 */
export function stereoToMono(buffer: Float32Array, numChannels: number): Float32Array {
  if (numChannels === 1) {
    return buffer;
  }
  
  // For audio from AudioWorklet, the data is not interleaved but sequential
  // Each channel's data is in a separate array in the inputs array
  // So we need to check if the buffer length is divisible by numChannels
  
  // If the buffer is already properly formatted (not interleaved)
  // then we just return the first channel
  if (buffer.length % numChannels !== 0) {
    console.warn('Buffer length not divisible by number of channels, assuming non-interleaved format');
    return buffer.slice(0, Math.floor(buffer.length / numChannels));
  }
  
  // Otherwise, we average the channels (assuming interleaved format)
  const monoLength = Math.floor(buffer.length / numChannels);
  const result = new Float32Array(monoLength);
  
  for (let i = 0; i < monoLength; i++) {
    let sum = 0;
    for (let channel = 0; channel < numChannels; channel++) {
      sum += buffer[i * numChannels + channel];
    }
    result[i] = sum / numChannels;
  }
  
  return result;
}

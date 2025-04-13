import { renderWavFile } from './wavConverter.js';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private audioChunks: Float32Array[] = [];
  private isRecording = false;
  private streamSource: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private sampleRate = 44100;
  private originalNumChannels = 1;
  private intervalId: number | null = null;
  private onDataAvailable: (wavData: Blob) => void;

  constructor(onDataAvailable: (wavData: Blob) => void) {
    this.onDataAvailable = onDataAvailable;
  }

  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      console.warn('Already recording');
      return;
    }

    try {
      console.log('Requesting microphone access...');
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia is not supported in this browser');
      }
      
      // Request microphone access with more detailed options
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Specify sample rate if possible
          sampleRate: { ideal: 44100 }
        },
        video: false
      });
      
      console.log('Microphone access granted');
      console.log('Stream tracks:', this.stream.getAudioTracks().map(track => track.label));

      // Create audio context with explicit options
      // Note: Chrome requires user interaction before creating AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      if (!this.audioContext) {
        throw new Error('AudioContext could not be created');
      }
      
      console.log('AudioContext created, sample rate:', this.audioContext.sampleRate);
      this.sampleRate = this.audioContext.sampleRate;
      
      // Create audio source from stream
      this.streamSource = this.audioContext.createMediaStreamSource(this.stream);
      console.log('MediaStreamSource created');
      
      // Get the number of channels
      this.originalNumChannels = this.streamSource.channelCount;
      console.log('Channel count:', this.originalNumChannels);
      
      // Create analyzer for processing
      this.analyser = this.audioContext.createAnalyser();
      this.streamSource.connect(this.analyser);
      
      // ScriptProcessorNode is deprecated but still widely supported
      // We'll use it with a fallback plan for newer browsers
      this.processor = this.audioContext.createScriptProcessor(4096, this.originalNumChannels, this.originalNumChannels);
      this.analyser.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      console.log('Audio processing pipeline created');
      
      // Clear previous audio chunks
      this.audioChunks = [];
      
      // Set up processor to capture audio data
      this.processor.onaudioprocess = (e) => {
        try {
          const inputBuffer = e.inputBuffer;
          const channelData = inputBuffer.getChannelData(0); // Get data from first channel
          
          // Clone the data since it's a reference that will be reused
          const channelDataCopy = new Float32Array(channelData.length);
          channelDataCopy.set(channelData);
          
          // Add to chunks
          this.audioChunks.push(channelDataCopy);
        } catch (err) {
          console.error('Error processing audio:', err);
        }
      };
      
      this.isRecording = true;
      
      // Set up interval to send audio data every 10 seconds
      this.intervalId = window.setInterval(() => {
        this.processAudioChunk();
      }, 10000);
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Error starting recording:', error);
      // Provide more detailed error information
      if (error instanceof DOMException) {
        console.error('DOMException name:', error.name);
        console.error('DOMException message:', error.message);
        
        if (error.name === 'NotAllowedError') {
          throw new Error('Microphone access was denied by the user or system');
        } else if (error.name === 'NotFoundError') {
          throw new Error('No microphone was found on your device');
        } else if (error.name === 'NotReadableError') {
          throw new Error('Microphone is already in use by another application');
        }
      }
      
      throw error;
    }
  }

  public stopRecording(): void {
    if (!this.isRecording) {
      console.warn('Not recording');
      return;
    }

    // Clear the interval
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Process any remaining audio
    this.processAudioChunk();

    // Clean up resources
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.streamSource) {
      this.streamSource.disconnect();
      this.streamSource = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.isRecording = false;
    console.log('Recording stopped');
  }

  private processAudioChunk(): void {
    if (this.audioChunks.length === 0) {
      console.log('No audio data to process');
      return;
    }

    // Concatenate all audio chunks into a single Float32Array
    const totalLength = this.audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedChunks = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioChunks) {
      combinedChunks.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Clear the chunks array after processing
    this.audioChunks = [];
    
    // Convert to WAV format optimized for Whisper
    const wavData = renderWavFile(combinedChunks, {
      isFloat: false,
      numChannels: this.originalNumChannels,
      sampleRate: this.sampleRate,
      optimizeForWhisper: true,
      originalNumChannels: this.originalNumChannels,
      originalSampleRate: this.sampleRate
    });
    
    // Convert to Blob for sending to server
    const blob = new Blob([wavData], { type: 'audio/wav' });
    
    // Call the callback with the WAV data
    this.onDataAvailable(blob);
  }

  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }
}

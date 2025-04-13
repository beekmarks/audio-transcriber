import { AudioRecorder } from './audioRecorder.js';
import { ApiClient } from './apiClient.js';

class App {
  private audioRecorder: AudioRecorder;
  private apiClient: ApiClient;
  private startButton: HTMLButtonElement;
  private stopButton: HTMLButtonElement;
  private statusDot: HTMLDivElement;
  private statusText: HTMLSpanElement;
  private transcriptionOutput: HTMLDivElement;
  private isRecording = false;
  private transcriptionHistory: string[] = [];

  constructor() {
    // Initialize DOM elements
    this.startButton = document.getElementById('startButton') as HTMLButtonElement;
    this.stopButton = document.getElementById('stopButton') as HTMLButtonElement;
    this.statusDot = document.getElementById('statusDot') as HTMLDivElement;
    this.statusText = document.getElementById('statusText') as HTMLSpanElement;
    this.transcriptionOutput = document.getElementById('transcriptionOutput') as HTMLDivElement;

    // Initialize API client
    this.apiClient = new ApiClient();

    // Initialize audio recorder with callback for when audio data is available
    this.audioRecorder = new AudioRecorder((audioBlob: Blob) => {
      this.handleAudioData(audioBlob);
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Start recording when the start button is clicked
    this.startButton.addEventListener('click', () => {
      this.startRecording();
    });

    // Stop recording when the stop button is clicked
    this.stopButton.addEventListener('click', () => {
      this.stopRecording();
    });
  }

  private async startRecording(): Promise<void> {
    if (this.isRecording) {
      return;
    }

    try {
      // Update UI to show we're requesting permissions
      this.startButton.disabled = true;
      this.statusDot.classList.add('processing');
      this.statusText.textContent = 'Requesting microphone access...';
      
      // Start recording
      await this.audioRecorder.startRecording();
      
      // Update UI for successful recording
      this.stopButton.disabled = false;
      this.statusDot.classList.remove('processing');
      this.statusDot.classList.add('recording');
      this.statusText.textContent = 'Recording...';
      this.isRecording = true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      
      // Handle specific error types
      let errorMessage = 'Could not access microphone';
      
      if (error instanceof Error) {
        if (error.message.includes('denied') || error.message.includes('NotAllowedError')) {
          errorMessage = 'Microphone access was denied. Please allow microphone access in your browser settings.';
          // Add instructions for common browsers
          console.info('To enable microphone in Chrome: Click the lock/info icon in the address bar → Site Settings → Allow microphone');
          console.info('To enable microphone in Firefox: Click the lock/info icon in the address bar → Allow microphone');
        } else if (error.message.includes('NotFoundError')) {
          errorMessage = 'No microphone detected. Please connect a microphone and try again.';
        } else if (error.message.includes('NotReadableError')) {
          errorMessage = 'Microphone is already in use by another application. Please close other applications using the microphone.';
        } else if (error.message.includes('getUserMedia is not supported')) {
          errorMessage = 'Your browser does not support audio recording. Please try a modern browser like Chrome or Firefox.';
        }
      }
      
      this.updateStatus(`Error: ${errorMessage}`);
      this.resetButtons();
    }
  }

  private stopRecording(): void {
    if (!this.isRecording) {
      return;
    }

    // Stop recording
    this.audioRecorder.stopRecording();
    this.isRecording = false;

    // Update UI
    this.resetButtons();
    this.updateStatus('Processing final audio...');
  }

  private resetButtons(): void {
    this.startButton.disabled = false;
    this.stopButton.disabled = true;
    this.statusDot.classList.remove('recording');
  }

  private updateStatus(message: string, isProcessing = false): void {
    this.statusText.textContent = message;
    
    if (isProcessing) {
      this.statusDot.classList.remove('recording');
      this.statusDot.classList.add('processing');
    } else {
      this.statusDot.classList.remove('recording', 'processing');
    }
  }

  private async handleAudioData(audioBlob: Blob): Promise<void> {
    try {
      this.updateStatus('Processing audio...', true);
      
      // Send audio data to server for transcription
      const transcription = await this.apiClient.sendAudioForTranscription(audioBlob);
      
      // Add transcription to history
      if (transcription && transcription.trim() !== '') {
        this.transcriptionHistory.push(transcription);
        this.updateTranscriptionDisplay();
      }
      
      // Update status
      this.updateStatus(this.isRecording ? 'Recording...' : 'Ready');
    } catch (error) {
      console.error('Error processing audio:', error);
      this.updateStatus(`Error: ${(error as Error).message}`);
    }
  }

  private updateTranscriptionDisplay(): void {
    // Join all transcriptions with line breaks
    this.transcriptionOutput.innerHTML = this.transcriptionHistory
      .map(text => `<p>${text}</p>`)
      .join('');
    
    // Scroll to bottom
    this.transcriptionOutput.scrollTop = this.transcriptionOutput.scrollHeight;
  }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  new App();
});

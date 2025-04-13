import * as fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { TranscriptionService } from './transcriptionServiceFactory.js';

export class OpenAIWhisperService implements TranscriptionService {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  public async transcribeAudio(wavFilePath: string): Promise<string> {
    try {
      console.log(`Transcribing audio from ${wavFilePath} using OpenAI Whisper API`);
      
      // Create form data with the audio file
      const formData = new FormData();
      formData.append('file', fs.createReadStream(wavFilePath));
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');
      
      // Send request to OpenAI API
      const startTime = Date.now();
      console.log(`Request started at: ${new Date(startTime).toISOString()}`);
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      const endTime = Date.now();
      console.log(`Request ended at: ${new Date(endTime).toISOString()}`);
      console.log(`Duration: ${endTime - startTime} ms`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Transcription response:', data);
      
      // Type check the response data
      if (typeof data === 'object' && data !== null && 'text' in data && typeof data.text === 'string') {
        return data.text;
      } else {
        console.error('Unexpected response format from OpenAI API:', data);
        throw new Error('Invalid response format from OpenAI API');
      }
    } catch (error) {
      console.error('Error transcribing audio with OpenAI:', error);
      throw error;
    }
  }
}

import { AwsService } from './awsService.js';
import { OpenAIWhisperService } from './openAIWhisperService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface TranscriptionService {
  transcribeAudio(wavFilePath: string): Promise<string>;
}

export class TranscriptionServiceFactory {
  public static createService(): TranscriptionService {
    const serviceType = process.env.TRANSCRIPTION_SERVICE || 'aws';
    
    console.log(`Creating transcription service of type: ${serviceType}`);
    
    switch (serviceType.toLowerCase()) {
      case 'aws':
        return new AwsService();
      case 'openai':
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is required for OpenAI service');
        }
        return new OpenAIWhisperService(apiKey);
      default:
        throw new Error(`Unknown transcription service type: ${serviceType}`);
    }
  }
}

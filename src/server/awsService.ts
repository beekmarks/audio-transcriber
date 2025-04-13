import { SageMakerRuntimeClient, InvokeEndpointCommand } from "@aws-sdk/client-sagemaker-runtime";
import { fromIni } from "@aws-sdk/credential-providers";
import * as fs from 'fs';
import * as https from 'https';
import { fileURLToPath } from 'url';
import * as path from 'path';
import { TranscriptionService } from './transcriptionServiceFactory.js';

// Get the current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a custom HTTPS agent that doesn't verify certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Define the endpoint name
const ENDPOINT_NAME = 'dlsg-ds-asr-real-time-djl-2-endpoint';

/**
 * Service for interacting with AWS SageMaker for speech-to-text
 */
export class AwsService implements TranscriptionService {
  private client: SageMakerRuntimeClient;

  constructor() {
    // Initialize SageMaker client with AWS credentials from the default profile
    this.client = new SageMakerRuntimeClient({
      region: 'us-east-1',
      credentials: fromIni({ profile: 'default' }),
      requestHandler: {
        // @ts-ignore - Type issues with the AWS SDK
        httpsAgent
      }
    });
  }

  /**
   * Transcribes audio from a WAV file using AWS SageMaker
   * @param wavFilePath Path to the WAV file
   * @returns Promise with the transcription result
   */
  public async transcribeAudio(wavFilePath: string): Promise<string> {
    try {
      console.log(`Transcribing audio from ${wavFilePath}`);
      
      // Read the WAV file
      const audioData = fs.readFileSync(wavFilePath);
      
      // Set up the request parameters
      const params = {
        EndpointName: ENDPOINT_NAME,
        Body: audioData,
        ContentType: 'audio/wav',
        Accept: 'application/json',
      };
      
      // Create the command
      const command = new InvokeEndpointCommand(params);
      
      // Log request start time
      const startTime = Date.now();
      console.log(`Request started at: ${new Date(startTime).toISOString()}`);
      
      // Send the request
      const response = await this.client.send(command);
      
      // Log request end time
      const endTime = Date.now();
      console.log(`Request ended at: ${new Date(endTime).toISOString()}`);
      console.log(`Duration: ${endTime - startTime} ms`);
      
      // Process the response
      if (!response.Body) {
        throw new Error('No response body received from SageMaker');
      }
      
      // AWS SDK v3 response body handling
      // Using a type assertion to work around SDK type issues
      const bodyContents = await (response.Body as any).getReader().read();
      const responseBuffer = bodyContents.value;
      const responseBody = Buffer.from(responseBuffer).toString('utf-8');
      
      const jsonResponse = JSON.parse(responseBody);
      
      console.log('Transcription response:', jsonResponse);
      
      // Extract the transcription text from the response
      // The structure may vary based on the actual response format
      return jsonResponse.text || jsonResponse.transcription || '';
    } catch (error) {
      console.error('Error transcribing audio:', error);
      throw error;
    }
  }
}

/**
 * Client for communicating with the server API
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    // If no base URL is provided, use the current origin
    this.baseUrl = baseUrl || window.location.origin;
  }

  /**
   * Sends audio data to the server for transcription
   * @param audioBlob The audio data as a Blob
   * @returns Promise with the transcription result
   */
  public async sendAudioForTranscription(audioBlob: Blob): Promise<string> {
    try {
      // Create form data to send the audio file
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      // Send the request to the server
      const response = await fetch(`${this.baseUrl}/api/transcribe`, {
        method: 'POST',
        body: formData,
      });

      // Check if the request was successful
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      // Parse the response
      const data = await response.json();
      return data.transcription;
    } catch (error) {
      console.error('Error sending audio for transcription:', error);
      throw error;
    }
  }
}


# Audio Transcriber

A web application that records audio from the user's microphone and transcribes it using either AWS SageMaker's Whisper Large V3 Turbo model or the OpenAI Whisper API.

## Features

- Simple UI with Start/Stop recording buttons
- Records audio from the user's microphone
- Processes audio in 10-second chunks
- Optimizes audio format for Whisper model (16kHz, mono, PCM)
- Flexible transcription service options:
  - AWS SageMaker endpoint for production use
  - OpenAI Whisper API for local development
- Displays cumulative transcription results

## Prerequisites

- Node.js (v14 or higher)
- TypeScript
- For AWS SageMaker: AWS credentials configured locally
- For OpenAI: An OpenAI API key
- Google Chrome browser (recommended for best microphone support)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/audio-transcriber.git
   cd audio-transcriber
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment configuration:
   ```bash
   cp .env.example .env
   ```
   Then edit the `.env` file to add your API keys and configure the transcription service.

4. Build the application:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Open your browser and navigate to `http://localhost:3000`

## Environment Configuration

The application uses environment variables for configuration. Create a `.env` file in the root directory with the following options:

```
# AWS Configuration (for AWS SageMaker)
AWS_REGION=us-east-1
AWS_PROFILE=default

# OpenAI Configuration (for OpenAI Whisper API)
OPENAI_API_KEY=your_openai_api_key_here

# Service Configuration
# Options: "aws", "openai"
TRANSCRIPTION_SERVICE=openai
```

## Transcription Service Options

The application supports two transcription services:

### 1. OpenAI Whisper API

Ideal for local development and testing. To use this service:
- Set `TRANSCRIPTION_SERVICE=openai` in your `.env` file
- Add your OpenAI API key as `OPENAI_API_KEY=your_key_here`

### 2. AWS SageMaker Endpoint

Ideal for production use within your company's network. To use this service:
- Set `TRANSCRIPTION_SERVICE=aws` in your `.env` file
- Ensure AWS credentials are configured locally
- Make sure you have access to the SageMaker endpoint (`dlsg-ds-asr-real-time-djl-2-endpoint`)

## Usage

1. Click "Start Listening" to begin recording audio
2. When prompted, allow microphone access in your browser
3. Speak into your microphone
4. The application will send 10-second chunks of audio for transcription
5. Transcription results will appear in the transcription area
6. Click "Stop Listening" to end the recording session

## Technical Details

- **Client-side**: Vanilla TypeScript, Web Audio API
- **Server-side**: Node.js HTTP server with ES modules
- **Audio Processing**: Custom WAV file generation optimized for Whisper
- **Architecture**: Service factory pattern for flexible transcription service selection

## Troubleshooting

### Microphone Access Issues

- Make sure you're accessing the application via `localhost` or HTTPS
- Check browser permissions: click the lock/info icon in the address bar
- Try a different browser if issues persist

### Transcription Service Issues

- For OpenAI: Verify your API key is correct and has sufficient credits
- For AWS: Check AWS credentials and network connectivity to AWS services

## Development

For development with automatic rebuilding:

```bash
npm run dev
```

This will automatically:
1. Kill any existing server processes
2. Watch for TypeScript changes and recompile
3. Restart the server when changes are detected

## License

ISC

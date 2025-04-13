import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as url from 'url';
import { fileURLToPath } from 'url';

// Get the current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { TranscriptionServiceFactory } from './transcriptionServiceFactory.js';
import {
  ensureDirectoryExists,
  parseMultipartFormData,
  extractBoundary,
  sendJsonResponse,
  sendErrorResponse,
  serveStaticFile
} from './utils.js';

// Configuration
const PORT = 3000;
const HOST = 'localhost';
const STATIC_DIR = path.join(__dirname, '..', 'client');
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');
const WAV_FILE_PATH = path.join(TEMP_DIR, 'out.wav');

// Ensure temp directory exists
ensureDirectoryExists(TEMP_DIR);

// Create transcription service based on configuration
const transcriptionService = TranscriptionServiceFactory.createService();

// MIME types for static files
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Parse the URL
  const parsedUrl = url.parse(req.url || '/', true);
  const pathname = parsedUrl.pathname || '/';

  try {
    // Handle API requests
    if (pathname === '/api/transcribe' && req.method === 'POST') {
      await handleTranscribeRequest(req, res);
      return;
    }

    // Handle static file requests
    await handleStaticFileRequest(req, res, pathname);
  } catch (error) {
    console.error('Server error:', error);
    sendErrorResponse(res, 500, 'Internal server error');
  }
});

/**
 * Handles requests to transcribe audio
 */
async function handleTranscribeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    // Check content type
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Extract boundary
      const boundary = extractBoundary(contentType);
      if (!boundary) {
        sendErrorResponse(res, 400, 'Invalid multipart/form-data request: missing boundary');
        return;
      }
      
      // Parse form data
      const formData = await parseMultipartFormData(req, boundary);
      
      // Get audio file data
      const audioData = formData.get('audio');
      if (!audioData) {
        sendErrorResponse(res, 400, 'No audio file found in request');
        return;
      }
      
      // Save audio data to file
      fs.writeFileSync(WAV_FILE_PATH, audioData);
    } else {
      // Assume raw audio data
      const chunks: Buffer[] = [];
      
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      
      const buffer = Buffer.concat(chunks);
      fs.writeFileSync(WAV_FILE_PATH, buffer);
    }
    
    // Transcribe the audio using the configured service
    const transcription = await transcriptionService.transcribeAudio(WAV_FILE_PATH);
    
    // Send the transcription back to the client
    sendJsonResponse(res, 200, { transcription });
  } catch (error) {
    console.error('Error handling transcribe request:', error);
    sendErrorResponse(res, 500, `Error transcribing audio: ${(error as Error).message}`);
  }
}

/**
 * Handles requests for static files
 */
async function handleStaticFileRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
  // Default to index.html for root path
  let filePath = pathname === '/' 
    ? path.join(STATIC_DIR, 'index.html') 
    : path.join(STATIC_DIR, pathname);
  
  // Debug logging
  console.log('Requested path:', pathname);
  console.log('Looking for file at:', filePath);
  console.log('STATIC_DIR is:', STATIC_DIR);
  console.log('__dirname is:', __dirname);
  console.log('File exists:', fs.existsSync(filePath));
  
  // Get file extension
  const extname = path.extname(filePath).toLowerCase();
  
  // Get content type based on file extension
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  console.log('Content type:', contentType);
  
  // Check if file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    console.log('Serving file:', filePath);
    serveStaticFile(res, filePath, contentType);
  } else {
    // Try adding .html extension for clean URLs
    if (!extname && fs.existsSync(`${filePath}.html`)) {
      console.log('Serving file with .html extension:', `${filePath}.html`);
      serveStaticFile(res, `${filePath}.html`, 'text/html');
    } else {
      console.log('File not found:', filePath);
      sendErrorResponse(res, 404, 'File not found');
    }
  }
}

// Start the server
server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}/`);
});

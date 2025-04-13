import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

// Get the current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures that a directory exists, creating it if necessary
 * @param dirPath Path to the directory
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Saves a file from a request to the specified path
 * @param req HTTP request object
 * @param savePath Path to save the file
 * @returns Promise that resolves when the file is saved
 */
export function saveRequestBodyToFile(req: http.IncomingMessage, savePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(savePath, buffer);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Parses multipart form data from a request
 * @param req HTTP request object
 * @param boundary Boundary string from the content-type header
 * @returns Promise that resolves with a map of field names to values
 */
export function parseMultipartFormData(req: http.IncomingMessage, boundary: string): Promise<Map<string, Buffer>> {
  return new Promise((resolve, reject) => {
    const formData = new Map<string, Buffer>();
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
        
        let position = 0;
        while (position < buffer.length) {
          // Find the next boundary
          const boundaryPosition = buffer.indexOf(boundaryBuffer, position);
          if (boundaryPosition === -1) break;
          
          // Move past the boundary
          position = boundaryPosition + boundaryBuffer.length;
          
          // Check if this is the end boundary
          if (buffer.indexOf(endBoundaryBuffer, position - boundaryBuffer.length) === position - boundaryBuffer.length) {
            break;
          }
          
          // Skip the CRLF after the boundary
          position += 2;
          
          // Parse the headers
          let headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), position);
          if (headerEnd === -1) break;
          
          const headerString = buffer.slice(position, headerEnd).toString();
          const headers = new Map<string, string>();
          
          headerString.split('\r\n').forEach(line => {
            const colonIndex = line.indexOf(':');
            if (colonIndex !== -1) {
              const name = line.slice(0, colonIndex).trim().toLowerCase();
              const value = line.slice(colonIndex + 1).trim();
              headers.set(name, value);
            }
          });
          
          // Get the content-disposition header
          const contentDisposition = headers.get('content-disposition');
          if (!contentDisposition) {
            position = headerEnd + 4;
            continue;
          }
          
          // Extract the field name
          const nameMatch = /name="([^"]+)"/.exec(contentDisposition);
          if (!nameMatch) {
            position = headerEnd + 4;
            continue;
          }
          
          const fieldName = nameMatch[1];
          
          // Move past the headers
          position = headerEnd + 4;
          
          // Find the end of this part (next boundary)
          const nextBoundaryPosition = buffer.indexOf(boundaryBuffer, position);
          if (nextBoundaryPosition === -1) break;
          
          // Extract the field value (excluding the CRLF before the boundary)
          const fieldValue = buffer.slice(position, nextBoundaryPosition - 2);
          formData.set(fieldName, fieldValue);
          
          // Move to the next part
          position = nextBoundaryPosition;
        }
        
        resolve(formData);
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Extracts the boundary string from a content-type header
 * @param contentType Content-type header value
 * @returns Boundary string or null if not found
 */
export function extractBoundary(contentType: string): string | null {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/.exec(contentType);
  return boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
}

/**
 * Generates a random temporary file path
 * @param directory Directory to create the file in
 * @param extension File extension
 * @returns Path to the temporary file
 */
export function generateTempFilePath(directory: string, extension: string): string {
  const randomName = crypto.randomBytes(16).toString('hex');
  return path.join(directory, `${randomName}.${extension}`);
}

/**
 * Sends a JSON response
 * @param res HTTP response object
 * @param statusCode HTTP status code
 * @param data Data to send as JSON
 */
export function sendJsonResponse(res: http.ServerResponse, statusCode: number, data: any): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Sends an error response
 * @param res HTTP response object
 * @param statusCode HTTP status code
 * @param message Error message
 */
export function sendErrorResponse(res: http.ServerResponse, statusCode: number, message: string): void {
  sendJsonResponse(res, statusCode, { error: message });
}

/**
 * Serves a static file
 * @param res HTTP response object
 * @param filePath Path to the file
 * @param contentType Content-type of the file
 */
export function serveStaticFile(res: http.ServerResponse, filePath: string, contentType: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendErrorResponse(res, 404, 'File not found');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

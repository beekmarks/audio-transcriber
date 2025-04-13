import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define source and destination directories
const srcDir = path.join(__dirname, 'src', 'client');
const destDir = path.join(__dirname, 'dist', 'client');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy HTML and CSS files
const filesToCopy = fs.readdirSync(srcDir).filter(file => 
  file.endsWith('.html') || file.endsWith('.css')
);

filesToCopy.forEach(file => {
  const srcPath = path.join(srcDir, file);
  const destPath = path.join(destDir, file);
  fs.copyFileSync(srcPath, destPath);
  console.log(`Copied ${file} to ${destDir}`);
});

console.log('Static files copied successfully!');

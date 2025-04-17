import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export default async function handler(req, res) {
  // Set CORS headers to ensure we can access from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const term = req.query.term || 'courseIdentifier';
  
  // Prepare debugging information
  const debugInfo = {
    serverInfo: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    requestInfo: {
      url: req.url,
      method: req.method,
      headers: req.headers,
      query: req.query
    },
    fileSystem: {
      directoryStructure: {},
      fileChecks: {
        turtleFiles: {},
        htmlFiles: {}
      }
    }
  };
  
  // List key directories
  const directoriesToCheck = [
    '.',
    './dist',
    './dist/terms',
    './public',
    './pages',
    './pages/api'
  ];
  
  // Check each directory
  for (const dir of directoriesToCheck) {
    try {
      const dirPath = path.join(process.cwd(), dir);
      const exists = fs.existsSync(dirPath);
      
      if (exists) {
        const files = await fsPromises.readdir(dirPath);
        debugInfo.fileSystem.directoryStructure[dir] = files;
      } else {
        debugInfo.fileSystem.directoryStructure[dir] = 'Directory does not exist';
      }
    } catch (error) {
      debugInfo.fileSystem.directoryStructure[dir] = `Error: ${error.message}`;
    }
  }
  
  // Check specific files
  const filesToCheck = [
    path.join(process.cwd(), 'dist', `${term}.ttl`),
    path.join(process.cwd(), 'dist', 'terms', `${term}.ttl`),
    path.join(process.cwd(), 'public', `${term}.ttl`),
    path.join(process.cwd(), 'public', 'terms', `${term}.ttl`),
    path.join(process.cwd(), 'vercel.json')
  ];
  
  // Check each file
  for (const file of filesToCheck) {
    try {
      const exists = fs.existsSync(file);
      let contents = null;
      
      if (exists) {
        if (file.endsWith('.json')) {
          // For JSON files, parse and include content
          contents = JSON.parse(fs.readFileSync(file, 'utf8'));
        } else if (file.endsWith('.ttl')) {
          // For TTL files, show first few lines
          const fileContent = fs.readFileSync(file, 'utf8');
          contents = fileContent.substring(0, 500) + (fileContent.length > 500 ? '...' : '');
        }
      }
      
      debugInfo.fileSystem.fileChecks[file] = {
        exists,
        contents
      };
    } catch (error) {
      debugInfo.fileSystem.fileChecks[file] = {
        exists: false,
        error: error.message
      };
    }
  }
  
  // Return all the debug information
  return res.status(200).json(debugInfo);
}
import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export default async function handler(req, res) {
  // Get query params
  const { term = 'courseIdentifier' } = req.query;
  
  const debugInfo = {
    params: req.query,
    term,
    headers: req.headers,
    url: req.url,
    method: req.method,
    paths: {
      workingDir: process.cwd(),
      directoryContents: {},
      turtlePaths: [
        path.join(process.cwd(), 'dist', 'terms', `${term}.ttl`),
        path.join(process.cwd(), 'dist', `${term}.ttl`),
      ]
    },
    exists: {
      turtleFiles: {
        inTermsDir: false,
        inRootDir: false
      },
      htmlFile: false
    }
  };
  
  // Check if relevant files exist
  try {
    await fsPromises.access(path.join(process.cwd(), 'dist', 'terms', `${term}.ttl`));
    debugInfo.exists.turtleFiles.inTermsDir = true;
  } catch (e) {
    debugInfo.errors = debugInfo.errors || {};
    debugInfo.errors.inTermsDir = e.message;
  }
  
  try {
    await fsPromises.access(path.join(process.cwd(), 'dist', `${term}.ttl`));
    debugInfo.exists.turtleFiles.inRootDir = true;
  } catch (e) {
    debugInfo.errors = debugInfo.errors || {};
    debugInfo.errors.inRootDir = e.message;
  }
  
  try {
    await fsPromises.access(path.join(process.cwd(), 'dist', term, 'index.html'));
    debugInfo.exists.htmlFile = true;
  } catch (e) {
    debugInfo.errors = debugInfo.errors || {};
    debugInfo.errors.htmlFile = e.message;
  }
  
  // List contents of directories to see what's actually there
  try {
    const distContents = await fsPromises.readdir(path.join(process.cwd(), 'dist'));
    debugInfo.paths.directoryContents.dist = distContents;
    
    if (distContents.includes('terms')) {
      const termsContents = await fsPromises.readdir(path.join(process.cwd(), 'dist', 'terms'));
      debugInfo.paths.directoryContents.terms = termsContents;
    }
  } catch (e) {
    debugInfo.errors = debugInfo.errors || {};
    debugInfo.errors.listDir = e.message;
  }
  
  // Set CORS headers to ensure we can access this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  return res.status(200).json(debugInfo);
}
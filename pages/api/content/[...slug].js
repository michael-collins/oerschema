import fs from 'fs';
import path from 'path';
import { promises as fsPromises } from 'fs';

export default async function handler(req, res) {
  // Get the slug and query params from the URL
  const { slug, format, debug } = req.query;
  
  // Extract the term name and remove any file extension
  let termName = Array.isArray(slug) ? slug[0] : slug;
  
  // Remove .ttl extension if present
  if (termName && termName.endsWith('.ttl')) {
    termName = termName.slice(0, -4);
  }
  
  // Debug mode for troubleshooting
  if (debug === 'true') {
    const debugInfo = {
      slug,
      termName,
      format,
      accept: req.headers.accept,
      url: req.url,
      method: req.method,
      headers: req.headers,
      paths: {
        workingDir: process.cwd(),
        turtlePaths: [
          path.join(process.cwd(), 'dist', 'terms', `${termName}.ttl`),
          path.join(process.cwd(), 'dist', `${termName}.ttl`),
        ],
        htmlPath: path.join(process.cwd(), 'dist', termName, 'index.html'),
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
      await fsPromises.access(path.join(process.cwd(), 'dist', 'terms', `${termName}.ttl`));
      debugInfo.exists.turtleFiles.inTermsDir = true;
    } catch (e) {
      // File doesn't exist
    }
    
    try {
      await fsPromises.access(path.join(process.cwd(), 'dist', `${termName}.ttl`));
      debugInfo.exists.turtleFiles.inRootDir = true;
    } catch (e) {
      // File doesn't exist
    }
    
    try {
      await fsPromises.access(path.join(process.cwd(), 'dist', termName, 'index.html'));
      debugInfo.exists.htmlFile = true;
    } catch (e) {
      // File doesn't exist
    }
    
    return res.status(200).json(debugInfo);
  }
  
  // Check if the Accept header includes text/turtle
  const acceptHeader = req.headers.accept || '';
  const wantsTurtle = acceptHeader.includes('text/turtle');
  
  // Determine if we should serve Turtle format
  const useTurtleFormat = wantsTurtle || format === 'ttl' || (req.url && req.url.endsWith('.ttl'));
  
  if (useTurtleFormat) {
    // Try multiple possible paths for the Turtle file
    const potentialTurtlePaths = [
      path.join(process.cwd(), 'dist', 'terms', `${termName}.ttl`),
      path.join(process.cwd(), 'dist', `${termName}.ttl`)
    ];
    
    // Try each path in sequence
    for (const turtlePath of potentialTurtlePaths) {
      try {
        // Check if this file exists
        await fsPromises.access(turtlePath);
        
        // If we got here, the file exists - read it
        const turtleContent = await fsPromises.readFile(turtlePath, 'utf8');
        
        // Set appropriate headers and return content
        res.setHeader('Content-Type', 'text/turtle');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).send(turtleContent);
      } catch (error) {
        // This path didn't work, try the next one
        continue;
      }
    }
    
    // If we get here, none of the paths worked
    return res.status(404).json({ 
      error: `Turtle representation not found for term: ${termName}`, 
      details: {
        termName,
        pathsTried: potentialTurtlePaths
      }
    });
  } else {
    // For HTML requests, we'll let Next.js handle the regular route
    // or we can redirect to the static HTML file
    const htmlPath = path.join(process.cwd(), 'dist', termName, 'index.html');
    
    try {
      // Check if the file exists
      await fsPromises.access(htmlPath);
      
      // Read the file
      const htmlContent = await fsPromises.readFile(htmlPath, 'utf8');
      
      // Set appropriate headers and return content
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(htmlContent);
    } catch (error) {
      // If we can't find the specific term HTML, redirect to the main page
      return res.redirect(302, '/');
    }
  }
}
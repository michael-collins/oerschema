import { promises as fs } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Parser as N3Parser, Writer as N3Writer } from 'n3';
import jsonld from 'jsonld';
import yaml from 'yamljs';

// Get directory path
const __dirname = dirname(fileURLToPath(import.meta.url));

// Function to transform YAML schema to JSON-LD
function transformYamlToJSONLD(schemaYAML) {
  const jsonLD = {
    "@context": {
      "schema": "http://schema.org/",
      "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
      "ex": "http://example.org/"
    },
    "@graph": []
  };

  const classes = schemaYAML.classes || {};

  for (const [className, classData] of Object.entries(classes)) {
    // Skip if classData is undefined or null
    if (!classData) continue;

    const classJSONLD = {
      "@id": `ex:${className}`,
      "@type": "rdfs:Class",
      "rdfs:label": classData.label || className,
      "rdfs:comment": classData.comment || "",
      "rdfs:subClassOf": classData.subClassOf || [],
      "schema:property": classData.properties || []
    };

    // Remove empty arrays or unnecessary fields
    if (classJSONLD["rdfs:comment"] === "") {
      delete classJSONLD["rdfs:comment"];
    }

    if (classJSONLD["rdfs:subClassOf"].length === 0) {
      delete classJSONLD["rdfs:subClassOf"];
    }

    if (classJSONLD["schema:property"].length === 0) {
      delete classJSONLD["schema:property"];
    }

    jsonLD["@graph"].push(classJSONLD);
  }

  return jsonLD;
}

// Function to generate individual Turtle files for each term
async function generateIndividualTurtleFiles(schemaYAML) {
  console.log('Generating individual Turtle files for classes and properties...');
  
  // Create directories if they don't exist
  const termsDir = './dist/terms';
  await fs.mkdir(termsDir, { recursive: true });
  
  const baseUrl = 'https://oerschema.org/';
  const prefixes = { 
    oer: baseUrl,
    schema: 'http://schema.org/',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    owl: 'http://www.w3.org/2002/07/owl#', 
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    dcterms: 'http://purl.org/dc/terms/'
  };

  // Process classes
  const classes = schemaYAML.classes || {};
  for (const [className, classData] of Object.entries(classes)) {
    if (!classData) continue;
    
    // Create JSON-LD for this specific class
    const classJsonLD = {
      "@context": prefixes,
      "@id": `oer:${className}`,
      "@type": "rdfs:Class",
      "rdfs:label": classData.label || className,
      "rdfs:comment": classData.comment || "",
    };
    
    if (classData.subClassOf && classData.subClassOf.length > 0) {
      classJsonLD["rdfs:subClassOf"] = classData.subClassOf.map(c => `oer:${c}`);
    }
    
    // Convert to Turtle
    const nquads = await jsonld.toRDF(classJsonLD, { format: 'application/n-quads' });
    const parser = new N3Parser();
    const quads = parser.parse(nquads);
    
    const writer = new N3Writer({ prefixes });
    writer.addQuads(quads);
    
    const turtle = await new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    // Write to file
    await fs.writeFile(`${termsDir}/${className}.ttl`, turtle);
    console.log(`Generated Turtle file for class: ${className}`);
  }
  
  // Process properties
  const properties = schemaYAML.properties || {};
  for (const [propName, propData] of Object.entries(properties)) {
    if (!propData) continue;
    
    // Create JSON-LD for this specific property
    const propJsonLD = {
      "@context": prefixes,
      "@id": `oer:${propName}`,
      "@type": "rdf:Property",
      "rdfs:label": propData.label || propName,
      "rdfs:comment": propData.comment || ""
    };
    
    if (propData.domain) {
      propJsonLD["rdfs:domain"] = `oer:${propData.domain}`;
    }
    
    if (propData.range) {
      propJsonLD["rdfs:range"] = `oer:${propData.range}`;
    }
    
    // Convert to Turtle
    const nquads = await jsonld.toRDF(propJsonLD, { format: 'application/n-quads' });
    const parser = new N3Parser();
    const quads = parser.parse(nquads);
    
    const writer = new N3Writer({ prefixes });
    writer.addQuads(quads);
    
    const turtle = await new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    // Write to file
    await fs.writeFile(`${termsDir}/${propName}.ttl`, turtle);
    console.log(`Generated Turtle file for property: ${propName}`);
  }
  
  console.log('Individual Turtle files generation completed.');
}

async function generateTurtle() {
  try {
    console.log('Starting Turtle file generation...');

    // Load schema.yml
    const schemaPath = './src/config/schema.yml';
    console.log(`Loading schema from: ${schemaPath}`);
    const schemaYAML = yaml.load(schemaPath);
    console.log('Schema YAML loaded successfully.');

    // Transform YAML to JSON-LD
    console.log('Transforming YAML schema to JSON-LD...');
    const schemaJSONLD = transformYamlToJSONLD(schemaYAML);
    console.log('Transformation to JSON-LD completed.');

    // Ensure dist directory exists
    const outputDir = './dist';
    console.log(`Ensuring output directory exists: ${outputDir}`);
    await fs.mkdir(outputDir, { recursive: true });

    // Convert JSON-LD to N-Quads
    console.log('Converting JSON-LD to N-Quads...');
    const nquads = await jsonld.toRDF(schemaJSONLD, { format: 'application/n-quads' });
    console.log('Conversion to N-Quads completed.');

    if (!nquads) {
      throw new Error('jsonld.toRDF returned no N-Quads.');
    }

    // Parse N-Quads into quads
    console.log('Parsing N-Quads...');
    const parser = new N3Parser();
    const quadsParsed = parser.parse(nquads);
    console.log('Parsed quads:', quadsParsed);

    // Initialize N3Writer for Turtle
    console.log('Initializing N3Writer for Turtle...');
    const writer = new N3Writer({ prefixes: { ex: 'http://example.org/', schema: 'http://schema.org/', rdfs: 'http://www.w3.org/2000/01/rdf-schema#' } });

    // Add quads to writer
    console.log('Adding quads to writer...');
    writer.addQuads(quadsParsed);
    console.log('Quads added to writer.');

    // Serialize to Turtle
    console.log('Serializing to Turtle...');
    const turtle = await new Promise((resolve, reject) => {
      writer.end((error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
    console.log('Turtle serialization completed.');

    if (!turtle) {
      throw new Error('Turtle serialization resulted in empty output.');
    }

    // Write Turtle to file
    const outputPath = './dist/schema.ttl';
    console.log(`Writing Turtle to file: ${outputPath}`);
    await fs.writeFile(outputPath, turtle);
    console.log(`Turtle file generated successfully at ${outputPath}`);
    
    // Generate individual Turtle files
    await generateIndividualTurtleFiles(schemaYAML);
  } catch (error) {
    console.error('Error generating Turtle file:', error);
    process.exit(1);
  }
}

// Execute the generation
generateTurtle();
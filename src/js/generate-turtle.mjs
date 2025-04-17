import { promises as fs } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { Parser as N3Parser, Writer as N3Writer, Store as N3Store } from 'n3';
import rdfSerializer from 'rdf-serialize';
import jsonld from 'jsonld';
import yaml from 'yamljs';
import { Readable } from 'stream';

// Get directory path
const __dirname = dirname(fileURLToPath(import.meta.url));

// Function to transform YAML schema to JSON-LD
function transformYamlToJSONLD(schemaYAML) {
  const jsonLD = {
    "@context": {
      "oer": "http://oerschema.org/",
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
      "@id": `oer:${className}`,
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

  // Process properties as well
  const properties = schemaYAML.properties || {};
  
  for (const [propName, propData] of Object.entries(properties)) {
    if (!propData) continue;
    
    const propJSONLD = {
      "@id": `oer:${propName}`,
      "@type": "rdf:Property",
      "rdfs:label": propData.label || propName,
      "rdfs:comment": propData.comment || "",
      "rdfs:domain": propData.domain || [],
      "rdfs:range": propData.range || []
    };
    
    // Remove empty fields
    if (propJSONLD["rdfs:comment"] === "") {
      delete propJSONLD["rdfs:comment"];
    }
    
    if (propJSONLD["rdfs:domain"].length === 0) {
      delete propJSONLD["rdfs:domain"];
    }
    
    if (propJSONLD["rdfs:range"].length === 0) {
      delete propJSONLD["rdfs:range"];
    }
    
    jsonLD["@graph"].push(propJSONLD);
  }

  return jsonLD;
}

// Helper function to convert quads to a specific format
async function serializeQuadsToFormat(quads, format) {
  const store = new N3Store(quads);
  const stream = new Readable({
    objectMode: true,
    read: () => {
      quads.forEach(quad => stream.push(quad));
      stream.push(null);
    }
  });
  
  const textStream = rdfSerializer.serialize(stream, { contentType: format });
  
  let content = '';
  for await (const chunk of textStream) {
    content += chunk;
  }
  
  return content;
}

async function generateFiles() {
  try {
    console.log('Starting schema file generation...');

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

    // Also create terms directory
    const termsDir = './dist/terms';
    console.log(`Ensuring terms directory exists: ${termsDir}`);
    await fs.mkdir(termsDir, { recursive: true });

    // Write JSON-LD to file
    const jsonLdPath = './dist/schema.jsonld';
    console.log(`Writing JSON-LD to file: ${jsonLdPath}`);
    await fs.writeFile(jsonLdPath, JSON.stringify(schemaJSONLD, null, 2));
    console.log(`JSON-LD file generated successfully at ${jsonLdPath}`);

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
    console.log(`Parsed ${quadsParsed.length} quads.`);

    // Initialize N3Writer for Turtle
    console.log('Initializing N3Writer for Turtle...');
    const writer = new N3Writer({ 
      prefixes: { 
        oer: 'http://oerschema.org/',
        schema: 'http://schema.org/', 
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
      } 
    });

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

    // Generate RDF/XML and N-Triples for the full schema
    try {
      console.log('Generating RDF/XML...');
      const rdfXml = await serializeQuadsToFormat(quadsParsed, 'application/rdf+xml');
      await fs.writeFile('./dist/schema.rdf', rdfXml);
      console.log('RDF/XML file generated successfully.');

      console.log('Generating N-Triples...');
      const nTriples = await serializeQuadsToFormat(quadsParsed, 'application/n-triples');
      await fs.writeFile('./dist/schema.nt', nTriples);
      console.log('N-Triples file generated successfully.');
    } catch (error) {
      console.error('Error generating additional RDF formats:', error);
      console.log('Continuing with the rest of the process...');
      // Continue with the rest of the process even if these formats fail
    }

    // Generate individual files for classes and properties
    console.log('Generating individual files for classes and properties...');
    
    // Generate individual JSON-LD files for each class
    for (const [className, classData] of Object.entries(schemaYAML.classes || {})) {
      if (!classData) continue;
      
      const classJsonLd = {
        "@context": {
          "oer": "http://oerschema.org/",
          "schema": "http://schema.org/",
          "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
          "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        },
        "@id": `oer:${className}`,
        "@type": "rdfs:Class",
        "rdfs:label": classData.label || className,
        "rdfs:comment": classData.comment || "",
        "rdfs:subClassOf": classData.subClassOf || [],
        "schema:property": classData.properties || []
      };
      
      // Write individual JSON-LD file
      await fs.writeFile(`${termsDir}/${className}.jsonld`, JSON.stringify(classJsonLd, null, 2));
      
      // Generate individual RDF files
      const classQuads = await jsonld.toRDF(classJsonLd, { format: 'application/n-quads' });
      if (classQuads) {
        const classParser = new N3Parser();
        const parsedClassQuads = classParser.parse(classQuads);
        const classWriter = new N3Writer({ 
          prefixes: { 
            oer: 'http://oerschema.org/',
            schema: 'http://schema.org/', 
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
          }
        });
        classWriter.addQuads(parsedClassQuads);
        
        const classTurtle = await new Promise((resolve, reject) => {
          classWriter.end((error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
        
        // Write Turtle file
        await fs.writeFile(`${termsDir}/${className}.ttl`, classTurtle);
        
        // Generate RDF/XML and N-Triples
        try {
          // Write RDF/XML file
          const classRdfXml = await serializeQuadsToFormat(parsedClassQuads, 'application/rdf+xml');
          await fs.writeFile(`${termsDir}/${className}.rdf`, classRdfXml);
          
          // Write N-Triples file
          const classNTriples = await serializeQuadsToFormat(parsedClassQuads, 'application/n-triples');
          await fs.writeFile(`${termsDir}/${className}.nt`, classNTriples);
        } catch (error) {
          console.error(`Error generating additional formats for class ${className}:`, error);
          // Continue with the next class
        }
      }
    }
    
    // Generate individual JSON-LD files for each property
    for (const [propName, propData] of Object.entries(schemaYAML.properties || {})) {
      if (!propData) continue;
      
      const propJsonLd = {
        "@context": {
          "oer": "http://oerschema.org/",
          "schema": "http://schema.org/",
          "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
          "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
        },
        "@id": `oer:${propName}`,
        "@type": "rdf:Property",
        "rdfs:label": propData.label || propName,
        "rdfs:comment": propData.comment || "",
        "rdfs:domain": propData.domain || [],
        "rdfs:range": propData.range || []
      };
      
      // Write individual JSON-LD file
      await fs.writeFile(`${termsDir}/${propName}.jsonld`, JSON.stringify(propJsonLd, null, 2));
      
      // Generate individual RDF files
      const propQuads = await jsonld.toRDF(propJsonLd, { format: 'application/n-quads' });
      if (propQuads) {
        const propParser = new N3Parser();
        const parsedPropQuads = propParser.parse(propQuads);
        const propWriter = new N3Writer({ 
          prefixes: { 
            oer: 'http://oerschema.org/',
            schema: 'http://schema.org/', 
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
          }
        });
        propWriter.addQuads(parsedPropQuads);
        
        const propTurtle = await new Promise((resolve, reject) => {
          propWriter.end((error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
        
        // Write Turtle file
        await fs.writeFile(`${termsDir}/${propName}.ttl`, propTurtle);
        
        // Generate RDF/XML and N-Triples
        try {
          // Write RDF/XML file
          const propRdfXml = await serializeQuadsToFormat(parsedPropQuads, 'application/rdf+xml');
          await fs.writeFile(`${termsDir}/${propName}.rdf`, propRdfXml);
          
          // Write N-Triples file
          const propNTriples = await serializeQuadsToFormat(parsedPropQuads, 'application/n-triples');
          await fs.writeFile(`${termsDir}/${propName}.nt`, propNTriples);
        } catch (error) {
          console.error(`Error generating additional formats for property ${propName}:`, error);
          // Continue with the next property
        }
      }
    }
    
    console.log('All individual files generated successfully.');
    
  } catch (error) {
    console.error('Error generating files:', error);
    process.exit(1);
  }
}

// Execute the generation
generateFiles();
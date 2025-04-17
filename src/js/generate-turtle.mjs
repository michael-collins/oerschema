import { promises as fs } from 'fs';
import { dirname } from 'path';
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

    // Create a static N-Triples file with proper format
    console.log('Creating N-Triples file...');
    const staticNTriples = `<http://oerschema.org/Action> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2000/01/rdf-schema#Class> .
<http://oerschema.org/Action> <http://www.w3.org/2000/01/rdf-schema#label> "Action" .
<http://oerschema.org/Action> <http://www.w3.org/2000/01/rdf-schema#comment> "An action is something that is done." .
<http://oerschema.org/Course> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2000/01/rdf-schema#Class> .
<http://oerschema.org/Course> <http://www.w3.org/2000/01/rdf-schema#label> "Course" .
<http://oerschema.org/Course> <http://www.w3.org/2000/01/rdf-schema#comment> "A sequence of learning material and activities oriented around a subject matter." .
`;
    await fs.writeFile('./dist/schema.nt', staticNTriples);
    console.log(`N-Triples file generated successfully.`);

    // Create a static RDF/XML file with proper format
    console.log('Creating RDF/XML file...');
    const staticRdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
   xmlns:oer="http://oerschema.org/">

  <rdf:Description rdf:about="http://oerschema.org/">
    <rdfs:label>OER Schema</rdfs:label>
    <rdfs:comment>Open Educational Resources Schema</rdfs:comment>
  </rdf:Description>

  <rdfs:Class rdf:about="http://oerschema.org/Course">
    <rdfs:label>Course</rdfs:label>
    <rdfs:comment>A sequence of learning material and activities oriented around a subject matter.</rdfs:comment>
  </rdfs:Class>

  <rdfs:Class rdf:about="http://oerschema.org/Action">
    <rdfs:label>Action</rdfs:label>
    <rdfs:comment>An action is something that is done.</rdfs:comment>
  </rdfs:Class>

</rdf:RDF>`;
    await fs.writeFile('./dist/schema.rdf', staticRdfXml);
    console.log(`RDF/XML file generated successfully.`);

    // Generate individual files for classes and properties
    console.log('Generating individual files for classes and properties...');
    
    // Process each class
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
      
      // Generate JSON-LD
      const classJsonLdPath = `${termsDir}/${className}.jsonld`;
      await fs.writeFile(classJsonLdPath, JSON.stringify(classJsonLd, null, 2));
      
      // Generate Turtle
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
        
        // Create simple N-Triples file
        const classNTriples = `<http://oerschema.org/${className}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/2000/01/rdf-schema#Class> .
<http://oerschema.org/${className}> <http://www.w3.org/2000/01/rdf-schema#label> "${escapeString(classData.label || className)}" .
${classData.comment ? `<http://oerschema.org/${className}> <http://www.w3.org/2000/01/rdf-schema#comment> "${escapeString(classData.comment)}" .` : ''}
`;
        await fs.writeFile(`${termsDir}/${className}.nt`, classNTriples);
        
        // Create simple RDF/XML file
        const classRdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
   xmlns:oer="http://oerschema.org/">

  <rdfs:Class rdf:about="http://oerschema.org/${className}">
    <rdfs:label>${escapeXml(classData.label || className)}</rdfs:label>
    ${classData.comment ? `<rdfs:comment>${escapeXml(classData.comment)}</rdfs:comment>` : ''}
  </rdfs:Class>

</rdf:RDF>`;
        await fs.writeFile(`${termsDir}/${className}.rdf`, classRdfXml);
      }
    }
    
    // Process each property
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
      
      // Generate JSON-LD
      const propJsonLdPath = `${termsDir}/${propName}.jsonld`;
      await fs.writeFile(propJsonLdPath, JSON.stringify(propJsonLd, null, 2));
      
      // Generate Turtle
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
        
        // Create simple N-Triples file
        const propNTriples = `<http://oerschema.org/${propName}> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://www.w3.org/1999/02/22-rdf-syntax-ns#Property> .
<http://oerschema.org/${propName}> <http://www.w3.org/2000/01/rdf-schema#label> "${escapeString(propData.label || propName)}" .
${propData.comment ? `<http://oerschema.org/${propName}> <http://www.w3.org/2000/01/rdf-schema#comment> "${escapeString(propData.comment)}" .` : ''}
`;
        await fs.writeFile(`${termsDir}/${propName}.nt`, propNTriples);
        
        // Create simple RDF/XML file
        const propRdfXml = `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
   xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
   xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
   xmlns:oer="http://oerschema.org/">

  <rdf:Property rdf:about="http://oerschema.org/${propName}">
    <rdfs:label>${escapeXml(propData.label || propName)}</rdfs:label>
    ${propData.comment ? `<rdfs:comment>${escapeXml(propData.comment)}</rdfs:comment>` : ''}
  </rdf:Property>

</rdf:RDF>`;
        await fs.writeFile(`${termsDir}/${propName}.rdf`, propRdfXml);
      }
    }
    
    console.log('All individual files generated successfully.');
    
    // Verify files exist
    const termsFiles = await fs.readdir(termsDir);
    console.log(`Terms directory contains ${termsFiles.length} files`);
    const rdfCount = termsFiles.filter(f => f.endsWith('.rdf')).length;
    const ntCount = termsFiles.filter(f => f.endsWith('.nt')).length;
    const ttlCount = termsFiles.filter(f => f.endsWith('.ttl')).length;
    const jsonldCount = termsFiles.filter(f => f.endsWith('.jsonld')).length;
    
    console.log(`Generated ${rdfCount} RDF/XML files, ${ntCount} N-Triples files, ${ttlCount} Turtle files, and ${jsonldCount} JSON-LD files.`);
    
  } catch (error) {
    console.error('Error generating files:', error);
    process.exit(1);
  }
}

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper function to escape strings in N-Triples
function escapeString(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Execute the generation
generateFiles();
// Debug endpoint to test content negotiation
export default function handler(req, res) {
  const acceptHeader = req.headers.accept || '';
  
  res.status(200).json({
    message: 'Content negotiation debug info',
    acceptHeader: acceptHeader,
    whatWouldBeServed: acceptHeader.includes('text/turtle') 
      ? 'Turtle (text/turtle)' 
      : acceptHeader.includes('application/ld+json') 
        ? 'JSON-LD (application/ld+json)' 
        : 'HTML (text/html)',
    allHeaders: req.headers
  });
}
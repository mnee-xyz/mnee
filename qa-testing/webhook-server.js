import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Main webhook endpoint
app.post('/webhook', (req, res) => {
  console.log('\n========================================');
  console.log('WEBHOOK RECEIVED at', new Date().toISOString());
  console.log('========================================');
  
  // Log request method and URL
  console.log('\n📍 REQUEST INFO:');
  console.log('  Method:', req.method);
  console.log('  URL:', req.url);
  console.log('  Query:', req.query);
  
  // Log all headers
  console.log('\n📋 HEADERS:');
  Object.entries(req.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Log body
  console.log('\n📦 BODY (parsed):');
  console.log(JSON.stringify(req.body, null, 2));
  
  console.log('\n========================================\n');
  
  // Send success response
  res.status(200).json({ 
    status: 'success', 
    message: 'Webhook received',
    timestamp: new Date().toISOString()
  });
});

// Catch-all endpoint for any other requests
app.all('*', (req, res) => {
  console.log('\n🔔 Request to:', req.method, req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  res.status(200).json({ 
    status: 'ok',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Webhook test server running on port ${PORT}`);
  console.log(`📡 Local URL: http://localhost:${PORT}/webhook`);
  console.log('\nTo expose with ngrok:');
  console.log(`  ngrok http ${PORT}`);
  console.log('\nThen use the ngrok URL + /webhook as your callback URL');
  console.log('Example: https://abc123.ngrok.io/webhook\n');
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down webhook server...');
  process.exit(0);
});
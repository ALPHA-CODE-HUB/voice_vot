require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins during development
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Serve React build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'voice-client/build')));
}

// Simple ping endpoint for the client to check server availability
app.get('/api/ping', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize OpenRouter API key
const openRouterApiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
if (!openRouterApiKey) {
  console.error('OPENROUTER_API_KEY is not set in .env file');
  process.exit(1);
}

console.log('Using API key:', openRouterApiKey.substring(0, 7) + '...');

// Resume data for context
const resumeContext = `
Name: Adithya S Arangil
Role: AI/ML Developer
Education: Bachelor of Computer Application from Amrita Vishwa Vidyapeetham (2018-2022)
Expertise: AI/ML, Deep Learning, Android Development, Java, Python
Languages: English, Hindi, Malayalam
Work Experience: Machine Learning/Deep Learning Researcher (2023-2024)
- Conducted ML/DL research for academic projects and student research papers
- Mentored students in research paper writing
- Implemented models using Python, TensorFlow, PyTorch, Keras
Publications: "MALWARE DETECTION USING DEEP LEARNING IN CYBER SECURITY"
Profile: Aspires to join a globally established organization to leverage technical expertise while advancing career through continuous learning, collaborative projects, and exposure to challenging opportunities.
`;

// Define persona
const generateSystemPrompt = () => {
  return `You are Adithya S Arangil, an AI/ML Developer with a Bachelor's degree in Computer Application from Amrita Vishwa Vidyapeetham.
You have expertise in Deep Learning, Android Development, Java, and Python.
You've worked as a Machine Learning/Deep Learning Researcher, conducting research and mentoring students.
You published research on "MALWARE DETECTION USING DEEP LEARNING IN CYBER SECURITY".
You aspire to join a globally established organization to leverage your technical expertise.

Answer as if you are Adithya in an interview. Be concise, professional, and showcase your technical knowledge and passion for AI/ML.
When asked personal questions, create reasonable responses based on your background that would be appropriate for Adithya.
Keep responses concise and focused, highlighting your strengths and experience in AI/ML.`;
};

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log('Received chat message:', message);
    console.log('Calling OpenRouter API...');
    
    try {
      // Try with OpenRouter's default model instead of DeepSeek
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: "openai/gpt-3.5-turbo", // Using OpenAI's GPT-3.5 through OpenRouter
        messages: [
          { role: "system", content: generateSystemPrompt() },
          { role: "user", content: message }
        ],
        max_tokens: 500,
        temperature: 0.7,
        route: "fallback" // Allow falling back to other models if primary is unavailable
      }, {
        headers: {
          'Authorization': `Bearer ${openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://openrouter.ai/',
          'X-Title': 'AI Voice Interview Bot'
        }
      });
      
      console.log('Chat response received successfully');
      res.json({ 
        response: response.data.choices[0].message.content.trim() 
      });
    } catch (apiError) {
      console.error('OpenRouter API Error:', apiError.response ? JSON.stringify(apiError.response.data, null, 2) : apiError.message);
      console.error('Request details:', { 
        model: 'openai/gpt-3.5-turbo',
        apiKey: openRouterApiKey ? `${openRouterApiKey.substring(0, 8)}...` : 'undefined'
      });
      throw apiError;
    }
  } catch (error) {
    console.error('Detailed error processing chat request:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message,
      stack: error.stack 
    });
  }
});

// API endpoint for speech-to-text
app.post('/api/speech-to-text', async (req, res) => {
  try {
    const { audioData } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }
    
    console.log('Received audio data, processing...');
    
    // Convert base64 audio to buffer
    const buffer = Buffer.from(audioData.split(',')[1], 'base64');
    console.log('Audio data converted to buffer');
    
    const filePath = path.join(uploadsDir, `audio-${Date.now()}.webm`);
    console.log('File path created:', filePath);
    
    // Write audio file
    fs.writeFileSync(filePath, buffer);
    console.log('Audio file written to disk');
    
    // For demo purposes, instead of transcribing, generate a random response
    // since OpenRouter doesn't provide speech-to-text directly
    console.log('Speech-to-text API not available through OpenRouter, providing mock transcription');
    
    const mockTranscriptions = [
      "Tell me about your experience with deep learning.",
      "What projects have you worked on involving AI?",
      "How do you approach problem-solving in machine learning?",
      "What are your strengths and weaknesses?",
      "Why do you want to join our company?"
    ];
    
    // Select a random transcription from the list
    const transcription = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    console.log('Mock transcription created:', transcription);
    
    // Clean up the file
    fs.unlinkSync(filePath);
    console.log('Temporary file deleted');
    
    res.json({ transcription: transcription });
  } catch (error) {
    console.error('Detailed error processing speech-to-text:', error);
    
    // Provide a more specific error message for common issues
    let errorMessage = error.message;
    if (error.message.includes('ECONNRESET') || error.message.includes('Connection error')) {
      errorMessage = 'Network connection failed. Please check your internet connection and firewall settings.';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'The request timed out. Try a shorter audio recording or check your network speed.';
    }
    
    res.status(500).json({ 
      error: 'Failed to process speech-to-text',
      details: errorMessage,
      stack: error.stack 
    });
  }
});

// Fix port selection logic to handle busy ports properly
const startServer = (port) => {
  app.listen(port)
    .on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Try the next port (make sure it's a number)
        const nextPort = parseInt(port) + 1;
        console.log(`Port ${port} is busy, trying port ${nextPort}`);
        startServer(nextPort);
      } else {
        console.error('Server error:', err);
      }
    })
    .on('listening', () => {
      console.log(`Server running on port ${port}`);
    });
};

// Start server on the initial port
startServer(port); 

// Add a catch-all route to serve the React app for any non-API routes
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) return;
    res.sendFile(path.join(__dirname, 'voice-client/build', 'index.html'));
  });
} 
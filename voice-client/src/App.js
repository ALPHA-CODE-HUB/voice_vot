import React, { useState, useRef, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Container,
  Flex,
  Avatar,
  Stack,
  IconButton,
  useToast,
  keyframes,
  Tooltip,
  useColorModeValue,
  Badge,
  theme,
  extendTheme,
} from '@chakra-ui/react';
import { FaMicrophone, FaStop, FaAssistiveListeningSystems } from 'react-icons/fa';
import axios from 'axios';
import './App.css';

// API configuration
const API_BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost';
const BASE_PORT = process.env.NODE_ENV === 'production' ? '' : '8000';
const API_URL = process.env.NODE_ENV === 'production' ? '/api' : `${API_BASE_URL}:${BASE_PORT}`;

// Custom theme with animations and modern colors
const customTheme = extendTheme({
  colors: {
    brand: {
      50: '#e0f7ff',
      100: '#b8e7ff',
      200: '#8ad6ff',
      300: '#5cc5ff',
      400: '#2eb4ff',
      500: '#0099ff',
      600: '#0077cc',
      700: '#005799',
      800: '#003766',
      900: '#001833',
    },
    accent: {
      50: '#f0e5ff',
      100: '#d1b7ff',
      200: '#b28aff',
      300: '#935cff',
      400: '#742eff',
      500: '#5500ff',
      600: '#4400cc',
      700: '#330099',
      800: '#220066',
      900: '#110033',
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'xl',
        _hover: {
          transform: 'translateY(-2px)',
          boxShadow: 'md',
        },
        transition: 'all 0.2s ease-in-out',
      },
    },
    IconButton: {
      baseStyle: {
        borderRadius: 'full',
        _hover: {
          transform: 'scale(1.05)',
        },
        transition: 'all 0.2s ease-in-out',
      },
    },
  },
});

// Define keyframes for animations with better alignment
const pulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 0.7; }
  50% { transform: scale(1.05); opacity: 0.9; }
  100% { transform: scale(1); opacity: 0.7; }
`;

const fadeIn = keyframes`
  0% { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const waveAnimation = keyframes`
  0% { transform: translateY(0px); }
  25% { transform: translateY(-2px); }
  50% { transform: translateY(0px); }
  75% { transform: translateY(2px); }
  100% { transform: translateY(0px); }
`;

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [serverUrl] = useState(API_URL);
  const [recordingTime, setRecordingTime] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const toast = useToast();
  
  // Animation styles
  const pulse = `${pulseAnimation} 2s infinite ease-in-out`;
  const wave = `${waveAnimation} 2s infinite ease-in-out`;
  const fade = `${fadeIn} 0.5s ease-in-out`;
  
  // Dynamic colors
  const cardBgColor = useColorModeValue('white', 'gray.800');
  const cardBorderColor = useColorModeValue('gray.200', 'gray.700');
  const headerBgGradient = 'linear(to-r, brand.500, accent.500)';
  const accentColor = useColorModeValue('brand.500', 'brand.300');
  
  // Maximum recording time in seconds
  const MAX_RECORDING_TIME = 30;

  // Add ResponsiveVoice script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://code.responsivevoice.org/responsivevoice.js?key=zvyWGVWU";
    script.async = true;
    document.body.appendChild(script);
    
    // Voice indicator element
    const voiceIndicator = document.createElement('div');
    voiceIndicator.style.display = 'none';
    document.body.appendChild(voiceIndicator);
    
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
      if (document.body.contains(voiceIndicator)) {
        document.body.removeChild(voiceIndicator);
      }
      // Make sure to cancel any speech when component unmounts
      if (window.responsiveVoice && window.responsiveVoice.isPlaying()) {
        window.responsiveVoice.cancel();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Initialize speech recognition and speech synthesis voices
  useEffect(() => {
    // Initialize speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';
      
      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map(result => result[0])
          .map(result => result.transcript)
          .join('');
          
        setTranscript(transcript);
      };
      
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        toast({
          title: "Speech Recognition Error",
          description: `Error: ${event.error}`,
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      };
    } else {
      toast({
        title: "Browser Not Supported",
        description: "Your browser doesn't support speech recognition. Please use Chrome or Edge.",
        status: "warning",
        duration: 5000,
        isClosable: true,
      });
    }
    
    // Initialize speech synthesis with Microsoft Ravi voice
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        setSelectedVoice(voices[0].name);
      }
    };

    // Chrome loads voices asynchronously
    if (speechSynthesis) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    // Load voices immediately for browsers that have them available right away
    loadVoices();
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [toast]);

  // Start recording audio
  const startRecording = async () => {
    try {
      // Clear previous transcript
      setTranscript('');
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
      
      // Also record audio for backup/verification
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Start recording timer
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prevTime => {
          const newTime = prevTime + 1;
          // Auto-stop if reached max recording time
          if (newTime >= MAX_RECORDING_TIME) {
            stopRecording();
            toast({
              title: "Recording limit reached",
              description: `Recording automatically stopped after ${MAX_RECORDING_TIME} seconds.`,
              status: "info",
              duration: 3000,
              isClosable: true,
            });
          }
          return newTime;
        });
      }, 1000);

      mediaRecorderRef.current.start();
      setIsRecording(true);
      toast({
        title: "Recording started",
        description: `Maximum recording time: ${MAX_RECORDING_TIME} seconds`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: "Error",
        description: `Error accessing microphone: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      
      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      // Clear the recording timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      toast({
        title: "Processing...",
        description: `Recording length: ${recordingTime} seconds`,
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      
      // Process the transcript directly
      if (transcript) {
        processTranscription(transcript);
      } else {
        toast({
          title: "No speech detected",
          description: "Try speaking louder or check your microphone settings.",
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
        setIsProcessing(false);
      }
    }
  };

  // Process the transcription
  const processTranscription = async (text) => {
    try {
      await sendMessageToBot(text);
    } catch (error) {
      console.error('Error processing transcription:', error);
      setIsProcessing(false);
      toast({
        title: "Error",
        description: `Error processing transcription: ${error.message}`,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Send message to the backend
  const sendMessageToBot = async (message) => {
    try {
      console.log(`Sending message to ${serverUrl}/api/chat`);
      const response = await axios.post(`${serverUrl}/api/chat`, {
        message,
      }, {
        timeout: 60000, // Increase to 60 second timeout
      });

      const botResponse = response.data.response;
      setResponse(botResponse);
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: message },
        { role: 'bot', content: botResponse }
      ]);
      speakResponse(botResponse);
    } catch (error) {
      console.error('Error sending message to bot:', error);
      console.error('Error details:', error.response ? error.response.data : 'No response data');
      
      let errorMessage = 'Failed to communicate with the bot';
      if (error.response && error.response.data.details) {
        errorMessage = error.response.data.details;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Enhanced text-to-speech function with ResponsiveVoice
  const speakResponse = (text) => {
    try {
      console.log('Starting speech synthesis');
      setIsListening(false);
      
      // Try ResponsiveVoice first
      if (window.responsiveVoice && window.responsiveVoice.voiceSupport()) {
        // Cancel any ongoing speech
        if (window.responsiveVoice.isPlaying()) {
          window.responsiveVoice.cancel();
        }
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        
        // Add visual wave effect
        const visualizeVoice = () => {
          // Animation is handled by React state (isListening)
          setIsListening(true);
        };
        
        const stopVisualizing = () => {
          setIsListening(false);
        };
        
        // Check for preferred voice types
        let voiceName = "Hindi Male"; // Default to Hindi Male for Adithya
        
        // Match the selected voice type if possible
        if (selectedVoice) {
          if (selectedVoice.toLowerCase().includes('ravi') || selectedVoice.toLowerCase().includes('indian')) {
            voiceName = "Hindi Male";
          } else if (selectedVoice.toLowerCase().includes('female')) {
            voiceName = "Hindi Female";
          } else if (selectedVoice.toLowerCase().includes('uk') || selectedVoice.toLowerCase().includes('british')) {
            voiceName = "UK English Male";
          } else if (selectedVoice.toLowerCase().includes('us')) {
            voiceName = "US English Male";
          }
        }
        
        // Split text into sentences for better delivery
        const sentences = text.split(/(?<=[.!?])\s+/);
        let currentIndex = 0;
        
        const speakNextSentence = () => {
          if (currentIndex < sentences.length) {
            const sentence = sentences[currentIndex];
            currentIndex++;
            
            if (sentence.trim().length > 0) {
              // Parameters for ResponsiveVoice
              const params = {
                pitch: 1.0,
                rate: 0.9,
                onstart: visualizeVoice,
                onend: () => {
                  stopVisualizing();
                  // Wait a short time before next sentence for natural pauses
                  setTimeout(() => {
                    speakNextSentence();
                  }, 300);
                },
                onerror: (error) => {
                  console.error('ResponsiveVoice error:', error);
                  stopVisualizing();
                  toast({
                    title: "Speech Error",
                    description: `Error with speech synthesis`,
                    status: "error",
                    duration: 3000,
                    isClosable: true,
                  });
                }
              };
              
              // Speak the sentence
              window.responsiveVoice.speak(sentence, voiceName, params);
              console.log(`Speaking with ResponsiveVoice: ${voiceName}`);
            } else {
              // Skip empty sentences
              speakNextSentence();
            }
          }
        };
        
        // Start speaking the first sentence
        speakNextSentence();
        return;
      }
      
      // Fallback to Web Speech API if ResponsiveVoice is not available
      if (window.speechSynthesis) {
        // Cancel any ongoing speech
        window.speechSynthesis.cancel();
        
        if (!window.speechSynthesis) {
          throw new Error("Speech synthesis not supported in this browser");
        }
        
        // Create a new utterance
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Set event handlers
        utterance.onstart = () => {
          console.log('Speech started');
          setIsListening(true);
        };
        
        utterance.onend = () => {
          console.log('Speech ended');
          setIsListening(false);
        };
        
        utterance.onerror = (event) => {
          console.error(`Speech error: ${event.error}`);
          setIsListening(false);
          toast({
            title: "Speech Error",
            description: `Error: ${event.error}`,
            status: "error",
            duration: 3000,
            isClosable: true,
          });
        };
        
        // Choose voice
        const voices = window.speechSynthesis.getVoices();
        let voice = null;
        
        if (selectedVoice) {
          voice = voices.find(v => v.name === selectedVoice);
        }
        
        // Apply voice settings
        if (voice) {
          utterance.voice = voice;
          console.log(`Using voice: ${voice.name}`);
        } else {
          console.warn("No voice available for speech, using default");
        }
        
        // Apply Indian voice settings
        utterance.rate = 0.9;  // Slightly slower
        utterance.pitch = 1.0; // Normal pitch
        
        console.log(`Speaking with voice: ${utterance.voice?.name || 'default'}, rate: ${utterance.rate}, pitch: ${utterance.pitch}`);
        
        // Split text into sentences for better delivery
        const sentences = text.split(/(?<=[.!?])\s+/);
        
        if (sentences.length > 1) {
          console.log(`Speaking ${sentences.length} sentences`);
          
          // Speak the first sentence
          utterance.text = sentences[0];
          utterance.onend = () => {
            // After the first sentence, handle the rest recursively
            if (sentences.length > 1) {
              const remainingText = sentences.slice(1).join(' ');
              if (remainingText.trim().length > 0) {
                setTimeout(() => {
                  speakResponse(remainingText);
                }, 100); // Small pause between sentences
              } else {
                setIsListening(false);
              }
            } else {
              setIsListening(false);
            }
          };
        } else {
          utterance.text = text;
        }
        
        // Speak the text
        window.speechSynthesis.speak(utterance);
        console.log('Speech synthesis request sent');
      } else {
        throw new Error("No speech synthesis system available");
      }
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsListening(false);
      toast({
        title: "Speech Error",
        description: `Unable to use text-to-speech: ${error.message}`,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  // Stop speech playback
  const stopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsListening(false);
    }
  };

  return (
    <ChakraProvider theme={customTheme}>
      <Box 
        minHeight="100vh" 
        bg="gray.50" 
        backgroundImage="linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 50%, #f3f4f6 50%, #f3f4f6 75%, transparent 75%, transparent)"
        backgroundSize="20px 20px"
        py={8}
      >
        <Container maxW="container.md">
          <VStack spacing={6} align="stretch">
            {/* Header with animated gradient */}
            <Box 
              textAlign="center" 
              p={6} 
              borderRadius="xl" 
              bgGradient={headerBgGradient}
              color="white"
              boxShadow="lg"
              animation={fade}
            >
              <Heading as="h1" size="xl" mb={2} textShadow="1px 1px 3px rgba(0,0,0,0.3)">
                Adithya S Arangil
              </Heading>
              <Text fontSize="lg" fontWeight="medium">AI/ML Developer</Text>
            </Box>

            {/* Profile card with animations */}
            <Flex 
              direction={{ base: 'column', md: 'row' }}
              align="center"
              justify="space-between"
              bg={cardBgColor}
              p={6}
              borderRadius="xl"
              boxShadow="lg"
              borderWidth="1px"
              borderColor={cardBorderColor}
              transition="all 0.3s ease"
              _hover={{ boxShadow: "xl", transform: "translateY(-2px)" }}
              animation={fade}
            >
              <Avatar 
                size="2xl" 
                name="Adithya S Arangil" 
                mb={{ base: 4, md: 0 }}
                bg="brand.500"
                src="/photo-picaai (1).png"
                borderWidth="4px"
                borderColor="white"
                boxShadow="lg"
              />
              <Box flex="1" ml={{ base: 0, md: 6 }}>
                <Text fontSize="md" mb={4} fontWeight="medium" lineHeight="taller">
                  I aspire to join a globally established organization where I can leverage my 
                  technical expertise and skills to make meaningful contributions while advancing 
                  my career through continuous learning, collaborative projects, and exposure to 
                  challenging opportunities.
                </Text>
                <Stack direction={{ base: 'column', md: 'row' }} spacing={4}>
                  <Button 
                    colorScheme="brand" 
                    variant="solid" 
                    size="sm" 
                    boxShadow="sm"
                    _hover={{ boxShadow: "md" }}
                  >
                    AI/ML Developer
                  </Button>
                  <Button 
                    colorScheme="accent" 
                    variant="solid" 
                    size="sm"
                    boxShadow="sm"
                    _hover={{ boxShadow: "md" }}
                  >
                    Deep Learning
                  </Button>
                  <Button 
                    colorScheme="blue" 
                    variant="solid" 
                    size="sm"
                    boxShadow="sm"
                    _hover={{ boxShadow: "md" }}
                  >
                    Python
                  </Button>
                </Stack>
              </Box>
            </Flex>
            
            {/* Bot interaction card with dynamic styling */}
            <Box
              bg={cardBgColor}
              p={6}
              borderRadius="xl"
              boxShadow="lg"
              borderWidth="1px"
              borderColor={cardBorderColor}
              transition="all 0.3s ease"
              _hover={{ boxShadow: "xl" }}
              animation={fade}
            >
              <Heading 
                as="h2" 
                size="md" 
                mb={6} 
                color={accentColor}
                display="flex"
                alignItems="center"
              >
                Adhi Bot
                <Badge 
                  ml={2} 
                  colorScheme="brand" 
                  fontSize="0.7em" 
                  animation={isListening ? wave : undefined}
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  transform="translateY(0)"
                >
                  {isListening ? "Speaking" : isRecording ? "Listening" : "Ready"}
                </Badge>
              </Heading>
              
              <Text mb={4} fontWeight="medium">
                Ask me questions about my experience, skills, or anything else you'd like to know.
                {isRecording && (
                  <Text 
                    color="red.500" 
                    fontWeight="bold" 
                    mt={2}
                    animation={pulse}
                  >
                    Recording: {recordingTime}s / {MAX_RECORDING_TIME}s
                  </Text>
                )}
              </Text>
              
              <VStack spacing={4} align="stretch">
                <Flex 
                  justifyContent="center" 
                  py={6}
                  position="relative"
                >
                  <Box position="relative" width="100%" height="100%" display="flex" justifyContent="center" alignItems="center">
                    <Box position="relative" display="inline-block" mr={4}>
                      {/* Recording animation background */}
                      {isRecording && (
                        <Box
                          position="absolute"
                          left="50%"
                          top="50%"
                          transform="translate(-50%, -50%)"
                          width="70px"
                          height="70px"
                          borderRadius="full"
                          bg="red.100"
                          opacity="0.6"
                          animation={pulse}
                          zIndex={0}
                        />
                      )}
                      
                      <Tooltip label={isRecording ? "Stop recording" : "Start recording"}>
                        <IconButton
                          icon={isRecording ? <FaStop /> : <FaMicrophone />}
                          colorScheme={isRecording ? "red" : "brand"}
                          size="lg"
                          isRound
                          onClick={isRecording ? stopRecording : startRecording}
                          isLoading={isProcessing}
                          aria-label={isRecording ? "Stop recording" : "Start recording"}
                          boxShadow="lg"
                          _hover={{ transform: "scale(1.1)" }}
                          _active={{ transform: "scale(0.95)" }}
                          animation={isRecording ? pulse : undefined}
                          transition="all 0.3s ease"
                          position="relative"
                          zIndex={1}
                        />
                      </Tooltip>
                    </Box>
                    
                    <Box position="relative" display="inline-block">
                      {/* Listening animation background */}
                      {isListening && (
                        <Box
                          position="absolute"
                          left="50%"
                          top="50%"
                          transform="translate(-50%, -50%)"
                          width="70px"
                          height="70px"
                          borderRadius="full"
                          bg="green.100"
                          opacity="0.6"
                          animation={pulse}
                          zIndex={0}
                        />
                      )}
                      
                      <Tooltip label={isListening ? "Stop speech" : "Not speaking"}>
                        <IconButton
                          icon={<FaAssistiveListeningSystems />}
                          colorScheme={isListening ? "green" : "gray"}
                          size="lg"
                          isRound
                          onClick={stopSpeech}
                          isDisabled={!isListening}
                          aria-label="Stop listening"
                          boxShadow="lg"
                          _hover={{ transform: "scale(1.1)" }}
                          _active={{ transform: "scale(0.95)" }}
                          animation={isListening ? wave : undefined}
                          transition="all 0.3s ease"
                          position="relative"
                          zIndex={1}
                        />
                      </Tooltip>
                    </Box>
                  </Box>
                </Flex>
                
                {transcript && (
                  <Box 
                    p={4} 
                    bg="gray.50" 
                    borderRadius="xl"
                    boxShadow="md"
                    borderWidth="1px"
                    borderColor={cardBorderColor}
                    animation={fade}
                  >
                    <Text fontWeight="bold" color={accentColor}>You asked:</Text>
                    <Text>{transcript}</Text>
                  </Box>
                )}
                
                {response && (
                  <Box 
                    p={4} 
                    bg="blue.50" 
                    borderRadius="xl"
                    boxShadow="md"
                    borderWidth="1px"
                    borderColor="blue.100"
                    animation={fade}
                  >
                    <Text fontWeight="bold" color="blue.600">Adithya's response:</Text>
                    <Text>{response}</Text>
                  </Box>
                )}
              </VStack>
            </Box>

            {conversationHistory.length > 0 && (
              <Box
                bg={cardBgColor}
                p={6}
                borderRadius="xl"
                boxShadow="lg"
                borderWidth="1px"
                borderColor={cardBorderColor}
                transition="all 0.3s ease"
                _hover={{ boxShadow: "xl" }}
                animation={fade}
              >
                <Heading as="h2" size="md" mb={4} color={accentColor}>Conversation History</Heading>
                <VStack spacing={4} align="stretch">
                  {conversationHistory.map((message, index) => (
                    <Box
                      key={index}
                      p={4}
                      borderRadius="xl"
                      bg={message.role === 'user' ? 'gray.50' : 'blue.50'}
                      alignSelf={message.role === 'user' ? 'flex-end' : 'flex-start'}
                      maxW="80%"
                      boxShadow="md"
                      borderWidth="1px"
                      borderColor={message.role === 'user' ? 'gray.200' : 'blue.100'}
                      animation={`${fadeIn} ${0.3 + index * 0.1}s ease-in-out`}
                    >
                      <Text fontWeight="bold" color={message.role === 'user' ? accentColor : 'blue.600'}>
                        {message.role === 'user' ? 'You' : 'Adithya'}
                      </Text>
                      <Text>{message.content}</Text>
                    </Box>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </Container>
      </Box>
    </ChakraProvider>
  );
}

export default App;

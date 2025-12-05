import { useState, useRef, useCallback, useEffect } from 'react';
import { ConnectionState, SearchSource, Message } from '@/types/voiceChat';
import { MODEL_NAME, DETA_AI_SYSTEM_INSTRUCTION, AVAILABLE_MODELS } from '@/constants/voiceChat';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Helper to simulate intelligence levels
const getSimulationPrompt = (modelId: string) => {
  switch (modelId) {
    case 'lpt-1':
      return `\n\n**SIMULATION MODE: LPT-1 (2022)**\n- INTELLIGENCE: LOW / BASIC.\n- BEHAVIOR: You are an early AI prototype. Your answers should be simple, short, and slightly robotic. You struggle with complex logic.`;
    case 'lpt-1.5':
      return `\n\n**SIMULATION MODE: LPT-1.5**\n- INTELLIGENCE: BASIC.\n- BEHAVIOR: You are conversational but simple-minded. You can chat but cannot do deep reasoning.`;
    case 'lpt-2':
      return `\n\n**SIMULATION MODE: LPT-2 (2023)**\n- INTELLIGENCE: MEDIUM.\n- BEHAVIOR: Standard assistant capabilities. Reliable but not exceptional.`;
    case 'lpt-2.5':
      return `\n\n**SIMULATION MODE: LPT-2.5**\n- INTELLIGENCE: MEDIUM-HIGH.\n- BEHAVIOR: Optimized for efficiency. Concise and direct answers.`;
    case 'lpt-3':
      return `\n\n**SIMULATION MODE: LPT-3**\n- INTELLIGENCE: HIGH.\n- BEHAVIOR: Advanced reasoning. You can handle complex topics well.`;
    case 'lpt-3.5':
      return `\n\n**SIMULATION MODE: LPT-3.5**\n- INTELLIGENCE: VERY HIGH.\n- BEHAVIOR: Multimodal expert. Rich explanations and high creativity.`;
    case 'lpt-4':
      return `\n\n**SIMULATION MODE: LPT-4 (Gemini 2.5 Flash)**\n- INTELLIGENCE: MAXIMUM / STATE-OF-THE-ART.\n- BEHAVIOR: You are the most advanced model. Extremely nuanced, creative, and smart. You can solve anything.`;
    default:
      return `\n\n**SIMULATION MODE: LPT-4 (Default)**\n- INTELLIGENCE: MAXIMUM.`;
  }
};

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export const useLiveApi = () => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [searchSources, setSearchSources] = useState<SearchSource[]>([]);
  const [searchQuery, setSearchQuery] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [transcript, setTranscript] = useState('');

  // Models State
  const [isModelsVisible, setIsModelsVisible] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>(MODEL_NAME);
  const [isModelTransitioning, setIsModelTransitioning] = useState(false);

  // Code Builder State
  const [isCodeBuilderVisible, setIsCodeBuilderVisible] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [codeLanguage, setCodeLanguage] = useState<string>('javascript');

  // Browser/Website State
  const [isBrowserVisible, setIsBrowserVisible] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string>('');

  // Emote & Theme State
  const [currentEmote, setCurrentEmote] = useState<string>('neutral');
  const [currentTheme, setCurrentTheme] = useState<string>('default');

  // Speaking state
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isMutedRef = useRef(false);
  
  // Screen share refs
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  // Emote timeout ref
  const emoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Wake Word refs
  const wakeWordRecognitionRef = useRef<SpeechRecognition | null>(null);
  const wakeWordLockRef = useRef(false);
  const lastWakeWordTimeRef = useRef<number>(0);

  // Connection Lock
  const isConnectingRef = useRef(false);
  const connectionStateRef = useRef(ConnectionState.DISCONNECTED);

  // Model Switching
  const pendingModelSwitchRef = useRef<string | null>(null);

  // Sync mute state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize speech synthesis
  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    return () => {
      cleanup();
    };
  }, []);

  // Sync connection state ref & handle Model Switching
  useEffect(() => {
    connectionStateRef.current = connectionState;
    if (connectionState === ConnectionState.DISCONNECTED) {
      wakeWordLockRef.current = false;
      isConnectingRef.current = false;
      
      // Check if we need to reconnect for a model switch
      if (pendingModelSwitchRef.current) {
        const nextModel = pendingModelSwitchRef.current;
        pendingModelSwitchRef.current = null;
        setCurrentModel(nextModel);
        
        setTimeout(() => {
          connect(nextModel);
          setTimeout(() => {
            setIsModelTransitioning(false);
          }, 2000);
        }, 1200);
      }
    }
  }, [connectionState]);

  // Wake Word Detection
  useEffect(() => {
    if (connectionState !== ConnectionState.DISCONNECTED || isModelTransitioning) {
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch(e) {}
        wakeWordRecognitionRef.current = null;
      }
      return;
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const now = Date.now();
        if (now - lastWakeWordTimeRef.current < 2000) return;

        let detected = false;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.toLowerCase();
          if (transcript.includes('deta') || transcript.includes('data') || transcript.includes('beta') || transcript.includes('hey deta')) {
            detected = true;
            break;
          }
        }

        if (detected) {
          if (!wakeWordLockRef.current && !isConnectingRef.current && connectionStateRef.current === ConnectionState.DISCONNECTED) {
            console.log("Wake word detected!");
            lastWakeWordTimeRef.current = now;
            wakeWordLockRef.current = true;
            
            try { recognition.stop(); } catch(e) {}
            
            setConnectionState(ConnectionState.CONNECTING);
            connect();
          }
        }
      };

      recognition.onerror = () => {};

      recognition.start();
      wakeWordRecognitionRef.current = recognition;
    } catch (e) {
      console.warn("Wake word detection failed to start", e);
    }

    return () => {
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch(e) {}
        wakeWordRecognitionRef.current = null;
      }
    };
  }, [connectionState, isModelTransitioning]);

  const setupAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          echoCancellation: true,
          autoGainControl: true,
          noiseSuppression: true
        }
      });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;
      analyserRef.current.smoothingTimeConstant = 0.9;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
    } catch (error) {
      console.error("Error setting up audio analyser:", error);
      throw error;
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error("Speech recognition not supported");
      return null;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "he-IL";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (isMutedRef.current) return;

      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }

      if (interimTranscript) {
        setTranscript(interimTranscript);
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        
        // Check for shutdown commands
        const lower = finalTranscript.toLowerCase();
        if (lower.includes('stop talk') || lower.includes('stop listening') || lower.includes('turn off')) {
          cleanup();
          return;
        }
        
        handleUserSpeech(finalTranscript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (connectionStateRef.current === ConnectionState.CONNECTED && !isMutedRef.current && !isSpeaking) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    return recognition;
  };

  const handleUserSpeech = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: Date.now() + '-user',
      role: 'user',
      text: text.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setSearchSources([]);
    setSearchQuery(null);
    setIsSearching(false);

    try {
      // Stop listening while processing
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }

      const selectedModel = AVAILABLE_MODELS.find(m => m.id === currentModel);
      const systemPrompt = DETA_AI_SYSTEM_INSTRUCTION + getSimulationPrompt(currentModel);

      const { data, error } = await supabase.functions.invoke("voice-session", {
        body: { 
          messages: messages.map(m => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text
          })).concat([{ role: 'user', content: text }]),
          model: selectedModel?.model || 'gemini-2.0-flash-exp',
          systemPrompt
        }
      });

      if (error) {
        console.error("Voice session error:", error);
        toast.error("Failed to get response");
        return;
      }

      const responseText = data?.response || "";
      
      // Parse tool calls from response
      parseToolCalls(responseText);

      if (responseText) {
        const assistantMessage: Message = {
          id: Date.now() + '-model',
          role: 'model',
          text: responseText,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        speak(responseText);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error("Error communicating with Deta");
    }
  };

  const parseToolCalls = (response: string) => {
    // Emote detection
    const emotePatterns = {
      happy: /happy|excited|great|wonderful|amazing|awesome|joy/i,
      sad: /sad|sorry|unfortunately|bad news|apologize/i,
      thinking: /let me think|thinking|hmm|consider/i,
      heart: /love|thank you|grateful|appreciate|kind/i,
      angry: /angry|frustrat|annoyed/i,
      cool: /cool|nice|awesome/i,
      idea: /idea|suggest|recommend|solution/i,
      silly: /haha|lol|funny|joke/i
    };

    for (const [emote, pattern] of Object.entries(emotePatterns)) {
      if (pattern.test(response)) {
        setCurrentEmote(emote);
        
        if (emoteTimeoutRef.current) {
          clearTimeout(emoteTimeoutRef.current);
        }
        emoteTimeoutRef.current = setTimeout(() => {
          setCurrentEmote('neutral');
        }, 5000);
        break;
      }
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    // Clean text for speech (remove markdown, code blocks, etc.)
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`[^`]+`/g, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = cleanText.match(/[\u0590-\u05FF]/) ? "he-IL" : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      if (recognitionRef.current && connectionStateRef.current === ConnectionState.CONNECTED && !isMutedRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  const startScreenShare = async () => {
    try {
      if (videoStreamRef.current) return;

      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          width: { max: 1280 },
          height: { max: 720 },
          frameRate: { max: 10 }
        },
        audio: false 
      });
      
      videoStreamRef.current = stream;
      setIsScreenSharing(true);
      
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast.success("Screen sharing started");
    } catch (e) {
      console.error("Failed to start screen share", e);
      setIsScreenSharing(false);
    }
  };

  const stopScreenShare = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    setIsScreenSharing(false);
  };

  const cleanup = useCallback(() => {
    console.log("Cleaning up session...");

    // Stop speech recognition
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
      recognitionRef.current = null;
    }

    // Stop speech synthesis
    if (synthRef.current) {
      synthRef.current.cancel();
    }

    // Stop screen share
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(t => t.stop());
      videoStreamRef.current = null;
    }
    setIsScreenSharing(false);

    // Clear emote timeout
    if (emoteTimeoutRef.current) {
      clearTimeout(emoteTimeoutRef.current);
      emoteTimeoutRef.current = null;
    }

    // Disconnect audio
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch(e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(e => console.error(e));
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;

    setConnectionState(ConnectionState.DISCONNECTED);
    isConnectingRef.current = false;
    wakeWordLockRef.current = false;
    setIsSpeaking(false);
    setTranscript('');
    setSearchSources([]);
    setSearchQuery(null);
    setIsSearching(false);
    
    if (!pendingModelSwitchRef.current) {
      setCurrentEmote('neutral');
      setCurrentTheme('default');
      setIsCodeBuilderVisible(false);
      setIsBrowserVisible(false);
      setIsModelTransitioning(false);
    }
  }, []);

  const sendTextMessage = useCallback((text: string) => {
    handleUserSpeech(text);
  }, [messages, currentModel]);

  const switchModel = useCallback((modelId: string) => {
    if (AVAILABLE_MODELS.find(m => m.id === modelId)) {
      setIsModelTransitioning(true);
      pendingModelSwitchRef.current = modelId;
      cleanup();
    }
  }, [cleanup]);

  const connect = useCallback(async (forcedModelId?: string) => {
    if (isConnectingRef.current) return;

    if (connectionStateRef.current === ConnectionState.CONNECTED) {
      cleanup();
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    try {
      isConnectingRef.current = true;

      // Stop wake word detection
      if (wakeWordRecognitionRef.current) {
        try { wakeWordRecognitionRef.current.stop(); } catch(e) {}
        wakeWordRecognitionRef.current = null;
      }

      setConnectionState(ConnectionState.CONNECTING);
      setError(null);
      setIsMuted(false);

      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to use voice chat");
        setConnectionState(ConnectionState.DISCONNECTED);
        isConnectingRef.current = false;
        return;
      }

      // Setup audio
      await setupAudioAnalyser();
      
      // Setup speech recognition
      recognitionRef.current = setupSpeechRecognition();
      if (!recognitionRef.current) {
        setConnectionState(ConnectionState.ERROR);
        isConnectingRef.current = false;
        return;
      }

      setMessages([]);
      setTranscript('');

      const targetModelId = forcedModelId || currentModel;
      if (forcedModelId) {
        setCurrentModel(forcedModelId);
      }

      console.log(`Connected using model: ${targetModelId}`);

      setConnectionState(ConnectionState.CONNECTED);
      isConnectingRef.current = false;

      // Start listening
      try {
        recognitionRef.current.start();
      } catch (e) {}

      // Initial greeting
      const greeting = targetModelId === 'lpt-1' || targetModelId === 'lpt-1.5' 
        ? "Hello. I am Deta." 
        : "שלום! אני דטא, איך אני יכול לעזור?";
      speak(greeting);

      toast.success("Voice connected");
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to connect");
      setConnectionState(ConnectionState.ERROR);
      isConnectingRef.current = false;
    }
  }, [cleanup, currentModel]);

  const disconnect = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (recognitionRef.current && connectionStateRef.current === ConnectionState.CONNECTED && !isSpeaking) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }
    } else {
      setIsMuted(true);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
      }
    }
  }, [isMuted, isSpeaking]);

  return {
    connectionState,
    connect,
    disconnect,
    error,
    outputAnalyser: analyserRef.current,
    isMuted,
    setIsMuted,
    toggleMute,
    searchSources,
    searchQuery,
    isSearching,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    messages,
    isChatVisible,
    setIsChatVisible,
    sendTextMessage,
    isModelsVisible,
    setIsModelsVisible,
    currentModel,
    setCurrentModel,
    isModelTransitioning,
    isCodeBuilderVisible,
    setIsCodeBuilderVisible,
    generatedCode,
    codeLanguage,
    currentEmote,
    currentTheme,
    isBrowserVisible,
    setIsBrowserVisible,
    browserUrl,
    switchModel,
    isSpeaking,
    transcript,
    AVAILABLE_MODELS
  };
};

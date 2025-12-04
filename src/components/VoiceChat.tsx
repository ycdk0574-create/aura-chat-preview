import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import AudioVisualizer from "./AudioVisualizer";

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

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

export const VoiceChat = ({ isOpen, onClose }: VoiceChatProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    synthRef.current = window.speechSynthesis;
    
    return () => {
      disconnect();
    };
  }, []);

  const setupAudioAnalyser = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
      sourceRef.current.connect(analyserRef.current);
    } catch (error) {
      console.error("Error setting up audio analyser:", error);
    }
  };

  const setupSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "he-IL"; // Hebrew, will auto-detect other languages

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (interimTranscript) {
        setTranscript(interimTranscript);
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        handleUserSpeech(finalTranscript);
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech") {
        toast.error("Speech recognition error: " + event.error);
      }
    };

    recognition.onend = () => {
      if (isConnected && !isMuted && !isSpeaking) {
        recognition.start();
      }
    };

    return recognition;
  };

  const handleUserSpeech = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsListening(false);

    try {
      const { data, error } = await supabase.functions.invoke("voice-session", {
        body: { messages: newMessages }
      });

      if (error) {
        console.error("Voice session error:", error);
        toast.error("Failed to get response");
        return;
      }

      const responseText = data?.response || "";
      if (responseText) {
        const assistantMessage: Message = { role: "assistant", content: responseText };
        setMessages(prev => [...prev, assistantMessage]);
        speak(responseText);
      }
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error("Error communicating with Deta");
    }
  };

  const speak = (text: string) => {
    if (!synthRef.current) return;

    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = text.match(/[\u0590-\u05FF]/) ? "he-IL" : "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsListening(true);
      if (recognitionRef.current && isConnected && !isMuted) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  const connect = async () => {
    setIsConnecting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to use voice chat");
        setIsConnecting(false);
        return;
      }

      await setupAudioAnalyser();
      recognitionRef.current = setupSpeechRecognition();
      
      if (!recognitionRef.current) {
        setIsConnecting(false);
        return;
      }

      setIsConnected(true);
      setIsConnecting(false);
      setIsListening(true);
      
      recognitionRef.current.start();
      
      // Initial greeting
      speak("שלום! אני דטא, איך אני יכול לעזור?");
      
      toast.success("Voice connected");
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect voice");
      setIsConnecting(false);
    }
  };

  const disconnect = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    
    setIsConnected(false);
    setIsSpeaking(false);
    setIsListening(false);
    setTranscript("");
    setMessages([]);
  }, []);

  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (recognitionRef.current && isConnected && !isSpeaking) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }
    } else {
      setIsMuted(true);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  const handleClose = () => {
    disconnect();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md p-8 rounded-2xl bg-card/90 border border-border/50 shadow-2xl"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>

          <div className="text-center space-y-6">
            <h2 className="text-2xl font-bold">Deta Voice</h2>
            <p className="text-sm text-muted-foreground">
              Talk with Deta AI using your voice
            </p>

            {/* Audio Visualizer */}
            <div className="relative mx-auto w-full">
              <AudioVisualizer 
                analyser={analyserRef.current} 
                isActive={isConnected && (isListening || isSpeaking)}
                color={isSpeaking ? "#a855f7" : "#38bdf8"}
              />
            </div>

            {/* Orb Animation */}
            <div className="relative mx-auto w-24 h-24">
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.2, 1] : isListening ? [1, 1.05, 1] : 1,
                  opacity: isConnected ? 1 : 0.5,
                }}
                transition={{
                  duration: isSpeaking ? 0.3 : 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-primary/70 to-secondary"
                style={{
                  boxShadow: isConnected 
                    ? "0 0 60px rgba(168, 85, 247, 0.5)" 
                    : "none"
                }}
              />
              <div className="absolute inset-2 rounded-full bg-card flex items-center justify-center">
                {isSpeaking ? (
                  <Volume2 className="h-8 w-8 text-primary animate-pulse" />
                ) : (
                  <Mic className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Status */}
            <div className="text-sm">
              {isConnecting && (
                <span className="text-yellow-500">Connecting...</span>
              )}
              {isConnected && isListening && !isSpeaking && (
                <span className="text-green-500">Listening...</span>
              )}
              {isSpeaking && (
                <span className="text-primary">Deta is speaking...</span>
              )}
              {!isConnected && !isConnecting && (
                <span className="text-muted-foreground">Click to connect</span>
              )}
            </div>

            {/* Transcript */}
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-muted/50 text-sm text-left max-h-32 overflow-y-auto"
              >
                <span className="text-muted-foreground">You: </span>
                {transcript}
              </motion.div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-4">
              {!isConnected ? (
                <Button
                  onClick={connect}
                  disabled={isConnecting}
                  size="lg"
                  className="rounded-full w-16 h-16 p-0"
                >
                  <Phone className="h-6 w-6" />
                </Button>
              ) : (
                <>
                  <Button
                    onClick={toggleMute}
                    variant={isMuted ? "destructive" : "outline"}
                    size="lg"
                    className="rounded-full w-14 h-14 p-0"
                  >
                    {isMuted ? (
                      <MicOff className="h-5 w-5" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    onClick={disconnect}
                    variant="destructive"
                    size="lg"
                    className="rounded-full w-14 h-14 p-0"
                  >
                    <PhoneOff className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Powered by LPT-4 (Gemini 3)
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

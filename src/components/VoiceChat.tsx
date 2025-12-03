import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VoiceChat = ({ isOpen, onClose }: VoiceChatProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    audioElRef.current = document.createElement("audio");
    audioElRef.current.autoplay = true;
    
    return () => {
      disconnect();
    };
  }, []);

  const connect = async () => {
    setIsConnecting(true);
    
    try {
      // Get session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please login to use voice chat");
        setIsConnecting(false);
        return;
      }

      // Get ephemeral token from edge function
      const { data, error } = await supabase.functions.invoke("voice-session", {
        body: { model: "LPT-4" }
      });

      if (error || !data?.client_secret?.value) {
        console.error("Voice session error:", error);
        toast.error("Failed to start voice session");
        setIsConnecting(false);
        return;
      }

      const EPHEMERAL_KEY = data.client_secret.value;

      // Create peer connection
      pcRef.current = new RTCPeerConnection();

      // Set up remote audio
      pcRef.current.ontrack = (e) => {
        if (audioElRef.current) {
          audioElRef.current.srcObject = e.streams[0];
        }
      };

      // Add local audio track
      const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = ms;
      pcRef.current.addTrack(ms.getTracks()[0]);

      // Set up data channel
      dcRef.current = pcRef.current.createDataChannel("oai-events");
      dcRef.current.addEventListener("message", (e) => {
        const event = JSON.parse(e.data);
        handleMessage(event);
      });

      // Create and set local description
      const offer = await pcRef.current.createOffer();
      await pcRef.current.setLocalDescription(offer);

      // Connect to OpenAI's Realtime API
      const baseUrl = "https://api.openai.com/v1/realtime";
      const model = "gpt-4o-realtime-preview-2024-12-17";
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          "Content-Type": "application/sdp"
        },
      });

      const answer = {
        type: "answer" as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      
      await pcRef.current.setRemoteDescription(answer);
      
      setIsConnected(true);
      setIsConnecting(false);
      toast.success("Voice connected");
    } catch (error) {
      console.error("Connection error:", error);
      toast.error("Failed to connect voice");
      setIsConnecting(false);
    }
  };

  const handleMessage = (event: any) => {
    switch (event.type) {
      case "response.audio.delta":
        setIsSpeaking(true);
        break;
      case "response.audio.done":
        setIsSpeaking(false);
        break;
      case "conversation.item.input_audio_transcription.completed":
        setTranscript(event.transcript || "");
        break;
      case "response.text.delta":
        setAiResponse(prev => prev + (event.delta || ""));
        break;
      case "response.text.done":
        // Response complete
        break;
      case "response.done":
        setAiResponse("");
        break;
    }
  };

  const disconnect = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsConnected(false);
    setIsSpeaking(false);
    setTranscript("");
    setAiResponse("");
  };

  const toggleMute = () => {
    if (streamRef.current) {
      const audioTrack = streamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
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
          {/* Close button */}
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

            {/* Orb Animation */}
            <div className="relative mx-auto w-32 h-32">
              <motion.div
                animate={{
                  scale: isSpeaking ? [1, 1.2, 1] : isConnected ? [1, 1.05, 1] : 1,
                  opacity: isConnected ? 1 : 0.5,
                }}
                transition={{
                  duration: isSpeaking ? 0.3 : 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-primary-glow to-secondary"
                style={{
                  boxShadow: isConnected 
                    ? "0 0 60px rgba(124, 58, 237, 0.5)" 
                    : "none"
                }}
              />
              <div className="absolute inset-2 rounded-full bg-card flex items-center justify-center">
                {isSpeaking ? (
                  <Volume2 className="h-10 w-10 text-primary animate-pulse" />
                ) : (
                  <Mic className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Status */}
            <div className="text-sm">
              {isConnecting && (
                <span className="text-yellow-500">Connecting...</span>
              )}
              {isConnected && !isSpeaking && (
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
                className="p-3 rounded-lg bg-muted/50 text-sm text-left"
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

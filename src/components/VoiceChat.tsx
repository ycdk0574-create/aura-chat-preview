import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Volume2, Monitor, MonitorOff, MessageSquare, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import AudioVisualizer from "./AudioVisualizer";
import { useLiveApi } from "@/hooks/useLiveApi";
import { ConnectionState } from "@/types/voiceChat";
import { cn } from "@/lib/utils";

interface VoiceChatProps {
  isOpen: boolean;
  onClose: () => void;
}

// Emote shape configurations
const emoteShapes: Record<string, { borderRadius: string; scale: number; rotate: number }> = {
  neutral: { borderRadius: '50%', scale: 1, rotate: 0 },
  happy: { borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%', scale: 1.1, rotate: 0 },
  heart: { borderRadius: '50% 50% 50% 50%', scale: 1.15, rotate: 0 },
  sad: { borderRadius: '50% 50% 40% 40%', scale: 0.95, rotate: 0 },
  thinking: { borderRadius: '50%', scale: 1.05, rotate: 15 },
  angry: { borderRadius: '30% 30% 50% 50%', scale: 1.1, rotate: -5 },
  cool: { borderRadius: '20%', scale: 1.05, rotate: 0 },
  idea: { borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', scale: 1.1, rotate: 0 },
  sleep: { borderRadius: '50%', scale: 0.9, rotate: 0 },
  silly: { borderRadius: '40% 60% 60% 40% / 60% 40% 60% 40%', scale: 1.1, rotate: 10 }
};

// Theme color configurations
const themeColors: Record<string, { primary: string; secondary: string; glow: string }> = {
  default: { primary: 'from-primary via-primary/70 to-secondary', secondary: 'rgba(168, 85, 247, 0.5)', glow: 'rgba(168, 85, 247, 0.5)' },
  blue: { primary: 'from-blue-500 via-blue-400 to-cyan-400', secondary: 'rgba(59, 130, 246, 0.5)', glow: 'rgba(59, 130, 246, 0.5)' },
  purple: { primary: 'from-purple-600 via-purple-500 to-pink-500', secondary: 'rgba(147, 51, 234, 0.5)', glow: 'rgba(147, 51, 234, 0.5)' },
  red: { primary: 'from-red-500 via-red-400 to-orange-400', secondary: 'rgba(239, 68, 68, 0.5)', glow: 'rgba(239, 68, 68, 0.5)' },
  green: { primary: 'from-green-500 via-emerald-400 to-teal-400', secondary: 'rgba(34, 197, 94, 0.5)', glow: 'rgba(34, 197, 94, 0.5)' },
  orange: { primary: 'from-orange-500 via-amber-400 to-yellow-400', secondary: 'rgba(249, 115, 22, 0.5)', glow: 'rgba(249, 115, 22, 0.5)' },
  pink: { primary: 'from-pink-500 via-rose-400 to-fuchsia-400', secondary: 'rgba(236, 72, 153, 0.5)', glow: 'rgba(236, 72, 153, 0.5)' }
};

export const VoiceChat = ({ isOpen, onClose }: VoiceChatProps) => {
  const {
    connectionState,
    connect,
    disconnect,
    outputAnalyser,
    isMuted,
    toggleMute,
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
    switchModel,
    isModelTransitioning,
    currentEmote,
    currentTheme,
    isSpeaking,
    transcript,
    AVAILABLE_MODELS
  } = useLiveApi();

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isConnecting = connectionState === ConnectionState.CONNECTING;
  const isListening = isConnected && !isMuted && !isSpeaking;

  const currentShape = emoteShapes[currentEmote] || emoteShapes.neutral;
  const currentColors = themeColors[currentTheme] || themeColors.default;

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
        className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center"
      >
        {/* Model Transition Overlay */}
        <AnimatePresence>
          {isModelTransitioning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] bg-black/95 flex items-center justify-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full"
              />
              <p className="absolute mt-32 text-primary animate-pulse">Switching model...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-lg p-8 rounded-2xl bg-card/90 border border-border/50 shadow-2xl"
        >
          {/* Close Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4"
          >
            <PhoneOff className="h-5 w-5" />
          </Button>

          <div className="text-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Deta Voice</h2>
              <p className="text-sm text-muted-foreground">
                {AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || 'LPT-4'} • Real-time AI conversation
              </p>
            </div>

            {/* Audio Visualizer */}
            <div className="relative mx-auto w-full h-16">
              <AudioVisualizer 
                analyser={outputAnalyser} 
                isActive={isConnected && (isListening || isSpeaking)}
                color={isSpeaking ? "#a855f7" : "#38bdf8"}
              />
            </div>

            {/* Animated Orb */}
            <div className="relative mx-auto w-32 h-32">
              <motion.div
                animate={{
                  scale: isSpeaking ? [currentShape.scale, currentShape.scale * 1.15, currentShape.scale] : isListening ? [currentShape.scale, currentShape.scale * 1.05, currentShape.scale] : currentShape.scale,
                  opacity: isConnected ? 1 : 0.5,
                  borderRadius: currentShape.borderRadius,
                  rotate: currentShape.rotate,
                }}
                transition={{
                  duration: isSpeaking ? 0.3 : 2,
                  repeat: isSpeaking || isListening ? Infinity : 0,
                  ease: "easeInOut"
                }}
                className={cn(
                  "absolute inset-0 bg-gradient-to-br",
                  currentColors.primary
                )}
                style={{
                  boxShadow: isConnected 
                    ? `0 0 60px ${currentColors.glow}, 0 0 100px ${currentColors.glow}` 
                    : "none"
                }}
              />
              <motion.div 
                animate={{ borderRadius: currentShape.borderRadius }}
                className="absolute inset-3 bg-card flex items-center justify-center"
              >
                {isSpeaking ? (
                  <Volume2 className="h-10 w-10 text-primary animate-pulse" />
                ) : currentEmote === 'thinking' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Cpu className="h-10 w-10 text-primary" />
                  </motion.div>
                ) : (
                  <Mic className={cn(
                    "h-10 w-10",
                    isListening ? "text-green-500" : "text-muted-foreground"
                  )} />
                )}
              </motion.div>
            </div>

            {/* Status */}
            <div className="text-sm font-medium">
              {isConnecting && (
                <span className="text-yellow-500 animate-pulse">Connecting...</span>
              )}
              {isListening && (
                <span className="text-green-500">Listening...</span>
              )}
              {isSpeaking && (
                <span className="text-primary">Deta is speaking...</span>
              )}
              {isMuted && isConnected && (
                <span className="text-orange-500">Muted</span>
              )}
              {!isConnected && !isConnecting && (
                <span className="text-muted-foreground">Say "Hey Deta" or click to connect</span>
              )}
            </div>

            {/* Transcript */}
            {transcript && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-muted/50 text-sm text-left max-h-24 overflow-y-auto"
              >
                <span className="text-muted-foreground">You: </span>
                {transcript}
              </motion.div>
            )}

            {/* Chat Messages */}
            {isChatVisible && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 max-h-48 overflow-y-auto p-3 bg-muted/30 rounded-lg"
              >
                {messages.slice(-5).map(msg => (
                  <div
                    key={msg.id}
                    className={cn(
                      "text-sm p-2 rounded",
                      msg.role === 'user' ? 'bg-primary/20 text-right' : 'bg-muted'
                    )}
                  >
                    <span className="text-xs text-muted-foreground">
                      {msg.role === 'user' ? 'You' : 'Deta'}:
                    </span>
                    <p className="mt-1">{msg.text.slice(0, 200)}{msg.text.length > 200 ? '...' : ''}</p>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Models Selector */}
            {isModelsVisible && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-2 gap-2 p-3 bg-muted/30 rounded-lg"
              >
                {AVAILABLE_MODELS.map(model => (
                  <Button
                    key={model.id}
                    variant={currentModel === model.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => switchModel(model.id)}
                    className="text-xs"
                  >
                    {model.name}
                  </Button>
                ))}
              </motion.div>
            )}

            {/* Controls */}
            <div className="flex justify-center gap-3 flex-wrap">
              {!isConnected ? (
                <Button
                  onClick={() => connect()}
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
                    {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </Button>
                  
                  <Button
                    onClick={() => setIsChatVisible(!isChatVisible)}
                    variant={isChatVisible ? "default" : "outline"}
                    size="lg"
                    className="rounded-full w-14 h-14 p-0"
                  >
                    <MessageSquare className="h-5 w-5" />
                  </Button>
                  
                  <Button
                    onClick={() => setIsModelsVisible(!isModelsVisible)}
                    variant={isModelsVisible ? "default" : "outline"}
                    size="lg"
                    className="rounded-full w-14 h-14 p-0"
                  >
                    <Cpu className="h-5 w-5" />
                  </Button>

                  <Button
                    onClick={isScreenSharing ? stopScreenShare : startScreenShare}
                    variant={isScreenSharing ? "default" : "outline"}
                    size="lg"
                    className="rounded-full w-14 h-14 p-0"
                  >
                    {isScreenSharing ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
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
              Powered by {AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || 'LPT-4'} (Gemini 3)
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

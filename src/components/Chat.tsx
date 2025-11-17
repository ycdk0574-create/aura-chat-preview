import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import backgroundImage from "@/assets/background.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Zap, Send, Sparkles, Paperclip, Mic, X, Square, Code2, Search, Image as ImageIcon, Brain, BookOpen, Lightbulb, RefreshCw, Trash2, MicOff, Menu, Copy } from "lucide-react";
import { ChatMessage } from "./ChatMessage";
import { streamChat } from "@/lib/streamChat";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { ImageLibrary } from "./ImageLibrary";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  isTyping?: boolean;
  sources?: Array<{ title: string; link: string; snippet: string }>;
}

const DAILY_QUESTIONS = [
  "What's the latest in AI technology?",
  "How can I improve my productivity?",
  "Explain quantum computing to me",
  "What are the best practices for web development?",
  "Help me brainstorm startup ideas",
  "How does blockchain work?",
  "What's new in space exploration?",
  "Teach me about machine learning",
  "What are the trends in cybersecurity?",
  "How can I learn to code effectively?",
];

const STATUS_ANIMATIONS = [
  { text: "Deta Coding", icon: Code2, gradient: "from-blue-500 via-cyan-500 to-teal-500" },
  { text: "Deta Searching", icon: Search, gradient: "from-purple-500 via-pink-500 to-rose-500" },
  { text: "Deta Generating Image", icon: ImageIcon, gradient: "from-orange-500 via-amber-500 to-yellow-500" },
  { text: "Deta Thinking", icon: Brain, gradient: "from-indigo-500 via-purple-500 to-pink-500" },
  { text: "Deta Explaining", icon: BookOpen, gradient: "from-green-500 via-emerald-500 to-teal-500" },
  { text: "Deta Giving Idea", icon: Lightbulb, gradient: "from-yellow-500 via-orange-500 to-red-500" },
];

export const Chat = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [user, setUser] = useState<User | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("LPT-3.5");
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [detaStatus, setDetaStatus] = useState<string | null>(null);
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);
  const [randomQuestions, setRandomQuestions] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Auto resize function
  const autoResize = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  useEffect(() => { autoResize(); }, [input]);

  // Initialize random questions
  useEffect(() => {
    const shuffled = [...DAILY_QUESTIONS].sort(() => Math.random() - 0.5);
    setRandomQuestions(shuffled.slice(0, 3));
  }, []);

  // Check authentication
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);


  // Set status animation once based on input - no rotation
  useEffect(() => {
    if (!isLoading) return;
    
    // Detect what action is being performed based on the last input
    const lastMessage = messages[messages.length - 1];
    const inputLower = (lastMessage?.content || "").toLowerCase();
    let startIndex = 3; // Default to "Thinking"
    
    if (inputLower.includes("image") || inputLower.includes("תמונה") || inputLower.includes("picture") || inputLower.includes("draw") || inputLower.includes("generate")) {
      startIndex = 2; // "Generating Image"
    } else if (inputLower.includes("idea") || inputLower.includes("רעיון") || inputLower.includes("brainstorm") || inputLower.includes("suggest")) {
      startIndex = 5; // "Giving Idea"
    } else if (inputLower.includes("search") || inputLower.includes("חפש") || inputLower.includes("find")) {
      startIndex = 1; // "Searching"
    } else if (inputLower.includes("code") || inputLower.includes("קוד") || inputLower.includes("program") || inputLower.includes("function")) {
      startIndex = 0; // "Coding"
    } else if (inputLower.includes("explain") || inputLower.includes("הסבר") || inputLower.includes("what is") || inputLower.includes("מה זה")) {
      startIndex = 4; // "Explaining"
    }
    
    setCurrentStatusIndex(startIndex);
  }, [isLoading, messages]);

  useEffect(() => {
    // Only auto-scroll when a new message is added (not when user is typing)
    if (scrollRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only scroll if the last message is from assistant or if loading
      if (lastMessage.role === "assistant" || isLoading) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages, isLoading]);

  const createNewConversation = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New Chat'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      setCurrentConversationId(data.id);
      setMessages([]);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Failed to create conversation');
    }
  }, [user]);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      const { data: messagesData, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      
      const loadedMessages: Message[] = messagesData.map(msg => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: new Date(msg.created_at || Date.now()),
        images: (msg as any).image_urls || undefined,
      }));
      
      setCurrentConversationId(conversationId);
      setMessages(loadedMessages);
    } catch (error) {
      console.error('Error loading conversation:', error);
      toast.error('Failed to load conversation');
    }
  }, []);

  const saveMessage = async (message: Message) => {
    if (!currentConversationId || !user) return;
    
    try {
      // Save message to database
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: currentConversationId,
          role: message.role,
          content: message.content,
          image_urls: message.images || null
        } as any);
      
      if (msgError) throw msgError;
      
      // Auto-generate smart title from first user message
      if (message.role === 'user') {
        const { data: messages, error: fetchError } = await supabase
          .from('messages')
          .select('role')
          .eq('conversation_id', currentConversationId);
        
        if (!fetchError && messages) {
          const userMessages = messages.filter(m => m.role === 'user');
          
          // Only update title for the first user message
          if (userMessages.length === 1) {
            const generateTitle = (content: string): string => {
              // Remove common phrases and clean the text
              let title = content
                .replace(/^(hi|hello|hey|שלום|היי|מה נשמע|מה קורה)/gi, '')
                .trim();
              
              // Take first meaningful sentence or phrase
              const firstSentence = title.split(/[.!?]/)[0].trim();
              if (firstSentence.length > 0) {
                title = firstSentence;
              }
              
              // Limit length
              if (title.length > 50) {
                title = title.substring(0, 50) + '...';
              }
              
              return title || 'New Chat';
            };
            
            const smartTitle = generateTitle(message.content);
            
            await supabase
              .from('conversations')
              .update({
                title: smartTitle,
                updated_at: new Date().toISOString()
              })
              .eq('id', currentConversationId);
          } else {
            // Just update timestamp for subsequent messages
            await supabase
              .from('conversations')
              .update({ updated_at: new Date().toISOString() })
              .eq('id', currentConversationId);
          }
        }
      }
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Convert images to base64 for public access (no storage needed)
    toast.info("Converting images...", { id: 'convert' });
    try {
      const imagePromises = Array.from(files).map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      
      const base64Images = await Promise.all(imagePromises);
      setUploadedImages(prev => [...prev, ...base64Images]);
      toast.success(`${base64Images.length} image${base64Images.length > 1 ? 's' : ''} ready!`, { id: 'convert' });
    } catch (error) {
      toast.error("Failed to process images", { id: 'convert' });
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;
    
    // Create new conversation if none exists
    if (!currentConversationId) {
      await createNewConversation();
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Everyone has unlimited image generation - no restrictions

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input || "Check these images",
      timestamp: new Date(),
      images: uploadedImages.length > 0 ? uploadedImages : undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);

    const currentInput = input;
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);
    setCurrentStatusIndex(0);
    setDetaStatus(STATUS_ANIMATIONS[0].text);

    abortControllerRef.current = new AbortController();

    let assistantContent = "";
    const assistantImages: string[] = [];
    let assistantSources: Array<{ title: string; link: string; snippet: string }> = [];

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: assistantContent, images: assistantImages, sources: assistantSources }
              : m
          );
        }
        return [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: assistantContent, timestamp: new Date(), images: assistantImages, sources: assistantSources }
        ];
      });
    };

    try {
      await streamChat({
        messages: messages.concat(userMessage).map(m => ({ 
          role: m.role, 
          content: m.content,
          images: m.images
        })),
        model: selectedModel,
        abortSignal: abortControllerRef.current?.signal,
        onDelta: upsertAssistant,
        onImage: async (imgUrl) => {
          // No restrictions - everyone can generate unlimited images
          assistantImages.push(imgUrl);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, images: [...assistantImages] } : m);
            }
            return prev;
          });

          // Save to library if user is authenticated
          if (user) {
            try {
              await supabase.from('generated_images').insert({
                user_id: user.id,
                prompt: currentInput || "Generated image",
                image_url: imgUrl,
                image_data: imgUrl
              });
            } catch (error) {
              console.error('Error saving to library:', error);
            }
          }
        },
        onSources: (sources) => {
          assistantSources = sources;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, sources } : m);
            }
            return prev;
          });
        },
        onDone: async () => {
          setIsLoading(false);
          setDetaStatus(null);
          abortControllerRef.current = null;
          await saveMessage({ id: Date.now().toString(), role: "assistant", content: assistantContent, timestamp: new Date(), images: assistantImages.length ? assistantImages : undefined, sources: assistantSources.length ? assistantSources : undefined });
        },
        onError: (error) => {
          toast.error(error);
          setIsLoading(false);
          setDetaStatus(null);
          abortControllerRef.current = null;
          setMessages(prev => prev.slice(0, -1));
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') toast.error("שגיאה בשליחת ההודעה");
      setIsLoading(false);
      setDetaStatus(null);
      abortControllerRef.current = null;
      setMessages(prev => prev.slice(0, -1));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
      setDetaStatus(null);
      toast.info("Generation stopped");
    }
  };

  const handleVoiceInput = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(track => track.stop());

        // Convert to base64 and send to transcription
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result?.toString().split(",")[1];
          if (!base64Audio) return;

          toast.loading("Transcribing audio...", { id: "transcribe" });

          try {
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              },
              body: JSON.stringify({ audio: base64Audio }),
            });

            const data = await response.json();
            if (data.text) {
              setInput(data.text);
              toast.success("Transcription complete!", { id: "transcribe" });
            } else {
              throw new Error("No transcription returned");
            }
          } catch (error) {
            toast.error("Failed to transcribe audio", { id: "transcribe" });
          }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording... Click again to stop");
    } catch (error) {
      toast.error("Failed to access microphone");
    }
  };

  const handleRegenerateResponse = async () => {
    if (isLoading || messages.length < 2) return;

    // Find the last user message
    let lastUserMessageIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserMessageIndex = i;
        break;
      }
    }

    if (lastUserMessageIndex === -1) return;

    // Remove all messages after the last user message
    const newMessages = messages.slice(0, lastUserMessageIndex + 1);
    setMessages(newMessages);

    // Re-send the last user message
    const lastUserMessage = messages[lastUserMessageIndex];
    setInput("");
    setIsLoading(true);
    setCurrentStatusIndex(0);
    setDetaStatus(STATUS_ANIMATIONS[0].text);

    abortControllerRef.current = new AbortController();

    let assistantContent = "";
    const assistantImages: string[] = [];
    let assistantSources: Array<{ title: string; link: string; snippet: string }> = [];

    const upsertAssistant = (chunk: string) => {
      assistantContent += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, content: assistantContent, images: assistantImages, sources: assistantSources }
              : m
          );
        }
        return [
          ...prev,
          { id: Date.now().toString(), role: "assistant", content: assistantContent, timestamp: new Date(), images: assistantImages, sources: assistantSources }
        ];
      });
    };

    try {
      await streamChat({
        messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        model: selectedModel,
        abortSignal: abortControllerRef.current?.signal,
        onDelta: upsertAssistant,
        onImage: (imgUrl) => {
          // No restrictions - everyone can generate unlimited images
          assistantImages.push(imgUrl);
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, images: [...assistantImages] } : m);
            }
            return prev;
          });
        },
        onSources: (sources) => {
          assistantSources = sources;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) => i === prev.length - 1 ? { ...m, sources } : m);
            }
            return prev;
          });
        },
        onDone: async () => {
          setIsLoading(false);
          setDetaStatus(null);
          abortControllerRef.current = null;
          await saveMessage({ id: Date.now().toString(), role: "assistant", content: assistantContent, timestamp: new Date(), images: assistantImages.length ? assistantImages : undefined, sources: assistantSources.length ? assistantSources : undefined });
        },
        onError: (error) => {
          toast.error(error);
          setIsLoading(false);
          setDetaStatus(null);
          abortControllerRef.current = null;
          setMessages(prev => prev.slice(0, -1));
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') toast.error("Failed to regenerate response");
      setIsLoading(false);
      setDetaStatus(null);
      abortControllerRef.current = null;
      setMessages(prev => prev.slice(0, -1));
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const updatedMessages = messages.filter(m => m.id !== messageId);
      setMessages(updatedMessages);
      
      if (currentConversationId) {
        // Delete message from database
        await supabase
          .from('messages')
          .delete()
          .eq('id', messageId);
      }
      
      toast.success("Message deleted");
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleDeleteConversation = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      if (currentConversationId === id) {
        setMessages([]);
        setCurrentConversationId(null);
      }
      toast.success("Conversation deleted");
    } catch (error) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation');
    }
  }, [currentConversationId]);

  const isEmpty = messages.length === 0;
  const currentStatus = STATUS_ANIMATIONS[currentStatusIndex];

  // Memoize sidebar callbacks
  const handleNewChat = useCallback(() => {
    createNewConversation();
    if (isMobile) setMobileMenuOpen(false);
  }, [createNewConversation, isMobile]);

  const handleSelectConversation = useCallback((id: string) => {
    loadConversation(id);
    if (isMobile) setMobileMenuOpen(false);
  }, [loadConversation, isMobile]);

  const handleRenameConversation = useCallback(() => {
    // This will trigger a refresh in the ConversationHistory component
  }, []);

  // Memoize sidebar to prevent re-renders during typing
  const sidebarContent = useMemo(() => (
    <Sidebar
      onNewChat={handleNewChat}
      currentConversationId={currentConversationId}
      onSelectConversation={handleSelectConversation}
      onDeleteConversation={handleDeleteConversation}
      isAuthenticated={!!user}
      isOpen={sidebarOpen}
      onToggle={() => setSidebarOpen(!sidebarOpen)}
      onLibraryOpen={() => setLibraryOpen(true)}
    />
  ), [handleNewChat, currentConversationId, handleSelectConversation, handleDeleteConversation, user, sidebarOpen]);

  return (
    <div 
      className="flex h-screen relative"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Desktop Sidebar */}
      {!isMobile && <div className="relative z-10">{sidebarContent}</div>}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          modal={false}
        >
          <DrawerContent className="h-[85vh]">
            <DrawerHeader className="flex items-center justify-between px-4">
              <div className="sr-only">
                <DrawerTitle>Menu</DrawerTitle>
                <DrawerDescription>Navigation and chat history</DrawerDescription>
              </div>
              {/* כפתור סגירה ברור בתוך ה־Drawer בשביל ux במובייל */}
              <div className="ml-auto">
                <Button size="icon" variant="ghost" onClick={() => setMobileMenuOpen(false)} className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DrawerHeader>
            {sidebarContent}
          </DrawerContent>
        </Drawer>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Header */}
        <motion.header
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass border-b border-border/50 px-3 md:px-6 py-3 md:py-4"
        >
          <div className="flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-2 md:gap-3">
              {/* Desktop Sidebar Toggle */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="hover:bg-primary/20 gap-2"
                >
                  <Menu className="h-4 w-4" />
                  <span className="text-xs">Sidebar</span>
                </Button>
              )}

              {/* Mobile Menu Button */}
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileMenuOpen(true)}
                  className="hover:bg-primary/20 gap-2"
                >
                  <Menu className="h-4 w-4" />
                  <span className="text-xs">Menu</span>
                </Button>
              )}
            </div>

            {/* Model Selector - Right Side */}
            <div className="flex items-center gap-2">
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[100px] md:w-[140px] glow-border bg-card/50 text-xs md:text-sm h-8 md:h-10">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LPT-1">LPT-1 ⚙️</SelectItem>
                  <SelectItem value="LPT-1.5">LPT-1.5 ⚡</SelectItem>
                  <SelectItem value="LPT-2">LPT-2 🧠</SelectItem>
                  <SelectItem value="LPT-2.5">LPT-2.5 💬</SelectItem>
                  <SelectItem value="LPT-3">LPT-3 🌐</SelectItem>
                  <SelectItem value="LPT-3.5">LPT-3.5 🚀</SelectItem>
                  <SelectItem value="LPT-4">LPT-4 ✨ NEW</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.header>

        {/* Messages Area */}
        <ScrollArea className="flex-1 px-2 md:px-4">
          <div className="mx-auto max-w-4xl py-4 md:py-8">
            <AnimatePresence mode="popLayout">
              {isEmpty ? (
                <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                  <motion.div animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }} className="mb-8">
                    <Sparkles className="h-20 w-20 text-primary shadow-neon" />
                  </motion.div>
                  <motion.h1 className="text-3xl md:text-5xl font-bold mb-6 md:mb-8 bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent px-4 md:px-0">
                    Where should we begin?
                  </motion.h1>
                  <div className="mt-6 md:mt-8 space-y-3 max-w-2xl px-4 md:px-0">
                    <p className="text-xs md:text-sm text-muted-foreground mb-4">💡 Daily Questions</p>
                    {randomQuestions.map((question, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                      >
                        <Button
                          onClick={() => {
                            setInput(question);
                            setTimeout(() => handleSend(), 100);
                          }}
                          variant="outline"
                          className="w-full text-left justify-start glass glow-border hover:bg-primary/10 transition-smooth"
                        >
                          <Sparkles className="mr-2 h-4 w-4 text-primary" />
                          {question}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message, index) => (
                    <div key={message.id} className="relative group">
                      <ChatMessage message={message} index={index} />
                      {message.role === "assistant" && (
                        <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyMessage(message.content)}
                            disabled={isLoading}
                            className="text-xs"
                          >
                            <Copy className="h-3 w-3 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRegenerateResponse}
                            disabled={isLoading}
                            className="text-xs"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Regenerate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMessage(message.id)}
                            disabled={isLoading}
                            className="text-xs text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </AnimatePresence>
            {isLoading && detaStatus && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className={`p-2 rounded-lg bg-gradient-to-r ${currentStatus.gradient}`}
                >
                  <currentStatus.icon className="h-5 w-5 text-white" />
                </motion.div>
                <div className="flex flex-col">
                  <span className={`text-sm font-medium bg-gradient-to-r ${currentStatus.gradient} bg-clip-text text-transparent`}>
                    {currentStatus.text}
                  </span>
                  <span className="text-xs text-muted-foreground">Processing your request...</span>
                </div>
              </motion.div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} className="glass border-t border-border/50 px-4 py-6">
          <div className="mx-auto max-w-4xl">
            {uploadedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {uploadedImages.map((img, idx) => (
                  <div key={idx} className="relative inline-block flex-shrink-0">
                    <img src={img} alt={`Upload preview ${idx + 1}`} className="h-16 w-16 md:h-20 md:w-20 object-cover rounded-xl glass glow-border" />
                    <Button size="icon" variant="ghost" onClick={() => setUploadedImages(prev => prev.filter((_, i) => i !== idx))} className="absolute -top-2 -right-2 h-5 w-5 md:h-6 md:w-6 rounded-full bg-destructive hover:bg-destructive/80">
                      <X className="h-2.5 w-2.5 md:h-3 md:w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative flex items-center gap-2 md:gap-3 p-2 md:p-3 rounded-2xl glass glow-border shadow-neon">
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
              <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isUploadingImages} className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
                {isUploadingImages ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
                  </motion.div>
                ) : (
                  <Paperclip className="h-4 w-4 md:h-5 md:w-5" />
                )}
              </Button>
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                onFocus={() => {
                  // Prevent drawer from auto-closing when typing
                  if (isMobile && textareaRef.current) {
                    textareaRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }
                }}
                placeholder="Ask Anything..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 resize-none min-h-[36px] md:min-h-[40px] max-h-[150px] md:max-h-[200px] overflow-y-auto text-sm md:text-base"
                disabled={isLoading}
                rows={1}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={handleVoiceInput}
                className={`${isRecording ? "text-destructive animate-pulse" : ""} h-8 w-8 md:h-10 md:w-10 flex-shrink-0`}
              >
                {isRecording ? <MicOff className="h-4 w-4 md:h-5 md:w-5" /> : <Mic className="h-4 w-4 md:h-5 md:w-5" />}
              </Button>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  onClick={isLoading ? handleStopGeneration : handleSend} 
                  size="icon" 
                  disabled={!isLoading && (!input.trim() && uploadedImages.length === 0)}
                  className={`h-8 w-8 md:h-10 md:w-10 flex-shrink-0 ${isLoading ? "bg-destructive hover:bg-destructive/90 shadow-neon transition-smooth" : "gradient-primary shadow-neon transition-smooth hover:shadow-glow"}`}
                >
                  {isLoading ? <Square className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Send className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Library Dialog */}
      {!isMobile ? (
        <Drawer open={libraryOpen} onOpenChange={setLibraryOpen}>
          <DrawerContent className="h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Image Library</DrawerTitle>
              <DrawerDescription>Your generated images collection</DrawerDescription>
            </DrawerHeader>
            <ImageLibrary />
          </DrawerContent>
        </Drawer>
      ) : (
        <Drawer open={libraryOpen} onOpenChange={setLibraryOpen}>
          <DrawerContent className="h-[85vh]">
            <DrawerHeader>
              <DrawerTitle>Image Library</DrawerTitle>
              <DrawerDescription>Your generated images collection</DrawerDescription>
            </DrawerHeader>
            <ImageLibrary />
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
};

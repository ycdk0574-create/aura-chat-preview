import {
  MessageSquarePlus,
  Sparkles,
  Settings,
  Library,
  Bot,
  LogOut,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ConversationHistory } from "./ConversationHistory";
import { useNavigate } from "react-router-dom";
import { memo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  onNewChat: () => void;
  currentConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  isAuthenticated: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onLibraryOpen: () => void;
}

export const Sidebar = memo(({ 
  onNewChat, 
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  isAuthenticated,
  isOpen,
  onToggle,
  onLibraryOpen,
}: SidebarProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign out");
    }
  };

  if (!isOpen) return null;

  return (
    <aside
      className="h-screen w-64 bg-sidebar-background border-r border-sidebar-border flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            {/* Sparkles Logo */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ 
                duration: 2,
                repeat: Infinity,
                ease: "linear"
              }}
              className="flex items-center justify-center"
            >
              <Sparkles className="h-8 w-8 text-primary" />
            </motion.div>

            {/* Logo Text */}
            <h1 className="text-2xl font-bold text-foreground">
              Deta
            </h1>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-2 space-y-2 pb-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="ghost"
                onClick={onNewChat}
                className="w-full justify-start gap-3 hover:bg-sidebar-accent hover:text-primary transition-all"
                title="New Chat"
              >
                <MessageSquarePlus className="h-5 w-5" />
                <span>New Chat</span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="ghost"
                onClick={onLibraryOpen}
                className="w-full justify-start gap-3 hover:bg-sidebar-accent hover:text-primary transition-all"
                title="Library"
              >
                <Library className="h-5 w-5" />
                <span>Library</span>
              </Button>
            </motion.div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="ghost"
                className="w-full justify-start gap-3 hover:bg-sidebar-accent hover:text-primary transition-all relative"
                title="AI Agent"
              >
                <Bot className="h-5 w-5" />
                <span>AI Agent</span>
                <Badge variant="secondary" className="ml-auto text-xs">Soon</Badge>
              </Button>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="flex-1 overflow-hidden"
          >
            <ConversationHistory
              currentConversationId={currentConversationId}
              onSelectConversation={onSelectConversation}
              onDeleteConversation={onDeleteConversation}
            />
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 space-y-2">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            variant="ghost"
            onClick={() => navigate("/settings")}
            className="w-full justify-start gap-3 hover:bg-sidebar-accent hover:text-primary transition-all"
          >
            <Settings className="h-5 w-5" />
            <span>Settings</span>
          </Button>
        </motion.div>
        
        {isAuthenticated ? (
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start gap-3 hover:bg-sidebar-accent hover:text-destructive transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </motion.div>
        ) : (
          <motion.div 
            whileHover={{ scale: 1.02 }} 
            whileTap={{ scale: 0.98 }}
            className="flex justify-center"
          >
            <Button
              onClick={() => navigate("/auth")}
              className="w-full"
            >
              Sign In / Sign Up
            </Button>
          </motion.div>
        )}
        
        <div className="px-2 text-xs text-center text-muted-foreground">
          Powered by LiskCell · LPT Engine
        </div>
      </div>
    </aside>
  );
});

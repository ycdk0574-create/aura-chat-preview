import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Shield, Users, MessageSquare, Image as ImageIcon } from "lucide-react";
import backgroundImage from "@/assets/background.png";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalConversations: 0,
    totalMessages: 0,
    totalImages: 0,
  });
  const [posts, setPosts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    scheduled_for: "",
    image_url: "",
  });
  const [generatingImage, setGeneratingImage] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if user has admin role
      const { data: roleData, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (error || !roleData) {
        toast.error("Access denied. Admin privileges required.");
        navigate("/chat");
        return;
      }

      setIsAdmin(true);
      loadStats();
    } catch (error) {
      console.error("Error checking admin access:", error);
      navigate("/chat");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      // Get total users count
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id", { count: "exact" });

      // Get total conversations
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id", { count: "exact" });

      // Get total messages
      const { data: messages, error: msgError } = await supabase
        .from("messages")
        .select("id", { count: "exact" });

      // Get total images
      const { data: images, error: imgError } = await supabase
        .from("generated_images")
        .select("id", { count: "exact" });

      if (profilesError || convError || msgError || imgError) {
        throw new Error("Failed to load statistics");
      }

      setStats({
        totalUsers: profiles?.length || 0,
        totalConversations: conversations?.length || 0,
        totalMessages: messages?.length || 0,
        totalImages: images?.length || 0,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Failed to load statistics");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="min-h-screen bg-background/80 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/chat")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold">Admin Panel</h1>
                <p className="text-muted-foreground">System statistics and management</p>
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="p-6 glass">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Users</p>
                    <p className="text-3xl font-bold text-primary mt-2">
                      {stats.totalUsers}
                    </p>
                  </div>
                  <Users className="h-12 w-12 text-primary/20" />
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="p-6 glass">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Conversations</p>
                    <p className="text-3xl font-bold text-primary mt-2">
                      {stats.totalConversations}
                    </p>
                  </div>
                  <MessageSquare className="h-12 w-12 text-primary/20" />
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="p-6 glass">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Messages</p>
                    <p className="text-3xl font-bold text-primary mt-2">
                      {stats.totalMessages}
                    </p>
                  </div>
                  <MessageSquare className="h-12 w-12 text-primary/20" />
                </div>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="p-6 glass">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Generated Images</p>
                    <p className="text-3xl font-bold text-primary mt-2">
                      {stats.totalImages}
                    </p>
                  </div>
                  <ImageIcon className="h-12 w-12 text-primary/20" />
                </div>
              </Card>
            </motion.div>
          </div>

          {/* Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <Card className="p-6 glass">
              <h2 className="text-xl font-semibold mb-4">Admin Access</h2>
              <p className="text-muted-foreground">
                You have full administrative access to the system. This panel displays
                real-time statistics about user activity and system usage.
              </p>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Trash2, Edit, Eye } from "lucide-react";
import backgroundImage from "@/assets/background.png";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [newPost, setNewPost] = useState({ title: "", content: "", published: false });
  const [editingPost, setEditingPost] = useState<any>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (!roles || !roles.some(r => r.role === "admin")) {
        toast.error("Access denied - Admin only");
        navigate("/chat");
        return;
      }

      setIsAdmin(true);
      await loadData();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/chat");
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const { data: postsData } = await supabase
        .from("discover_posts")
        .select("*")
        .order("created_at", { ascending: false });

      const { data: conversationsData } = await supabase
        .from("conversations")
        .select(`
          id,
          title,
          created_at,
          user_id,
          profiles:user_id (full_name, email)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      setPosts(postsData || []);
      setConversations(conversationsData || []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.title || !newPost.content) {
      toast.error("Title and content are required");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("discover_posts")
        .insert({
          title: newPost.title,
          content: newPost.content,
          published: newPost.published,
          author_id: user!.id,
        });

      if (error) throw error;
      toast.success("Post created successfully");
      setNewPost({ title: "", content: "", published: false });
      await loadData();
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Failed to create post");
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost) return;

    try {
      const { error } = await supabase
        .from("discover_posts")
        .update({
          title: editingPost.title,
          content: editingPost.content,
          published: editingPost.published,
        })
        .eq("id", editingPost.id);

      if (error) throw error;
      toast.success("Post updated successfully");
      setEditingPost(null);
      await loadData();
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Failed to update post");
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const { error } = await supabase
        .from("discover_posts")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Post deleted successfully");
      await loadData();
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Failed to delete post");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="min-h-screen bg-background/80 backdrop-blur-sm">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/chat")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          </div>

          <Tabs defaultValue="posts" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="posts">Discover Posts</TabsTrigger>
              <TabsTrigger value="conversations">User Conversations</TabsTrigger>
            </TabsList>

            <TabsContent value="posts" className="space-y-6">
              {/* Create New Post */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6 glass">
                  <h2 className="text-xl font-semibold mb-4">
                    {editingPost ? "Edit Post" : "Create New Post"}
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={editingPost ? editingPost.title : newPost.title}
                        onChange={(e) =>
                          editingPost
                            ? setEditingPost({ ...editingPost, title: e.target.value })
                            : setNewPost({ ...newPost, title: e.target.value })
                        }
                        placeholder="Post title"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="content">Content</Label>
                      <Textarea
                        id="content"
                        value={editingPost ? editingPost.content : newPost.content}
                        onChange={(e) =>
                          editingPost
                            ? setEditingPost({ ...editingPost, content: e.target.value })
                            : setNewPost({ ...newPost, content: e.target.value })
                        }
                        placeholder="Post content (supports markdown)"
                        className="mt-2 min-h-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingPost ? editingPost.published : newPost.published}
                        onCheckedChange={(checked) =>
                          editingPost
                            ? setEditingPost({ ...editingPost, published: checked })
                            : setNewPost({ ...newPost, published: checked })
                        }
                      />
                      <Label>Published</Label>
                    </div>
                    <div className="flex gap-2">
                      {editingPost ? (
                        <>
                          <Button onClick={handleUpdatePost} className="flex-1">
                            Update Post
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingPost(null)}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button onClick={handleCreatePost} className="w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          Create Post
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>

              {/* Posts List */}
              <div className="space-y-4">
                {posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="p-6 glass">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{post.title}</h3>
                          <p className="text-sm text-muted-foreground mt-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-2 mt-4">
                            <span className={`text-xs px-2 py-1 rounded ${post.published ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                              {post.published ? 'Published' : 'Draft'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPost(post)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="conversations" className="space-y-4">
              {conversations.map((conv, index) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="p-6 glass">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold">{conv.title || "Untitled Conversation"}</h3>
                        <p className="text-sm text-muted-foreground mt-2">
                          User: {conv.profiles?.full_name || conv.profiles?.email || "Unknown"}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(conv.created_at).toLocaleDateString()} {new Date(conv.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          // View conversation details
                          toast.info("Viewing conversation details...");
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

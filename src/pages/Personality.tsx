import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowLeft, Save, User } from "lucide-react";
import backgroundImage from "@/assets/background.png";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Personality() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personality, setPersonality] = useState({
    personality_type: "friendly",
    custom_instructions: "",
    tone: "friendly",
  });

  useEffect(() => {
    loadPersonality();
  }, []);

  const loadPersonality = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data } = await supabase
        .from("personalities")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setPersonality({
          personality_type: data.personality_type || "friendly",
          custom_instructions: data.custom_instructions || "",
          tone: data.tone || "friendly",
        });
      }
    } catch (error) {
      console.error("Error loading personality:", error);
      toast.error("Failed to load personality settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("personalities")
        .upsert({
          user_id: user.id,
          personality_type: personality.personality_type,
          custom_instructions: personality.custom_instructions,
          tone: personality.tone,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
      toast.success("Personality settings saved successfully");
    } catch (error) {
      console.error("Error saving personality:", error);
      toast.error("Failed to save personality settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="min-h-screen bg-background/80 backdrop-blur-sm">
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              className="hover:bg-primary/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold text-foreground">Setup Personal</h1>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6 glass">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                AI Personality Settings
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="personality_type">Personality Type</Label>
                  <Select
                    value={personality.personality_type}
                    onValueChange={(value) =>
                      setPersonality({ ...personality, personality_type: value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select personality type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly & Casual</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="creative">Creative & Playful</SelectItem>
                      <SelectItem value="technical">Technical & Precise</SelectItem>
                      <SelectItem value="supportive">Supportive & Empathetic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="tone">Response Tone</Label>
                  <Select
                    value={personality.tone}
                    onValueChange={(value) =>
                      setPersonality({ ...personality, tone: value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="custom_instructions">Custom Instructions</Label>
                  <Textarea
                    id="custom_instructions"
                    value={personality.custom_instructions}
                    onChange={(e) =>
                      setPersonality({
                        ...personality,
                        custom_instructions: e.target.value,
                      })
                    }
                    placeholder="Add any custom instructions for how Deta should interact with you..."
                    className="mt-2 min-h-[150px]"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    These instructions will be used to personalize Deta's responses to you
                  </p>
                </div>

                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full mt-4"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Personality Settings"}
                </Button>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

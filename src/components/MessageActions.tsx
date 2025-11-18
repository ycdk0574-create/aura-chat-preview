import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Edit2, Trash2, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MessageActionsProps {
  messageId: string;
  content: string;
  isUser: boolean;
  onEdit?: (id: string, newContent: string) => void;
  onDelete?: (id: string) => void;
  onRegenerate?: (id: string) => void;
}

export const MessageActions = ({
  messageId,
  content,
  isUser,
  onEdit,
  onDelete,
  onRegenerate,
}: MessageActionsProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);

  const handleSave = () => {
    if (editedContent.trim() && onEdit) {
      onEdit(messageId, editedContent);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="mt-2 space-y-2"
      >
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          className="min-h-[100px]"
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave}>
            <Check className="h-4 w-4 mr-1" />
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      {onEdit && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-6 px-2"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
      )}
      {onDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(messageId)}
          className="h-6 px-2 text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      )}
      {!isUser && onRegenerate && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onRegenerate(messageId)}
          className="h-6 px-2"
        >
          <Check className="h-3 w-3 mr-1" />
          Regenerate
        </Button>
      )}
    </motion.div>
  );
};

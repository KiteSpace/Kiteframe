import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import type { NodeReactions, EmojiReaction } from '../types';

interface EmojiReactionsProps {
  nodeId: string;
  reactions?: NodeReactions;
  onAddReaction?: (nodeId: string, emoji: string) => void;
  onRemoveReaction?: (nodeId: string, emoji: string) => void;
  currentUserId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// Popular emoji options for quick reactions
const EMOJI_OPTIONS = [
  '👍', '👎', '❤️', '😄', '😮', '😢', '😡', '🎉',
  '🔥', '👀', '💡', '✅', '❌', '⚡', '🚀', '💯'
];

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  nodeId,
  reactions = {},
  onAddReaction,
  onRemoveReaction,
  currentUserId = 'current-user',
  position = 'bottom'
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    const reaction = reactions[emoji];
    const hasReacted = reaction?.userIds.includes(currentUserId);

    if (hasReacted) {
      onRemoveReaction?.(nodeId, emoji);
    } else {
      onAddReaction?.(nodeId, emoji);
    }
    setShowEmojiPicker(false);
  };

  const handleAddClick = () => {
    setShowEmojiPicker(!showEmojiPicker);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full mb-2';
      case 'left':
        return 'right-full mr-2';
      case 'right':
        return 'left-full ml-2';
      case 'bottom':
      default:
        return 'top-full mt-2';
    }
  };

  // Filter reactions that have at least one user
  const activeReactions = Object.entries(reactions).filter(([_, reaction]) => reaction.count > 0);

  if (activeReactions.length === 0 && !showEmojiPicker) {
    // Show add button when there are no reactions
    return (
      <div className="relative">
        <button
          onClick={handleAddClick}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-2 shadow-sm"
          title="Add reaction"
          data-testid="add-reaction-button"
        >
          <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Emoji picker */}
        {showEmojiPicker && (
          <div className={cn(
            "absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2",
            getPositionClasses()
          )}>
            <div className="grid grid-cols-4 gap-1 max-w-48">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                  title={`React with ${emoji}`}
                  data-testid={`emoji-option-${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {/* Render active reactions */}
        {activeReactions.map(([emoji, reaction]) => {
          const hasReacted = reaction.userIds.includes(currentUserId);
          
          return (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all",
                "border border-gray-200 dark:border-gray-700",
                hasReacted
                  ? "bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200"
                  : "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              )}
              title={`${reaction.count} reaction${reaction.count !== 1 ? 's' : ''}`}
              data-testid={`reaction-${emoji}`}
            >
              <span>{emoji}</span>
              <span className="text-xs font-medium">{reaction.count}</span>
            </button>
          );
        })}

        {/* Add reaction button */}
        <button
          onClick={handleAddClick}
          className={cn(
            "p-1.5 rounded-full transition-all",
            showEmojiPicker
              ? "bg-gray-200 dark:bg-gray-700"
              : "opacity-0 group-hover:opacity-100 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          )}
          title="Add reaction"
          data-testid="add-reaction-button"
        >
          <Plus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
        </button>
      </div>

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className={cn(
          "absolute z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2",
          getPositionClasses()
        )}>
          <div className="grid grid-cols-4 gap-1 max-w-48">
            {EMOJI_OPTIONS.map((emoji) => {
              const reaction = reactions[emoji];
              const hasReacted = reaction?.userIds.includes(currentUserId);
              
              return (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className={cn(
                    "p-2 rounded text-lg transition-all",
                    hasReacted
                      ? "bg-blue-100 dark:bg-blue-900"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  )}
                  title={`React with ${emoji}`}
                  data-testid={`emoji-option-${emoji}`}
                >
                  {emoji}
                  {reaction && reaction.count > 0 && (
                    <span className="ml-1 text-xs text-gray-600 dark:text-gray-400">
                      {reaction.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
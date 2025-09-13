import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Smile } from 'lucide-react';
import type { NodeReactions, EmojiReaction } from '../types';

interface EmojiReactionsProps {
  nodeId: string;
  reactions?: NodeReactions;
  onAddReaction?: (nodeId: string, emoji: string) => void;
  onRemoveReaction?: (nodeId: string, emoji: string) => void;
  currentUserId?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// Popular emoji options for quick reactions in the floating bar
const QUICK_EMOJIS = ['👍', '❤️', '😄', '🎉', '🔥', '💡'];

// Full emoji options for the expanded picker
const ALL_EMOJIS = [
  '👍', '👎', '❤️', '😄', '😮', '😢', '😡', '🎉',
  '🔥', '👀', '💡', '✅', '❌', '⚡', '🚀', '💯',
  '👏', '🙌', '💪', '✨', '🌟', '💖', '💜', '💙'
];

export const EmojiReactions: React.FC<EmojiReactionsProps> = ({
  nodeId,
  reactions = {},
  onAddReaction,
  onRemoveReaction,
  currentUserId = 'current-user',
  position = 'bottom'
}) => {
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [showFullPicker, setShowFullPicker] = useState(false);

  const handleEmojiClick = (emoji: string) => {
    const reaction = reactions[emoji];
    const hasReacted = reaction?.userIds.includes(currentUserId);

    if (hasReacted) {
      onRemoveReaction?.(nodeId, emoji);
    } else {
      onAddReaction?.(nodeId, emoji);
    }
  };

  const handleSmileyClick = () => {
    setShowReactionBar(!showReactionBar);
    setShowFullPicker(false);
  };

  const handleQuickEmojiClick = (emoji: string) => {
    handleEmojiClick(emoji);
    setShowReactionBar(false);
    setShowFullPicker(false);
  };

  const handleExpandPickerClick = () => {
    setShowFullPicker(!showFullPicker);
  };

  // Filter reactions that have at least one user
  const activeReactions = Object.entries(reactions).filter(([_, reaction]) => reaction.count > 0);

  // Handle outside clicks to close the reaction bar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showReactionBar) {
        const target = event.target as HTMLElement;
        // Don't close if clicking inside the reaction elements
        if (!target.closest('[data-testid*="reaction"]') && !target.closest('[data-testid*="emoji"]')) {
          setShowReactionBar(false);
          setShowFullPicker(false);
        }
      }
    };

    if (showReactionBar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showReactionBar]);

  return (
    <div className="absolute inset-0 pointer-events-none">

      {/* Active reactions display */}
      {activeReactions.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-1 pointer-events-auto">
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
        </div>
      )}

      {/* Floating reaction bar (similar to action toolbar) */}
      {showReactionBar && (
        <div className="absolute top-12 right-2 z-50 pointer-events-auto">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-1">
            {/* Quick emoji reactions */}
            {QUICK_EMOJIS.map((emoji) => {
              const reaction = reactions[emoji];
              const hasReacted = reaction?.userIds.includes(currentUserId);
              
              return (
                <button
                  key={emoji}
                  onClick={() => handleQuickEmojiClick(emoji)}
                  className={cn(
                    "p-2 rounded-md text-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-700",
                    hasReacted && "bg-blue-100 dark:bg-blue-900"
                  )}
                  title={`React with ${emoji}`}
                  data-testid={`quick-emoji-${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
            
            {/* Separator */}
            <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
            
            {/* More emojis button */}
            <button
              onClick={handleExpandPickerClick}
              className={cn(
                "p-2 rounded-md transition-all hover:bg-gray-100 dark:hover:bg-gray-700",
                showFullPicker && "bg-gray-200 dark:bg-gray-700"
              )}
              title="More emojis"
              data-testid="expand-emoji-picker"
            >
              <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Full emoji picker */}
      {showReactionBar && showFullPicker && (
        <div className="absolute top-20 right-2 z-50 pointer-events-auto">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl p-3">
            <div className="grid grid-cols-6 gap-1 max-w-72">
              {ALL_EMOJIS.map((emoji) => {
                const reaction = reactions[emoji];
                const hasReacted = reaction?.userIds.includes(currentUserId);
                
                return (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleEmojiClick(emoji);
                      setShowFullPicker(false);
                      setShowReactionBar(false);
                    }}
                    className={cn(
                      "p-2 rounded text-lg transition-all hover:bg-gray-100 dark:hover:bg-gray-700",
                      hasReacted && "bg-blue-100 dark:bg-blue-900"
                    )}
                    title={`React with ${emoji}`}
                    data-testid={`full-emoji-${emoji}`}
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
        </div>
      )}
    </div>
  );
};
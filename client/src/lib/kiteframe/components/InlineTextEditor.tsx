import React, { useState, useEffect, useRef } from 'react';

interface InlineTextEditorProps {
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  onSelectionChange?: (selectedText: string) => void;
  className?: string;
  style?: React.CSSProperties;
  autoFocus?: boolean;
  multiline?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export const InlineTextEditor: React.FC<InlineTextEditorProps> = ({
  initialValue,
  placeholder = "Enter text...",
  onSave,
  onCancel,
  onSelectionChange,
  className = "",
  style = {},
  autoFocus = true,
  multiline = false,
  fontSize = 14,
  fontFamily = 'Inter',
  fontWeight = 400,
  color = '#000000',
  textAlign = 'left'
}) => {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(true);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const originalValueRef = useRef(initialValue);
  const savedRef = useRef(false); // Prevent double saves
  const toolbarInteractionRef = useRef(false); // Track toolbar interactions to prevent blur closing editor

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // More robust outside click detection
      const target = event.target as Element;
      const inputElement = inputRef.current;
      
      // Check if click is on the LinearToolbar - don't close editing for toolbar interactions
      // Check both 'linear' and 'linear-text' data attributes
      const isToolbarClick = target?.closest?.('[data-toolbar="linear"], [data-toolbar="linear-text"]') !== null;
      if (isToolbarClick) {
        // Set flag to prevent blur from closing the editor
        toolbarInteractionRef.current = true;
        // Reset the flag after a short delay (after blur event fires)
        setTimeout(() => {
          toolbarInteractionRef.current = false;
        }, 100);
        return;
      }
      
      if (inputElement && target && !inputElement.contains(target)) {
        // Immediate save without timeout to avoid race conditions
        if (isEditing && !savedRef.current) {
          handleSave();
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    if (isEditing) {
      // Use capture phase to catch events before they're handled by other elements
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEditing, value]);

  const handleSave = () => {
    if (!isEditing || savedRef.current) return;
    
    savedRef.current = true;
    setIsEditing(false);
    onSave(value.trim());
  };

  const handleCancel = () => {
    if (!isEditing) return;
    
    setIsEditing(false);
    setValue(originalValueRef.current);
    onCancel();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !multiline) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Enter' && multiline && event.ctrlKey) {
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  };

  const handleSelectionChange = () => {
    if (!inputRef.current || !onSelectionChange) return;
    
    const input = inputRef.current;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    
    if (start !== end) {
      const selectedText = value.substring(start, end);
      onSelectionChange(selectedText);
    } else {
      onSelectionChange('');
    }
  };

  const inputStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    fontFamily,
    fontWeight,
    color,
    textAlign,
    border: 'none',
    outline: 'none',
    background: 'transparent',
    resize: 'none',
    width: '100%',
    padding: '2px',
    ...style,
  };

  if (!isEditing) {
    return null;
  }

  const handleBlur = (e: React.FocusEvent) => {
    // Check if we're interacting with the toolbar (flag set by mousedown handler)
    if (toolbarInteractionRef.current) {
      return;
    }
    
    // Check if blur is going to the toolbar - don't save in that case
    const relatedTarget = e.relatedTarget as Element | null;
    
    // Only skip save if relatedTarget exists AND is inside the toolbar
    // Check both 'linear' and 'linear-text' data attributes
    const isToolbarClick = relatedTarget !== null && 
      relatedTarget.closest?.('[data-toolbar="linear"], [data-toolbar="linear-text"]') !== null;
    
    if (isToolbarClick) {
      // Don't refocus - let the user interact with toolbar inputs
      // The inline editing state is preserved, so clicking back on the text will work
      return;
    }
    
    // Don't save on blur if document listener is active to prevent double saves
    if (!savedRef.current) {
      handleSave();
    }
  };

  const autoResizeTextarea = (textarea: HTMLTextAreaElement) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    if (multiline && inputRef.current) {
      const textarea = inputRef.current as HTMLTextAreaElement;
      autoResizeTextarea(textarea);
    }
  }, [multiline, value]);

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          autoResizeTextarea(e.target);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onSelect={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        placeholder={placeholder}
        className={`inline-text-editor ${className}`}
        style={{
          ...inputStyle,
          overflow: 'hidden',
          minHeight: '1.5em',
        }}
        rows={1}
        data-testid="inline-text-editor-textarea"
      />
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      onSelect={handleSelectionChange}
      onMouseUp={handleSelectionChange}
      onKeyUp={handleSelectionChange}
      placeholder={placeholder}
      className={`inline-text-editor ${className}`}
      style={inputStyle}
      data-testid="inline-text-editor-input"
    />
  );
};
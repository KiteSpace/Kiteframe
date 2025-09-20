import React, { useState, useEffect, useRef } from 'react';

interface InlineTextEditorProps {
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
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

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        // Add a small delay to ensure event propagation is complete
        setTimeout(() => {
          handleSave();
        }, 0);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isEditing]);

  const handleSave = () => {
    if (!isEditing) return;
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

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder={placeholder}
        className={`inline-text-editor ${className}`}
        style={inputStyle}
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
      onBlur={handleSave}
      placeholder={placeholder}
      className={`inline-text-editor ${className}`}
      style={inputStyle}
      data-testid="inline-text-editor-input"
    />
  );
};
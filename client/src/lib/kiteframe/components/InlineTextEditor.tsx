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
  const savedRef = useRef(false); // Prevent double saves

  console.log('📝 TEXT EDITOR: Component mounted', {
    initialValue,
    placeholder,
    multiline,
    fontSize,
    fontFamily,
    autoFocus
  });

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
      
      console.log('🖱️ TEXT EDITOR: Click event detected', {
        target: target?.tagName || 'unknown',
        targetClass: target?.className || 'none',
        inputElement: inputElement?.tagName || 'none',
        inputClass: inputElement?.className || 'none',
        isEditing,
        currentValue: value
      });
      
      // Check if click is on the LinearToolbar - don't close editing for toolbar interactions
      const isToolbarClick = target?.closest?.('[data-toolbar="linear"]') !== null;
      if (isToolbarClick) {
        console.log('🖱️ TEXT EDITOR: Toolbar click detected - keeping editor open');
        return;
      }
      
      if (inputElement && target && !inputElement.contains(target)) {
        console.log('🖱️ TEXT EDITOR: Click outside detected - triggering save', {
          currentValue: value,
          originalValue: originalValueRef.current,
          isEditing,
          willSave: isEditing
        });
        
        // Immediate save without timeout to avoid race conditions
        if (isEditing && !savedRef.current) {
          handleSave();
        }
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      console.log('⌨️ TEXT EDITOR: Escape key detected in document listener');
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    if (isEditing) {
      // Use capture phase to catch events before they're handled by other elements
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('keydown', handleEscape);
      
      console.log('👂 TEXT EDITOR: Event listeners attached', {
        isEditing,
        inputRef: !!inputRef.current
      });
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
      
      if (isEditing) {
        console.log('🧹 TEXT EDITOR: Event listeners removed');
      }
    };
  }, [isEditing, value]);

  const handleSave = () => {
    if (!isEditing || savedRef.current) return;
    
    console.log('💾 TEXT EDITOR: Save triggered', {
      originalValue: originalValueRef.current,
      currentValue: value,
      trimmedValue: value.trim(),
      wasEditing: isEditing,
      alreadySaved: savedRef.current,
      source: 'handleSave'
    });
    
    savedRef.current = true;
    setIsEditing(false);
    onSave(value.trim());
  };

  const handleCancel = () => {
    if (!isEditing) return;
    
    console.log('❌ TEXT EDITOR: Cancel triggered', {
      originalValue: originalValueRef.current,
      currentValue: value,
      wasEditing: isEditing,
      source: 'handleCancel'
    });
    
    setIsEditing(false);
    setValue(originalValueRef.current);
    onCancel();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    console.log('⌨️ TEXT EDITOR: Key pressed', {
      key: event.key,
      multiline,
      ctrlKey: event.ctrlKey,
      currentValue: value,
      originalValue: originalValueRef.current
    });

    if (event.key === 'Enter' && !multiline) {
      console.log('🔄 TEXT EDITOR: Enter key save (single line)');
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Enter' && multiline && event.ctrlKey) {
      console.log('🔄 TEXT EDITOR: Ctrl+Enter save (multiline)');
      event.preventDefault();
      handleSave();
    } else if (event.key === 'Escape') {
      console.log('🔄 TEXT EDITOR: Escape key cancel');
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

  const handleBlur = (e: React.FocusEvent) => {
    // Check if blur is going to the toolbar - don't save in that case
    const relatedTarget = e.relatedTarget as Element | null;
    const isToolbarClick = relatedTarget?.closest?.('[data-toolbar="linear"]') !== null;
    
    if (isToolbarClick) {
      console.log('💾 TEXT EDITOR: Blur to toolbar - keeping editor open');
      // Refocus the input to keep editing active
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    
    // Don't save on blur if document listener is active to prevent double saves
    if (!savedRef.current) {
      console.log('💾 TEXT EDITOR: Blur save (backup)');
      handleSave();
    }
  };

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
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
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`inline-text-editor ${className}`}
      style={inputStyle}
      data-testid="inline-text-editor-input"
    />
  );
};
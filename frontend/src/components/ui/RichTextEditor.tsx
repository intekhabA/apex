import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Sparkles,
  Minus,
} from 'lucide-react';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type radiologist observations, organ findings, or clinical impression here...',
  minHeight = 'min-h-[280px]',
  className = '',
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);

  // Active state indicators
  const [activeFormats, setActiveFormats] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
  });

  const updateActiveFormats = useCallback(() => {
    if (readOnly || !document.queryCommandState) return;
    try {
      setActiveFormats({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      });
    } catch {
      // Ignore if document selection is outside editor
    }
  }, [readOnly]);

  // Convert plain text into HTML if needed
  const formatInitialHtml = (raw: string): string => {
    if (!raw) return '';
    // If it already looks like HTML (has tags)
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      return raw;
    }
    // Convert newlines to breaks
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');
  };

  // Sync external value to editor HTML when value changes outside user typing
  useEffect(() => {
    if (!editorRef.current) return;
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const formattedHtml = formatInitialHtml(value);
    if (editorRef.current.innerHTML !== formattedHtml) {
      editorRef.current.innerHTML = formattedHtml;
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    isInternalChangeRef.current = true;
    onChange(editorRef.current.innerHTML);
    updateActiveFormats();
  };

  const executeCommand = (command: string, cmdValue: string | undefined = undefined) => {
    if (readOnly) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    document.execCommand(command, false, cmdValue);
    handleInput();
    updateActiveFormats();
  };

  const insertSnippet = (snippetHtml: string) => {
    if (readOnly) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    // Try execCommand insertHTML
    const success = document.execCommand('insertHTML', false, snippetHtml);
    if (!success && editorRef.current) {
      // Fallback: append to end
      editorRef.current.innerHTML += `<br/>${snippetHtml}`;
    }
    handleInput();
  };

  return (
    <div
      className={`border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all ${className}`}
    >
      {/* Formatting Toolbar */}
      {!readOnly && (
        <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-1 select-none text-slate-700">
          {/* Quick Section Chips */}
          <div className="w-full pb-1 mb-1 border-b border-slate-200/80 flex flex-wrap items-center gap-1 text-[11px]">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-teal-600" /> Quick Sections:
            </span>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertSnippet('<div><b>CLINICAL HISTORY &amp; INDICATION:</b></div><div><br/></div>');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium border border-slate-200 transition-colors"
            >
              + History
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertSnippet('<div><b>OBSERVATIONS &amp; FINDINGS:</b></div><div><br/></div>');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium border border-slate-200 transition-colors"
            >
              + Findings
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertSnippet('<div><b>IMPRESSION:</b></div><div><br/></div>');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium border border-slate-200 transition-colors"
            >
              + Impression
            </button>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                insertSnippet('<div><b>RECOMMENDATIONS &amp; ADVICE:</b></div><div><br/></div>');
              }}
              className="px-2 py-0.5 rounded bg-white hover:bg-teal-50 hover:text-teal-700 text-slate-700 font-medium border border-slate-200 transition-colors"
            >
              + Advice
            </button>
          </div>

          {/* Core Text Styling: Bold, Italic, Underline, Strike */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Bold (Ctrl+B)"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('bold');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.bold ? 'bg-teal-100 text-teal-800 font-bold' : 'text-slate-700'
              }`}
            >
              <Bold className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Italic (Ctrl+I)"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('italic');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.italic ? 'bg-teal-100 text-teal-800 font-bold' : 'text-slate-700'
              }`}
            >
              <Italic className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Underline (Ctrl+U)"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('underline');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.underline ? 'bg-teal-100 text-teal-800 font-bold' : 'text-slate-700'
              }`}
            >
              <Underline className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Strikethrough"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('strikeThrough');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.strikeThrough ? 'bg-teal-100 text-teal-800 font-bold' : 'text-slate-700'
              }`}
            >
              <Strikethrough className="w-4 h-4" />
            </button>
          </div>

          <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

          {/* Heading Formatting */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Section Heading 1"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('formatBlock', '<h3>');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Heading1 className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Section Heading 2"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('formatBlock', '<h4>');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Heading2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Sub-heading 3"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('formatBlock', '<h5>');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Heading3 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

          {/* Lists */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Bullet List"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('insertUnorderedList');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.insertUnorderedList ? 'bg-teal-100 text-teal-800' : 'text-slate-700'
              }`}
            >
              <List className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Numbered List"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('insertOrderedList');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.insertOrderedList ? 'bg-teal-100 text-teal-800' : 'text-slate-700'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
            </button>
          </div>

          <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

          {/* Alignment */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title="Align Left"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyLeft');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.justifyLeft ? 'bg-teal-100 text-teal-800' : 'text-slate-700'
              }`}
            >
              <AlignLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Align Center"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyCenter');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.justifyCenter ? 'bg-teal-100 text-teal-800' : 'text-slate-700'
              }`}
            >
              <AlignCenter className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Align Right"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('justifyRight');
              }}
              className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
                activeFormats.justifyRight ? 'bg-teal-100 text-teal-800' : 'text-slate-700'
              }`}
            >
              <AlignRight className="w-4 h-4" />
            </button>
          </div>

          <div className="w-[1px] h-5 bg-slate-200 mx-0.5" />

          {/* Divider & Clear */}
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              type="button"
              title="Horizontal Divider"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('insertHorizontalRule');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Remove Formatting"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('removeFormat');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <RemoveFormatting className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Undo"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('undo');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Undo className="w-4 h-4" />
            </button>

            <button
              type="button"
              title="Redo"
              onMouseDown={(e) => {
                e.preventDefault();
                executeCommand('redo');
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <Redo className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Editable Content Area */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        data-placeholder={placeholder}
        className={`p-4 text-slate-800 text-sm leading-relaxed focus:outline-none overflow-y-auto ${minHeight} [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-slate-400 [&:empty:before]:pointer-events-none prose-sm max-w-none [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-slate-800 [&_h4]:mt-2 [&_h4]:mb-1 [&_h5]:text-xs [&_h5]:font-bold [&_h5]:text-slate-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_hr]:my-3 [&_hr]:border-slate-200 [&_b]:font-bold [&_b]:text-slate-900 [&_strong]:font-bold [&_strong]:text-slate-900 font-sans`}
      />
    </div>
  );
};

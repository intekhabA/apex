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
  Palette,
  Highlighter,
  ChevronDown,
  FileText,
  Check,
} from 'lucide-react';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
  readOnly?: boolean;
}

// Preset color options for medical reporting
export const TEXT_COLORS = [
  { name: 'Default Dark', value: '#0f172a' },
  { name: 'Muted Slate', value: '#475569' },
  { name: 'Critical / Red', value: '#dc2626' },
  { name: 'Warning Orange', value: '#ea580c' },
  { name: 'Caution Amber', value: '#d97706' },
  { name: 'Normal / Green', value: '#16a34a' },
  { name: 'Clinical Blue', value: '#2563eb' },
  { name: 'Impression Purple', value: '#7c3aed' },
  { name: 'Urgent Rose', value: '#e11d48' },
  { name: 'Teal Accent', value: '#0d9488' },
];

export const HIGHLIGHT_COLORS = [
  { name: 'None (Clear)', value: 'transparent' },
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Soft Green', value: '#bbf7d0' },
  { name: 'Soft Blue', value: '#bae6fd' },
  { name: 'Soft Pink', value: '#fbcfe8' },
  { name: 'Soft Orange', value: '#fed7aa' },
  { name: 'Soft Purple', value: '#e9d5ff' },
];

/**
 * Robust sanitizer for content copied from Microsoft Word, Google Docs, or LibreOffice.
 * Strips XML namespaces, MSO conditionals, stylesheets, and bloat while preserving:
 * - Text colors and highlights
 * - Bold, italic, underline, strike
 * - Headings, paragraphs, linebreaks
 * - Bulleted & numbered lists
 * - Measurement tables & key-value grids
 */
export const cleanPastedHtml = (rawHtml: string): string => {
  if (!rawHtml) return '';

  let html = rawHtml;

  // 1. Strip MSO conditional comments, XML blocks, stylesheets, scripts
  html = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  const fragMatch = html.match(/<!--StartFragment-->([\s\S]*?)<!--EndFragment-->/i);
  if (fragMatch) {
    html = fragMatch[1];
  }
  html = html.replace(/<!--[\s\S]*?-->/g, '');
  html = html.replace(/<style[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<xml[\s\S]*?<\/xml>/gi, '');
  html = html.replace(/<\/?(?:meta|link|title|o:[a-z0-9_-]+|w:[a-z0-9_-]+|m:[a-z0-9_-]+)[^>]*>/gi, '');

  // 2. Parse into clean DOM using browser's native DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const body = doc.body;

  const sanitizeNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.cloneNode(true);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();

      // Extract styles
      const colorVal = el.style.color || el.getAttribute('color');
      const bgVal = el.style.backgroundColor;
      const isBold =
        ['b', 'strong'].includes(tag) ||
        /bold|[6-9]00/i.test(el.style.fontWeight || '');
      const isItalic =
        ['i', 'em'].includes(tag) ||
        /italic/i.test(el.style.fontStyle || '');
      const isUnderline =
        tag === 'u' ||
        /underline/i.test(el.style.textDecoration || '');
      const isStrike =
        ['s', 'strike'].includes(tag) ||
        /line-through/i.test(el.style.textDecoration || '');

      // Sanitize children recursively
      const childFrag = document.createDocumentFragment();
      node.childNodes.forEach((child) => {
        const cleanedChild = sanitizeNode(child);
        if (cleanedChild) childFrag.appendChild(cleanedChild);
      });

      // Headings
      if (['h1', 'h2', 'h3'].includes(tag)) {
        const h = document.createElement('h3');
        h.appendChild(childFrag);
        return h;
      }
      if (['h4', 'h5', 'h6'].includes(tag)) {
        const h = document.createElement('h4');
        h.appendChild(childFrag);
        return h;
      }

      // Lists
      if (tag === 'ul' || tag === 'ol') {
        const list = document.createElement(tag);
        list.appendChild(childFrag);
        return list;
      }
      if (tag === 'li') {
        const li = document.createElement('li');
        li.appendChild(childFrag);
        return li;
      }

      // Break & rule
      if (tag === 'br') return document.createElement('br');
      if (tag === 'hr') return document.createElement('hr');

      // Tables
      if (['table', 'thead', 'tbody', 'tr'].includes(tag)) {
        const t = document.createElement(tag);
        t.appendChild(childFrag);
        return t;
      }
      if (tag === 'td' || tag === 'th') {
        const cell = document.createElement(tag);
        cell.className = 'border border-slate-300 p-1.5';
        cell.appendChild(childFrag);
        return cell;
      }

      // Assemble formatting container
      let container: HTMLElement = document.createElement('span');
      container.appendChild(childFrag);

      // Colors
      if (colorVal && !/windowtext|#000000|rgb\(0,\s*0,\s*0\)/i.test(colorVal)) {
        container.style.color = colorVal;
      }
      if (bgVal && !/transparent|#ffffff|rgb\(255,\s*255,\s*255\)/i.test(bgVal)) {
        container.style.backgroundColor = bgVal;
      }

      if (isStrike) {
        const s = document.createElement('s');
        s.appendChild(container);
        container = s;
      }
      if (isUnderline) {
        const u = document.createElement('u');
        u.appendChild(container);
        container = u;
      }
      if (isItalic) {
        const i = document.createElement('i');
        i.appendChild(container);
        container = i;
      }
      if (isBold) {
        const b = document.createElement('b');
        b.appendChild(container);
        container = b;
      }

      // Block containers: p, div
      if (['p', 'div'].includes(tag)) {
        const p = document.createElement('p');
        const align = el.style.textAlign;
        if (align && ['left', 'center', 'right', 'justify'].includes(align.toLowerCase())) {
          p.style.textAlign = align.toLowerCase();
        }
        p.appendChild(container);
        return p;
      }

      return container;
    }

    return null;
  };

  const finalFrag = document.createDocumentFragment();
  body.childNodes.forEach((child) => {
    const cleaned = sanitizeNode(child);
    if (cleaned) finalFrag.appendChild(cleaned);
  });

  const wrapper = document.createElement('div');
  wrapper.appendChild(finalFrag);
  return wrapper.innerHTML;
};

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Type radiologist observations, organ findings, or clinical impression here...',
  minHeight = 'min-h-[280px]',
  className = '',
  readOnly = false,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const highlightDropdownRef = useRef<HTMLDivElement>(null);
  const isInternalChangeRef = useRef(false);
  const savedSelectionRangeRef = useRef<Range | null>(null);

  // Formatting states
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

  // Color tools state
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#0f172a');
  const [currentHighlight, setCurrentHighlight] = useState('transparent');
  const [pasteNotice, setPasteNotice] = useState<string | null>(null);

  // Close color popovers when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        colorDropdownRef.current &&
        !colorDropdownRef.current.contains(e.target as Node)
      ) {
        setShowColorPicker(false);
      }
      if (
        highlightDropdownRef.current &&
        !highlightDropdownRef.current.contains(e.target as Node)
      ) {
        setShowHighlightPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreSelection = () => {
    if (savedSelectionRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedSelectionRangeRef.current);
      }
    }
  };

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
    if (/<[a-z][\s\S]*>/i.test(raw)) {
      return raw;
    }
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

  const applyTextColor = (color: string) => {
    setCurrentColor(color);
    setShowColorPicker(false);
    restoreSelection();
    executeCommand('foreColor', color);
  };

  const applyHighlightColor = (color: string) => {
    setCurrentHighlight(color);
    setShowHighlightPicker(false);
    restoreSelection();
    // Use hiliteColor or backColor for cross-browser support
    try {
      executeCommand('hiliteColor', color);
    } catch {
      executeCommand('backColor', color);
    }
  };

  const insertSnippet = (snippetHtml: string) => {
    if (readOnly) return;
    if (editorRef.current) {
      editorRef.current.focus();
    }
    const success = document.execCommand('insertHTML', false, snippetHtml);
    if (!success && editorRef.current) {
      editorRef.current.innerHTML += `<br/>${snippetHtml}`;
    }
    handleInput();
  };

  // Handle Paste from Microsoft Word / Google Docs / Plain text
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const clipboardData = e.clipboardData;
    const htmlData = clipboardData.getData('text/html');
    const textData = clipboardData.getData('text/plain');

    let cleaned = '';
    const isDocSource = /mso|word|office|docs-internal/i.test(htmlData);

    if (htmlData && htmlData.trim().length > 0) {
      cleaned = cleanPastedHtml(htmlData);
    } else if (textData) {
      cleaned = textData
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\r\n/g, '<br/>')
        .replace(/[\r\n]/g, '<br/>');
    }

    if (cleaned) {
      const inserted = document.execCommand('insertHTML', false, cleaned);
      if (!inserted && editorRef.current) {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          const temp = document.createElement('div');
          temp.innerHTML = cleaned;
          const frag = document.createDocumentFragment();
          let child: ChildNode | null;
          let lastChild: ChildNode | null = null;
          while ((child = temp.firstChild)) {
            lastChild = frag.appendChild(child);
          }
          range.insertNode(frag);
          if (lastChild) {
            range.setStartAfter(lastChild);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else {
          editorRef.current.innerHTML += cleaned;
        }
      }

      handleInput();

      if (isDocSource) {
        setPasteNotice('Pasted from Doc with styles & colors preserved');
        setTimeout(() => setPasteNotice(null), 3000);
      }
    }
  };

  return (
    <div
      className={`border border-slate-300 rounded-xl overflow-hidden bg-white shadow-sm focus-within:ring-2 focus-within:ring-teal-500 focus-within:border-teal-500 transition-all ${className}`}
    >
      {/* Formatting Toolbar */}
      {!readOnly && (
        <div className="bg-slate-50 border-b border-slate-200 p-1.5 flex flex-wrap items-center gap-1 select-none text-slate-700">
          {/* Quick Section Chips & Paste Indicator */}
          <div className="w-full pb-1 mb-1 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <div className="flex flex-wrap items-center gap-1">
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

            {/* Doc Paste helper hint */}
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              {pasteNotice ? (
                <span className="flex items-center gap-1 text-emerald-600 font-medium animate-fade-in">
                  <Check className="w-3 h-3" /> {pasteNotice}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400" title="Paste directly with Ctrl+V from MS Word or Google Docs. Bold, headings, tables, and colors are automatically cleaned and preserved.">
                  <FileText className="w-3 h-3 text-slate-400" /> Word / Doc Paste Supported (Ctrl+V)
                </span>
              )}
            </div>
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

          {/* Color & Highlight Tools */}
          <div className="flex items-center gap-1">
            {/* Text Color Picker */}
            <div className="relative" ref={colorDropdownRef}>
              <button
                type="button"
                title="Text Color"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                  setShowColorPicker((prev) => !prev);
                  setShowHighlightPicker(false);
                }}
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-200 transition-colors text-slate-700 ${
                  showColorPicker ? 'bg-slate-200 ring-1 ring-slate-300' : ''
                }`}
              >
                <div className="flex flex-col items-center">
                  <Palette className="w-3.5 h-3.5" />
                  <span
                    className="w-3.5 h-1 rounded-sm mt-0.5"
                    style={{ backgroundColor: currentColor }}
                  />
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Color Dropdown Popover */}
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-52 animate-fade-in">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Text Font Color
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 mb-2.5">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyTextColor(c.value);
                        }}
                        className="w-8 h-8 rounded-md border border-slate-200 flex items-center justify-center transition-transform hover:scale-110 shadow-sm"
                        style={{ backgroundColor: c.value }}
                      >
                        {currentColor.toLowerCase() === c.value.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Native Custom Color Picker */}
                  <label className="flex items-center justify-between text-xs text-slate-600 pt-2 border-t border-slate-100 cursor-pointer hover:text-slate-900">
                    <span>Custom Color</span>
                    <input
                      type="color"
                      value={currentColor}
                      onMouseDown={() => saveSelection()}
                      onChange={(e) => applyTextColor(e.target.value)}
                      className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Text Highlight Picker */}
            <div className="relative" ref={highlightDropdownRef}>
              <button
                type="button"
                title="Text Highlight Color"
                onMouseDown={(e) => {
                  e.preventDefault();
                  saveSelection();
                  setShowHighlightPicker((prev) => !prev);
                  setShowColorPicker(false);
                }}
                className={`flex items-center gap-1 px-1.5 py-1 rounded hover:bg-slate-200 transition-colors text-slate-700 ${
                  showHighlightPicker ? 'bg-slate-200 ring-1 ring-slate-300' : ''
                }`}
              >
                <div className="flex flex-col items-center">
                  <Highlighter className="w-3.5 h-3.5 text-amber-600" />
                  <span
                    className="w-3.5 h-1 rounded-sm mt-0.5"
                    style={{
                      backgroundColor:
                        currentHighlight !== 'transparent' ? currentHighlight : '#cbd5e1',
                    }}
                  />
                </div>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Highlight Dropdown Popover */}
              {showHighlightPicker && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2.5 w-48 animate-fade-in">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Highlight Color
                  </div>
                  <div className="space-y-1">
                    {HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applyHighlightColor(c.value);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-slate-100 transition-colors text-slate-700"
                      >
                        <span
                          className="w-4 h-4 rounded border border-slate-300 shrink-0"
                          style={{
                            backgroundColor:
                              c.value === 'transparent' ? '#ffffff' : c.value,
                          }}
                        />
                        <span className="flex-1 text-left">{c.name}</span>
                        {currentHighlight.toLowerCase() === c.value.toLowerCase() && (
                          <Check className="w-3.5 h-3.5 text-teal-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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

      {/* Editable Content Area with Paste Handler */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onKeyUp={updateActiveFormats}
        onMouseUp={updateActiveFormats}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        className={`p-4 text-slate-800 text-sm leading-relaxed focus:outline-none overflow-y-auto ${minHeight} [&:empty:before]:content-[attr(data-placeholder)] [&:empty:before]:text-slate-400 [&:empty:before]:pointer-events-none prose-sm max-w-none [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-900 [&_h3]:mt-3 [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:text-slate-800 [&_h4]:mt-2 [&_h4]:mb-1 [&_h5]:text-xs [&_h5]:font-bold [&_h5]:text-slate-700 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1.5 [&_hr]:my-3 [&_hr]:border-slate-200 [&_b]:font-bold [&_strong]:font-bold [&_table]:border-collapse [&_table]:my-2 font-sans`}
      />
    </div>
  );
};

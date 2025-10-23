'use client';

import { useState, useEffect, useRef } from 'react';

import styles from './TextFormattingChecker.module.css';

interface Match {
  type: string;
  start: number;
  end: number;
  message: string;
}

interface Formatted_Checks {
  label: string;
  check: (text: string) => Array<Match>;
}

const isOpeningQuote = (text: string, quoteIndex: number): boolean => {
  // Validate inputs
  if (quoteIndex < 0 || quoteIndex >= text.length) {
    return false;
  }

  // Get text before and after the quote
  const beforeQuote = text.slice(0, quoteIndex);
  const afterQuote = text.slice(quoteIndex + 1);

  // Pattern 1: Check if preceded by word boundary and followed by non-whitespace
  // This catches cases like: word "text or start "text
  const openingPattern1 = /(\s|^|[^\w])$/.test(beforeQuote) && /^\S/.test(afterQuote);
  
  // Pattern 2: Check if followed by whitespace and preceded by non-word character
  // This catches cases like: text" or text".
  const closingPattern1 = /\S$/.test(beforeQuote) && /^(\s|$|[^\w])/.test(afterQuote);

  // Count quotes before this position to determine context
  const quotesBefore = (beforeQuote.match(/"/g) || []).length;
  
  // If we have an even number of quotes before, this should be opening
  // If we have an odd number of quotes before, this should be closing
  const evenQuotesBefore = quotesBefore % 2 === 0;

  // Advanced context analysis
  // Check for common opening contexts
  const beforeContext = beforeQuote.slice(-10); // Last 10 characters for context
  const afterContext = afterQuote.slice(0, 10);  // First 10 characters for context

  // Opening quote indicators: space/start before quote, letter/number after
  const likelyOpening = (
    /(\s|^|[({[]|:|;|,)$/.test(beforeContext) && 
    /^[a-zA-Z0-9]/.test(afterContext)
  );

  // Closing quote indicators: letter/number before quote, space/punctuation after
  const likelyClosing = (
    /[a-zA-Z0-9]$/.test(beforeContext) && 
    /^(\s|[.!?,:;)\]}]|$)/.test(afterContext)
  );

  // Combine heuristics with priority order:
  // 1. Strong contextual indicators
  // 2. Quote count parity
  // 3. Basic pattern matching

  if (likelyOpening && !likelyClosing) {
    return true;
  }
  
  if (likelyClosing && !likelyOpening) {
    return false;
  }

  // Fall back to quote count if context is ambiguous
  if (evenQuotesBefore) {
    return openingPattern1 || !closingPattern1;
  } else {
    return !closingPattern1 && !openingPattern1 ? false : openingPattern1;
  }
}

const getQuoteSuggestion = (index: number, text: string) => {
  const isOpening = isOpeningQuote(text, index);
  const suggestion = isOpening ? '“' : '”';
  return suggestion;
};

export default function FormattingChecker() {
  const [text, setText] = useState('');
  const [results, setResults] = useState<Array<Match>>([]);
  const [activeChecks, setActiveChecks] = useState({
    doubleSpaces: true,
    consecutiveNewlines: true,
    unclosedParentheses: true,
    irregularCapitalization: true,
    straightQuotes: true
  });
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightLayerRef = useRef<HTMLDivElement>(null);
  
  // Format check functions
  const formatChecks: Record<string, Formatted_Checks> = {
    doubleSpaces: {
      label: 'Double Spaces',
            check: (text: string): Array<Match> => {
        const regex = /[^\S\r\n]{2,}/g;
        const matches = [];
        let match;
        
        // Use exec() in a while loop for proper iteration
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            type: 'doubleSpaces',
            start: match.index,
            end: match.index + match[0].length,
            message: 'Double space detected'
          });
        }
        
        return matches;
      }
    },
    
    consecutiveNewlines: {
      label: 'Consecutive Newlines',
      check: (text: string): Array<Match> => {
        const regex = /\n{3,}/g;
        const matches = [];
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            type: 'consecutiveNewlines',
            start: match.index,
            end: match.index + match[0].length,
            message: 'Too many consecutive line breaks'
          });
        }
        
        return matches;
      }
    },
    
    unclosedParentheses: {
      label: 'Unclosed Parentheses',
      check: (text: string): Array<Match> => {
        const matches = [];
        const stack = [];
        
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '(') {
            stack.push(i);
          } else if (text[i] === ')') {
            if (stack.length > 0) {
              stack.pop();
            } else {
              matches.push({
                type: 'unclosedParentheses',
                start: i,
                end: i + 1,
                message: 'Extra closing parenthesis'
              });
            }
          }
        }
        
        // Any remaining open parentheses are unclosed
        stack.forEach(index => {
          matches.push({
            type: 'unclosedParentheses',
            start: index,
            end: index + 1,
            message: 'Unclosed parenthesis'
          });
        });
        
        return matches;
      }
    },
    
    irregularCapitalization: {
      label: 'Irregular Capitalization',
      check: (text: string): Array<Match> => {
        // Check for sentences not starting with capital letter
        const sentenceRegex = /(?<=^|[.!?]\s+)[a-z]/g;
        const matches = [];
        let match;
        
        while ((match = sentenceRegex.exec(text)) !== null) {
          matches.push({
            type: 'irregularCapitalization',
            start: match.index, // Account for punctuation and space
            end: match.index + 1,
            message: 'Sentence should start with capital letter'
          });
        }
        
        return matches;
      }
    },
    
    straightQuotes: {
      label: 'Straight Quotes',
      check: (text: string): Array<Match> => {
        // Find straight double quotes
        const regex = /"/g;
        const matches = [];
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          matches.push({
            type: 'straightQuotes',
            start: match.index,
            end: match.index + 1,
            message: 'Use curly quotes (" ") instead of straight quotes'
          });
        }
        
        return matches;
      }
    }
  };

  // Run checks when text changes
  useEffect(() => {
    if (!text) {
      setResults([]);
      return;
    }
    
    let allResults: Array<Match> = [];
    
    Object.entries(activeChecks).forEach(([checkName, isActive]) => {
      if (isActive && formatChecks[checkName]) {
        const checkResults = formatChecks[checkName].check(text);
        allResults = [...allResults, ...checkResults];
      }
    });

    setResults(allResults.sort((a, b) => a.start - b.start));
  }, [text, activeChecks]);

  // Toggle check activation
  const toggleCheck = (checkName: string) => {
    setActiveChecks((prev) => ({
      ...prev,
      [checkName]: !prev[checkName]
    }));
  };

  // Sync scroll between editor and highlight layer
  useEffect(() => {
    const editor = editorRef.current;
    const highlightLayer = highlightLayerRef.current;
    
    if (!editor || !highlightLayer) return;
    
    const handleScroll = () => {
      highlightLayer.scrollTop = editor.scrollTop;
      highlightLayer.scrollLeft = editor.scrollLeft;
    };
    
    editor.addEventListener('scroll', handleScroll);
    return () => editor.removeEventListener('scroll', handleScroll);
  }, []);

        // Fix formatting error
  const fixError = (result) => {
    let fixedText = text;
    
    switch(result.type) {
      case 'doubleSpaces':
        // Replace multiple spaces with a single space
        fixedText = text.substring(0, result.start) + ' ' + text.substring(result.end);
        break;
        
      case 'consecutiveNewlines':
        // Replace excessive newlines with just two
        fixedText = text.substring(0, result.start) + '\n\n' + text.substring(result.end);
        break;
        
      case 'unclosedParentheses':
        if (text[result.start] === '(') {
          // Add closing parenthesis
          fixedText = text.substring(0, result.start + 1) + ')' + text.substring(result.start + 1);
        } else if (text[result.start] === ')') {
          // Remove extra closing parenthesis
          fixedText = text.substring(0, result.start) + text.substring(result.end);
        }
        break;
        
      case 'irregularCapitalization':
        // Capitalize first letter of sentence
        fixedText = text.substring(0, result.start) + 
                   text.substring(result.start, result.end).toUpperCase() + 
                   text.substring(result.end);
        break;
        
      case 'straightQuotes':
        // Replace with appropriate curly quote
        const suggestion = getQuoteSuggestion(result.start, text);
        fixedText = text.substring(0, result.start) + suggestion + text.substring(result.end);
        break;
        
      default:
        return;
    }
    
    setText(fixedText);
  };
  
  // Create highlighted HTML
  useEffect(() => {
    const highlightLayer = highlightLayerRef.current;
    if (!highlightLayer) return;
    
    if (!text || results.length === 0) {
      highlightLayer.innerHTML = text.replace(/\n/g, '<br/>') || '&nbsp;';
      return;
    }
    
    // Sort results by start position
    const sortedResults = [...results].sort((a, b) => a.start - b.start);
    
    let lastIndex = 0;
    let html = '';
    
    sortedResults.forEach((result) => {
      // Add text before the error
      html += text.substring(lastIndex, result.start)
        // .replace(/\n/g, '<br/>')
        .replace(/\s/g, match => match === ' ' ? ' ' : match);
      
      // Add highlighted error
      let errorText = text.substring(result.start, result.end)
        .replace(/\n/g, `<span class="${styles.newLineErrorSpan}"></span><br/>`)
        .replace(/\s/g, match => match === ' ' ? ' ' : match);
      
      let tooltip = result.message;
      
      // Add suggestion for straight quotes
      if (result.type === 'straightQuotes') {
        const suggestion = getQuoteSuggestion(result.start, text);
        tooltip += ` (Suggested: ${suggestion})`;
      }
      
      html += `<span class="${styles.errorText}" title="${tooltip}">${errorText}</span>`;
      
      lastIndex = result.end;
    });

    // Add remaining text after last error
    html += text.substring(lastIndex)
      .replace(/\n/g, '<br/>')
      .replace(/\s/g, match => match === ' ' ? ' ' : match);
    

    // Add an extra space to ensure the layer has the right height
    if (html === '') {
      html = '&nbsp;';
    }
    
    highlightLayer.innerHTML = html;
  }, [text, results]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>
        <h1>Text Formatter</h1>
        <h4>This tool flags common errors with text formatting and allows you to correct them. Similar to other text editing tools but this doesn&apos;t use AI or sell your data 😊.</h4>
      </div>

      <div className={styles.activeChecksRow}>
        <label>Active Checks:</label>
        <div className={styles.activeChecksButtonRow}>
          {Object.entries(formatChecks).map(([checkName, { label }]) => (
            <button
              key={checkName}
              onClick={() => toggleCheck(checkName)}
              data-isActive={!!((activeChecks as any)[checkName])}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      
      <div className={styles.textFormattingContainer}>
        <div className={styles.textAreaCard}>
          <div>
            {/* Highlight layer (positioned behind but visible through transparent textarea) */}
            <div 
              ref={highlightLayerRef}
              className={styles.highlightLayer}
              aria-hidden="true"
            ></div>
            
            {/* Actual text input area (transparent background) */}
            <textarea
              ref={editorRef}
              id="input-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={styles.textArea}
              placeholder="Type or paste text here to check for formatting errors"
              style={{ caretColor: 'black' }}
            />
          </div>
        </div>
        
        <div className={styles.resultsPane}>
          <div className={styles.resultsTitle}>
            {results.length} {results.length === 1 ? 'issue' : 'issues'} found
          </div>
          
          <div className={styles.errorsContainer}>
            {results.length > 0 && (
              results.map((result, idx) => (
                <div key={idx} className={styles.errorCard} onClick={() => fixError(result)}>
                  <p className={styles.errorMessage}>{result.message}</p>
                  <p className={styles.errorPosition}>
                    Characters: {result.start}-{result.end}
                  </p>
                  <span className={styles.errorCTA}>Click to fix</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

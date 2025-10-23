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
  const [ranges, rangesSetter] = useState<Record<'doubleSpaces' | 'consecutiveNewlines' | 'unclosedParentheses' | 'irregularCapitalization' | 'straightQuotes', Array<Range>>>({
    doubleSpaces: [],
    consecutiveNewlines: [],
    unclosedParentheses: [],
    irregularCapitalization: [],
    straightQuotes: []
  });

  const [activeChecks, setActiveChecks] = useState({
    doubleSpaces: true,
    consecutiveNewlines: true,
    unclosedParentheses: true,
    irregularCapitalization: true,
    straightQuotes: true
  });
  const cssHighlightLayerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const resultsHighlight = new Highlight(...ranges.doubleSpaces.flat(), ...ranges.consecutiveNewlines.flat(), ...ranges.unclosedParentheses.flat(), ...ranges.irregularCapitalization.flat(), ...ranges.straightQuotes.flat());

    CSS.highlights.set('results', resultsHighlight);
  }, [ranges]);

  // Format check functions
  const formatChecks: Record<string, Formatted_Checks> = {
    doubleSpaces: {
      label: 'Double Spaces',
      check: (text: string): Array<Match> => {
        const regex = /[^\S\r\n]{2,}/g;
        const matches = [];
        let match;
        const newRanges: Array<Range> = [];
        
        // Use exec() in a while loop for proper iteration
        while ((match = regex.exec(text)) !== null) {
          if (cssHighlightLayerRef.current?.firstChild) {
            const newRange = new Range();
            newRange.setStart(cssHighlightLayerRef.current.firstChild, match.index);
            newRange.setEnd(cssHighlightLayerRef.current?.firstChild, match.index + match[0].length);
            newRanges.push(newRange);
          }

          matches.push({
            type: 'doubleSpaces',
            start: match.index,
            end: match.index + match[0].length,
            message: 'Double space detected'
          });
        }

        rangesSetter(prev => ({
          ...prev,
          doubleSpaces: newRanges
        }));

        return matches;
      }
    },
    
    unclosedParentheses: {
      label: 'Unclosed Parentheses',
      check: (text: string): Array<Match> => {
        const matches = [];
        const stack = [];
        const newRanges: Array<Range> = [];
        
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '(') {
            stack.push(i);
          } else if (text[i] === ')') {
            if (stack.length > 0) {
              stack.pop();
            } else {

              if (cssHighlightLayerRef.current?.firstChild) {
                const newRange = new Range();
                newRange.setStart(cssHighlightLayerRef.current.firstChild, i);
                newRange.setEnd(cssHighlightLayerRef.current?.firstChild, i + 1);
                newRanges.push(newRange);
              }

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

          if (cssHighlightLayerRef.current?.firstChild) {
            const newRange = new Range();
            newRange.setStart(cssHighlightLayerRef.current.firstChild, index);
            newRange.setEnd(cssHighlightLayerRef.current?.firstChild, index + 1);
            newRanges.push(newRange);
          }

          matches.push({
            type: 'unclosedParentheses',
            start: index,
            end: index + 1,
            message: 'Unclosed parenthesis'
          });
        });
        
        rangesSetter(prev => ({
          ...prev,
          unclosedParentheses: newRanges
        }));
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
        const newRanges: Array<Range> = [];
        
        while ((match = sentenceRegex.exec(text)) !== null) {

          if (cssHighlightLayerRef.current?.firstChild) {
            const newRange = new Range();
            newRange.setStart(cssHighlightLayerRef.current.firstChild, match.index);
            newRange.setEnd(cssHighlightLayerRef.current?.firstChild, match.index + 1);
            newRanges.push(newRange);
          }

          matches.push({
            type: 'irregularCapitalization',
            start: match.index, // Account for punctuation and space
            end: match.index + 1,
            message: 'Sentence should start with capital letter'
          });
        }
        
        rangesSetter(prev => ({
          ...prev,
          irregularCapitalization: newRanges
        }));
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
        const newRanges: Array<Range> = [];
        
        while ((match = regex.exec(text)) !== null) {

          if (cssHighlightLayerRef.current?.firstChild) {
            const newRange = new Range();
            newRange.setStart(cssHighlightLayerRef.current.firstChild, match.index);
            newRange.setEnd(cssHighlightLayerRef.current?.firstChild, match.index + 1);
            newRanges.push(newRange);
          }

          matches.push({
            type: 'straightQuotes',
            start: match.index,
            end: match.index + 1,
            message: 'Use curly quotes (" ") instead of straight quotes'
          });
        }
        
        rangesSetter(prev => ({
          ...prev,
          straightQuotes: newRanges
        }));
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
    
    if (cssHighlightLayerRef.current) {
      cssHighlightLayerRef.current.innerHTML = fixedText.replace(/\n/g, '<br/>') || '&nbsp;';
      setText(fixedText);
    }
  };
  
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
            <div
              className={styles.cssHighlightLayer}
              contentEditable="plaintext-only"
              ref={cssHighlightLayerRef}
              onInput={(e) => {
                setText(e?.target?.innerText || '');
              }}
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

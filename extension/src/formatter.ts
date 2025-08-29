// TypeScript version of the simple formatter utilities.

export type Part = { type: 'code' | 'string' | 'comment', text: string };

// Keywords used for uppercasing; stored in a Set for faster lookup.
const KEYWORDS_SET = new Set<string>([
  'END', 'IF', 'THEN', 'ELSE', 'ELSEIF', 'FOR', 'WHILE', 'CASE', 'WHEN', 'RETURN', 'CALL', 'LET', 'DISPLAY', 'PRINT', 'MESSAGE', 'CONTINUE', 'EXIT', 'FUNCTION', 'MAIN', 'RECORD', 'TYPE', 'DEFINE', 'GLOBAL', 'GLOBALS', 'LIKE', 'TO', 'FROM', 'WHERE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'NULL', 'TRUE', 'FALSE'
].map(s => s.toUpperCase()));

// Additional tokens that are commonly part of multi-word constructs but not
// present in the original keywords list. Treat these as keywords for the
// purposes of not splitting adjacent keyword-like tokens.
const EXTRA_KEYWORDS = new Set<string>([
  'CURSOR', 'ARRAY', 'WITH', 'HOLD', 'FIELD', 'BEFORE', 'DECLARE', 'OPEN', 'CLOSE'
]);

// module-level regexes reused by multiple passes
const typeLikeRe = /\b(LIKE\s+[A-Za-z0-9_\.]+|STRING|INTEGER|SMALLINT|BIGINT|DATE|DATETIME|CHAR|VARCHAR\([^)]*\)|DECIMAL\([^)]*\)|FLOAT|REAL|MONEY|BOOLEAN|BYTE|TEXT)\b/i;
const stmtStartRe = /^(LET|CALL|RETURN|DISPLAY|PRINT|MESSAGE|IF|ELSE|FOR|WHILE|CASE|WHEN|OPEN|CLOSE|SELECT|INSERT|UPDATE|DELETE|INITIALIZE|INPUT|MENU|PROMPT|SLEEP|ERROR|WARN|INFO|CONTINUE|EXIT|FUNCTION|MAIN|END|OUTPUT)\b/i;

// Helper: normalize a candidate line by stripping leading DEFINE tokens and trimming
export function normalizeCandidate(s: string): string {
  if (!s) return '';
  return s.replace(/^\s*(DEFINE\s+)*/i, '').trim();
}

// Centralized predicate: determine whether a trimmed line likely represents
// a variable continuation that should be converted into a `DEFINE` entry.
export function isVariableContinuation(trimmedLine: string): boolean {
  if (!trimmedLine || !trimmedLine.trim()) return false;
  const t = normalizeCandidate(trimmedLine);
  const m = t.match(/^([A-Za-z0-9_]+)(\s+.*)?$/s);
  if (!m) return false;
  const name = m[1];
  const tail = m[2] ? m[2].trim() : '';
  if (stmtStartRe.test(name)) return false;
  if (typeLikeRe.test(t)) return true;
  return tail.length > 0;
}

// Tokenize the input while preserving strings and comments as separate parts.
export function tokenizePreserve(text: string): Part[] {
  const out: Part[] = [];
  let i = 0;
  const n = text.length;

  const peek = (offset = 0) => text[i + offset];
  const startsWith = (s: string) => text.startsWith(s, i);

  while (i < n) {
    const ch = peek();

    // block comment style { ... }
    if (ch === '{') {
      const start = i;
      i++;
      while (i < n && peek() !== '}') i++;
      if (i < n) i++;
      out.push({ type: 'comment', text: text.slice(start, i) });
      continue;
    }

    // single line comments: -- or #
    if (startsWith('--') || ch === '#') {
      const start = i;
      while (i < n && peek() !== '\n') i++;
      out.push({ type: 'comment', text: text.slice(start, i) });
      continue;
    }

    // quoted strings: '...' or "..." with simple backslash escape handling
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++; // skip opening quote
      while (i < n) {
        if (peek() === '\\') { i += 2; continue; }
        if (peek() === quote) { i++; break; }
        i++;
      }
      out.push({ type: 'string', text: text.slice(start, i) });
      continue;
    }

    // otherwise gather a code fragment until next special token
    const start = i;
    while (i < n && peek() !== '{' && peek() !== '"' && peek() !== "'" && !startsWith('--') && peek() !== '#') i++;
    if (i > start) out.push({ type: 'code', text: text.slice(start, i) });
  }

  return out;
}

export function uppercaseKeywordsInCode(code: string): string {
  // Replace word-like tokens, uppercasing only known keywords.
  return code.replace(/\b[A-Za-z0-9_]+\b/g, (tok) => {
    const up = tok.toUpperCase();
    return KEYWORDS_SET.has(up) ? up : tok;
  });
}

export function splitDefineLines(text: string): string {
  // Deprecated: kept for API compatibility. Previously split DEFINE lines,
  // now a no-op to avoid surprising transformations.
  if (process.env.FGL_FMT_DEBUG) console.log('splitDefineLines: removed (no-op)');
  return text;
}

// Helper predicates to centralize block/sibling/continuation detection.
// helpers moved to separate module for clarity
import { isIncreaseAfterLine, isSiblingIncreaseLine, isDecreaseBeforeLine, isContinuationEndLine, computeBaseLevelFromLines, isKeywordPairKeepTogether } from './indentHelpers';

function wrapLongLines(text: string, maxLen?: number): string {
  if (!maxLen || maxLen <= 0) return text;
  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.length <= maxLen) { out.push(line); continue; }
    const trimmed = line.trimStart();
    // don't touch comment lines or lines containing strings or block comments
    if (trimmed.startsWith('#') || trimmed.startsWith('--') || line.indexOf('"') !== -1 || line.indexOf("'") !== -1 || line.indexOf('{') !== -1) { out.push(line); continue; }
    let remaining = line;
    const indentMatch = line.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    while (remaining.length > maxLen) {
      const slice = remaining.slice(0, maxLen);
      const lastSpace = slice.lastIndexOf(' ');
      if (lastSpace <= indent.length) break;
      const head = remaining.slice(0, lastSpace);
      out.push(head);
      remaining = indent + '  ' + remaining.slice(lastSpace + 1);
    }
    out.push(remaining);
  }
  return out.join('\n');
}

// Apply semantic indentation to code-only fragments. This walks code lines
// and adjusts leading indentation based on simple block keywords (FUNCTION,
// MAIN, IF, FOR, WHILE, CASE, RECORD, TYPE) and closing keywords (END,
// ELSE, ELSEIF). The algorithm is intentionally conservative to avoid
// reformatting comment/string-containing lines.
function formatCodeWithIndent(code: string, indent: { useTabs?: boolean; size?: number }, keywordsUppercase: boolean): string {
  const size = typeof indent.size === 'number' && indent.size >= 0 ? indent.size : 3;
  const useTabs = !!indent.useTabs;
  const lines = code.split(/\r?\n/);
  let level = 0;
  // compute base indent level from the first non-empty line so we preserve
  // existing file-relative indentation (tabs or spaces) as a starting point
  let baseLevel = 0;
  for (const ln of lines) {
    if (!ln || /^\s*$/.test(ln)) continue;
    const m = ln.match(/^(\s*)/);
    const leading = m ? m[1] : '';
    const tabCount = (leading.match(/\t/g) || []).length;
    const spaceCount = (leading.match(/ /g) || []).length;
    baseLevel = computeBaseLevelFromLines(lines, size);
    break;
  }
  const outLines: string[] = [];

  // Align with user's indentationRules: increase for FUNCTION (with optional PUBLIC/PRIVATE), MAIN,
  // control statements, FOREACH, DISPLAY ARRAY, INPUT, RECORD, INTERFACE, etc.
  // Expanded: include CONSTRUCT, SELECT, LOOP and multi-word tokens will be
  // matched by the line-level tests below. We intentionally include ON/AFTER/
  // BEFORE/WHEN as both increase-after and decrease-before so siblings don't
  // accumulate nesting when multiple ON/AFTER blocks appear.
  // Use helper predicates

  for (let rawLine of lines) {
    // Preserve completely empty lines
    if (!rawLine || /^\s*$/.test(rawLine)) { outLines.push(rawLine); continue; }

    const trimmed = rawLine.trim();

    // Don't touch lines that are comments (start with -- or #) — preserve exactly.
    if (trimmed.startsWith('--') || trimmed.startsWith('#')) {
      outLines.push(rawLine);
      continue;
    }

    // don't touch lines that contain string or block comment markers to avoid
    // corrupting their internal spacing; for these, keep leading whitespace but
    // still optionally uppercase keywords in the trimmed body
    if (trimmed.indexOf('"') !== -1 || trimmed.indexOf("'") !== -1 || trimmed.indexOf('{') !== -1) {
      const body = keywordsUppercase ? uppercaseKeywordsInCode(trimmed) : trimmed;
      outLines.push(getIndent(baseLevel + level, size, useTabs) + body);
      continue;
    }

    // If this rawLine is a closing (END) decrease first. Only END triggers
    // a dedent per project rules: other sibling tokens (ELSE, ON, WHEN, etc.)
    // must not force a decrease.
    if (/^\s*END\b/i.test(rawLine)) {
      level = Math.max(0, level - 1);
    }

    // If previous emitted line ended with a continuation marker, indent this
    // line slightly more so continuation strings align and are readable.
    const prev = outLines.length ? outLines[outLines.length - 1] : null;
    let emitIndentLevel = baseLevel + level;
    if (prev && isContinuationEndLine(prev)) {
      emitIndentLevel += 1;
    }
    // Also, if this trimmed line itself begins with concatenation (||),
    // treat it as a continuation and indent it.
    if (/^\|\|/.test(trimmed)) {
      emitIndentLevel += 1;
    }

    const body = keywordsUppercase ? uppercaseKeywordsInCode(trimmed) : trimmed;
    outLines.push(getIndent(emitIndentLevel, size, useTabs) + body);

    // Increase after lines that open blocks. Use a local pattern that matches
    // the project's increaseIndentPattern (FUNCTION, MAIN, IF/WHILE/FOR/FOREACH/
    // DISPLAY ARRAY/INPUT, RECORD, INTERFACE, etc.) but explicitly exclude
    // SELECT so it won't be treated as a block opener.
    const localIncreaseRe = /^(?:(?:(?:PUBLIC|PRIVATE)\s)?FUNCTION|MAIN|\s*(?:IF|WHILE|FOR|FOREACH|DISPLAY ARRAY|INPUT)|(?:RECORD|INTERFACE)|CONSTRUCT|LOOP)\b/i;
    const localSiblingIncreaseRe = /^(?:ON\b|AFTER\b|BEFORE\b|WHEN\b)/i;
    if (localIncreaseRe.test(trimmed)) {
      level++;
    }
    if (localSiblingIncreaseRe.test(trimmed)) {
      level++;
    }
  }

  return outLines.join('\n');
}

function getIndent(level: number, size: number, useTabs: boolean) {
  if (useTabs) return '\t'.repeat(level);
  return ' '.repeat(level * size);
}

function getIndentSpaces(level: number, size: number, useTabs: boolean) {
  if (useTabs) return level; // caller expects spaces count but will be converted to tabs elsewhere; keep conservative
  return level * size;
}

export function formatText(text: string, options?: { commentsStyle?: string; replaceInline?: boolean; keywordsUppercase?: boolean; lineLengthMax?: number; }): string {
  options = options || {};
  // allow an 'indent' option: { useTabs?: boolean, size?: number }
  const indentOpt = (options as any).indent || { useTabs: false, size: 3 };
  const commentsStyle = options.commentsStyle || 'preserve';
  const replaceInline = !!options.replaceInline;
  const keywordsUppercase = options.keywordsUppercase !== false;

  const parts = tokenizePreserve(text);
  let out = '';
  let prevPart: Part | null = null;

  for (let idx = 0; idx < parts.length; idx++) {
    const p = parts[idx];
    const next = idx + 1 < parts.length ? parts[idx + 1] : null;
    if (p.type === 'code') {
      // Conservative statement-splitting pass: break lines that contain
      // multiple statements into separate lines before semantic indentation.
      // This operates on 'code' parts only (strings/comments are separate
      // parts from the tokenizer), so it's safe to split by keywords.
      // Preserve leading newlines so we don't accidentally glue code to
      // previous output.
      let codeFragment = p.text; // keep any leading newlines
      // If an ELSE or ELSEIF has trailing statements on the same line, split
      // them so the trailing statement is processed on the next line and gets
      // proper indentation.
      codeFragment = codeFragment.replace(/(^\s*(ELSE|ELSEIF)\b)\s+([^\n]+)/igm, '$1\n$3');
      // Aggressive normalization: ensure common statement keywords followed
      // by a string/next token have a single space. This converts
      // DISPLAY"..." into DISPLAY "..." and ensures trailing keywords
      // at line ends keep a space to allow proper concatenation with string
      // parts.
      codeFragment = codeFragment.replace(/\b(DISPLAY|PRINT|MESSAGE|LET|CALL|RETURN)\s*(?=("|'|$))/ig, '$1 ');
      // Also ensure trailing standalone keywords preserve a space
      codeFragment = codeFragment.replace(/(\b(DISPLAY|PRINT|MESSAGE|LET|CALL|RETURN))$/ig, '$1 ');
      // Normalize concatenation so that '||' moves to the start of continuation
      // lines. This makes subsequent lines visually aligned with the operator.
      codeFragment = codeFragment.replace(/\s*\|\|\s*\n\s*/g, '\n|| ');
      // Expand single-line IF ... THEN ... END IF into multi-line form while
      // preserving the original leading indentation so baseLevel detection
      // remains accurate. Example:
      //   "IF x = 1 THEN EXIT PROGRAM END IF" ->
      // IF x = 1 THEN
      //    EXIT PROGRAM
      // END IF
      codeFragment = codeFragment.replace(/(^|\n)(\s*)IF\s+([^\n]+?)\s+THEN\s+([^\n]+?)\s+END\s+IF\b/ig, '$1$2IF $3 THEN\n$4\n$2END IF');
      // If current output doesn't end with a newline and this fragment begins
      // with a block-keyword (END/ELSE/IF/...), insert a newline so the block
      // keyword doesn't get glued to previous inline content (comments/code).
      // NOTE: do NOT force a newline solely because of 'END' — indent decrease
      // should be applied when END appears as its own logical line, not by
      // inserting newlines automatically.
      // Keywords that commonly start statements and should be placed on their
      // own line if they appear after other code on the same line.
      const splitKeys = [
        'ELSE', 'ELSEIF', 'DISPLAY', 'LET', 'RETURN', 'CALL', 'FOR', 'WHILE', 'CASE', 'WHEN', 'OUTPUT', 'IF', 'FUNCTION', 'MAIN', 'INPUT', 'OPEN', 'CLOSE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
      ];
      const keyPattern = splitKeys.join('|');
      // Only match spaces/tabs between tokens so we don't join tokens across
      // different lines (\s includes newlines). This prevents combining
      // keywords that appear on separate lines.
      const splitRe = new RegExp('\\b(\\w+)[ \t]+(?=(' + keyPattern + ')\\b)', 'ig');
      codeFragment = codeFragment.replace(splitRe, (m: string, leftWord: string, nextKey: string) => {
        const leftUp = leftWord ? leftWord.toUpperCase() : '';
        const nextUp = nextKey ? nextKey.toUpperCase() : '';
        // Do not split constructs like "CONTINUE WHILE" or "EXIT FOREACH/FOR"
        if ((leftUp === 'CONTINUE' || leftUp === 'EXIT') && (nextUp === 'WHILE' || nextUp === 'FOREACH' || nextUp === 'FOR')) {
          return leftWord + ' ';
        }
        // Use central helper to decide whether this pair should remain together
        if (isKeywordPairKeepTogether(leftUp, nextUp)) {
          return leftWord + ' ';
        }
        if (leftUp === 'END') return leftWord + ' ';
        return leftWord + '\n';
      });
      const formattedCode = formatCodeWithIndent(codeFragment, indentOpt, keywordsUppercase);
      // If previous output doesn't end with newline, and the formatted code
      // does not start with one, insert a newline to separate blocks.
      if (!/\n$/.test(out) && formattedCode && !/^\s*\n?/.test(formattedCode)) {
        out += '\n';
      }
      out += formattedCode;
      prevPart = p;
      continue;
    }
    if (p.type === 'string') {
      // Decide how to attach the string: if the last emitted line is ELSE,
      // put the string on a new inner-indented line. If last emitted token is
      // a statement keyword like DISPLAY/PRINT/etc., ensure there's a single
      // space before the string.
      const linesSoFar = out.split(/\r?\n/);
      const lastLine = linesSoFar.length ? linesSoFar[linesSoFar.length - 1] : '';
      const lastTrim = lastLine.trim();
      if (/^(ELSE|ELSEIF)\b/i.test(lastTrim)) {
        const m = lastLine.match(/^(\s*)/);
        const leading = m ? m[1] : '';
        const tabCount = (leading.match(/\t/g) || []).length;
        const spaceCount = (leading.match(/ /g) || []).length;
        const indentSize = (indentOpt && typeof (indentOpt as any).size === 'number') ? (indentOpt as any).size : 3;
        const baseSpaces = spaceCount + tabCount * indentSize;
        const innerIndent = (indentOpt && (indentOpt as any).useTabs) ? '\t' : ' '.repeat(baseSpaces + indentSize);
        if (!/\n$/.test(out)) out += '\n';
        out += innerIndent + p.text.replace(/^\s+/, '');
      } else if (/^(DISPLAY|PRINT|MESSAGE|LET|CALL|RETURN)\b/i.test(lastTrim)) {
        // Ensure a space between the keyword and the string
        if (!/\s$/.test(out)) out += ' ';
        out += p.text.replace(/^\s+/, '');
      } else {
        out += p.text;
      }
      prevPart = p;
      // if the next code part begins with END (closing), ensure it's on a new line
      if (next && next.type === 'code' && /^\s*END\b/i.test(next.text)) {
        if (!/\n$/.test(out)) out += '\n';
      }
      continue;
    }
    // comment part
    if (p.text.startsWith('{')) { out += p.text; prevPart = p; continue; }

    const marker = commentsStyle === 'dash' ? '--' : (commentsStyle === 'hash' ? '#' : null);
    const outEndsWithNewline = out.length === 0 || /\n$/.test(out);
    let isLeading = outEndsWithNewline;
    if (!isLeading && prevPart && prevPart.type === 'code' && /^\s*$/.test(prevPart.text)) isLeading = true;
    if (!isLeading && !replaceInline && commentsStyle !== 'preserve') { out += p.text; prevPart = p; continue; }

    if (marker) {
      const rest = p.text.replace(/^(#|--)+\s*/, '');
      out += marker + (rest.length ? ' ' + rest : '');
    } else {
      out += p.text;
    }
    prevPart = p;
  }

  // Final minimal normalization
  out = out.replace(/,\s*(?:\r?\n\s*)*(#|--)/g, ', $1');
  if (options.lineLengthMax && typeof options.lineLengthMax === 'number') {
    out = wrapLongLines(out, options.lineLengthMax);
  }
  // Overwrite leading whitespace of each line according to semantic block rules
  function overwriteLeadingWhitespace(allText: string, indent: { useTabs?: boolean; size?: number }) {
    const size = typeof indent.size === 'number' && indent.size >= 0 ? indent.size : 3;
    const useTabs = !!indent.useTabs;
    const lines = allText.split(/\r?\n/);
    let level = 0;
    // Follow project rule: only END triggers a dedent. Do NOT treat SELECT
    // as a block opener. Sibling tokens (ON/AFTER/BEFORE/WHEN) remain
    // sibling-incrementers but do not cause an automatic dedent.
    const increaseAfterRe = /^(?:((?:PUBLIC|PRIVATE)\s)?FUNCTION|MAIN|IF|FOR|WHILE|FOREACH|RECORD|INTERFACE|CONSTRUCT|LOOP)\b/i;
    const siblingIncreaseRe = /^(?:ON\b|AFTER\b|BEFORE\b|WHEN\b)/i;
    const decreaseBeforeRe = /^\s*(END\b)/i;
    const continuationEndRe = /(?:\|\|\s*$|,\s*$|\+\s*$)/;
    const continuationStartRe = /^\|\|/;
    const outLines: string[] = [];
    // compute base indent level from the first non-empty line so we
    // preserve file-relative indentation (tabs/spaces -> baseLevel)
    let baseLevel = 0;
    for (const ln of lines) {
      if (!ln || /^\s*$/.test(ln)) continue;
      const m = ln.match(/^(\s*)/);
      const leading = m ? m[1] : '';
      const tabCount = (leading.match(/\t/g) || []).length;
      const spaceCount = (leading.match(/ /g) || []).length;
      baseLevel = computeBaseLevelFromLines(lines, size);
      break;
    }

    for (let raw of lines) {
      if (!raw || /^\s*$/.test(raw)) { outLines.push(''); continue; }
      const trimmed = raw.trim();
      // closing END: decrease before emitting. Per rule, ELSE/ELSEIF do not
      // cause an automatic dedent here.
      if (/^END\b/i.test(trimmed)) {
        level = Math.max(0, level - 1);
        outLines.push((useTabs ? '\t'.repeat(baseLevel + level) : ' '.repeat((baseLevel + level) * size)) + trimmed);
        continue;
      }

      // if the line begins a sibling/block that should reduce previous nesting,
      // apply decrease-before semantics (now only END matches decreaseBeforeRe)
      if (decreaseBeforeRe.test(trimmed)) {
        level = Math.max(0, level - 1);
      }

      // calculate indent level, taking continuation of previous emitted line into account
      const prev = outLines.length ? outLines[outLines.length - 1] : null;
      let emitLevel = level;
      if (prev && continuationEndRe.test(prev)) {
        emitLevel = Math.max(0, emitLevel + 1);
      }
      if (continuationStartRe.test(trimmed)) {
        emitLevel = Math.max(0, emitLevel + 1);
      }

      outLines.push((useTabs ? '\t'.repeat(baseLevel + emitLevel) : ' '.repeat((baseLevel + emitLevel) * size)) + trimmed);

      // increase after opening keywords
      if (increaseAfterRe.test(trimmed)) {
        level++;
      }
      if (siblingIncreaseRe.test(trimmed)) {
        level++;
      }
    }
    return outLines.join('\n');
  }
  out = overwriteLeadingWhitespace(out, indentOpt);
  // normalize per-line indentation according to indent option
  function normalizeIndentation(allText: string, indent: { useTabs?: boolean; size?: number }): string {
    if (!indent) return allText;
    const useTabs = !!indent.useTabs;
    const size = typeof indent.size === 'number' && indent.size >= 0 ? indent.size : 3;
    if (useTabs) {
      // convert leading spaces (multiples of size) to tabs
      return allText.split(/\r?\n/).map(line => {
        const m = line.match(/^(\s*)/);
        const leading = m ? m[1] : '';
        // count tabs and spaces separately
        const spaceCount = (leading.match(/ /g) || []).length;
        const tabCount = (leading.match(/\t/g) || []).length;
        const totalTabs = tabCount + Math.floor(spaceCount / size);
        return '\t'.repeat(totalTabs) + line.slice(leading.length);
      }).join('\n');
    } else {
      // convert leading tabs to spaces, and preserve existing spaces
      return allText.split(/\r?\n/).map(line => {
        const m = line.match(/^(\s*)/);
        const leading = m ? m[1] : '';
        const tabCount = (leading.match(/\t/g) || []).length;
        const spaceCount = (leading.match(/ /g) || []).length;
        const totalSpaces = spaceCount + tabCount * size;
        return ' '.repeat(totalSpaces) + line.slice(leading.length);
      }).join('\n');
    }
  }
  if (process.env.FGL_FMT_DEBUG) console.log('formatText: splitDefineLines invocation removed (disabled)');
  // apply indentation normalization last so wrapping doesn't get confused by tabs/spaces differences
  out = normalizeIndentation(out, indentOpt);
  return out;
}

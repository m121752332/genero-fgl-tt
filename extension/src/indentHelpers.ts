import * as fs from 'fs';
import * as path from 'path';

export function isIncreaseAfterLine(trimmed: string): boolean {
  if (!trimmed) return false;
  return /^(?:((?:PUBLIC|PRIVATE)\s)?FUNCTION|MAIN|IF|WHILE|FOR|FOREACH|DISPLAY ARRAY|INPUT|RECORD|INTERFACE|CONSTRUCT|SELECT|LOOP)\b/i.test(trimmed);
}

export function isSiblingIncreaseLine(trimmed: string): boolean {
  if (!trimmed) return false;
  return /^(?:ON\b|AFTER\b|BEFORE\b|WHEN\b)/i.test(trimmed);
}

export function isDecreaseBeforeLine(rawOrTrimmed: string): boolean {
  if (!rawOrTrimmed) return false;
  return /^\s*(END\b|ELSE\b|ELSEIF\b|ON\b|AFTER\b|BEFORE\b|WHEN\b)/i.test(rawOrTrimmed);
}

export function isContinuationEndLine(line: string): boolean {
  if (!line) return false;
  return /(?:\|\|\s*$|,\s*$|\+\s*$)/.test(line);
}

// Default keyword list used if tmLanguage can't be read
const KEYWORD_LIST = [
  'END','IF','THEN','ELSE','ELSEIF','FOR','WHILE','CASE','WHEN','RETURN','CALL','LET','DISPLAY','PRINT','MESSAGE','CONTINUE','EXIT','FUNCTION','MAIN','RECORD','TYPE','DEFINE','GLOBAL','GLOBALS','LIKE','TO','FROM','WHERE','SELECT','INSERT','UPDATE','DELETE','NULL','TRUE','FALSE',
  'CURSOR','ARRAY','WITH','HOLD','FIELD','BEFORE','DECLARE','OPEN','CLOSE','INPUT','FOREACH'
];

function extractMatchesFromObject(obj: any, out: string[]) {
  if (!obj || typeof obj !== 'object') return;
  if (typeof obj.name === 'string' && obj.name.indexOf('keyword.control.4gl') !== -1 && typeof obj.match === 'string') {
    out.push(obj.match);
  }
  if (Array.isArray(obj.patterns)) {
    for (const p of obj.patterns) extractMatchesFromObject(p, out);
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v)) {
      for (const item of v) extractMatchesFromObject(item, out);
    } else if (v && typeof v === 'object') {
      extractMatchesFromObject(v, out);
    }
  }
}

function loadKeywordsFromTm(): Set<string> {
  const defaults = KEYWORD_LIST.map(s => s.toUpperCase());
  try {
    const p = path.join(__dirname, '..', 'syntaxes', '4gl.tmLanguage.json');
    if (!fs.existsSync(p)) return new Set(defaults);
    const raw = fs.readFileSync(p, 'utf8');
    const json = JSON.parse(raw);
    const foundMatches: string[] = [];
    if (json.repository) extractMatchesFromObject(json.repository, foundMatches);
    if (Array.isArray(json.patterns)) extractMatchesFromObject({ patterns: json.patterns }, foundMatches);

    const keywords = new Set<string>(defaults);
    for (const m of foundMatches) {
      const words = m.match(/[A-Za-z_][A-Za-z0-9_]*/g);
      if (!words) continue;
      for (const w of words) keywords.add(w.toUpperCase());
    }
    return keywords;
  } catch (err) {
    return new Set(defaults);
  }
}

const DYNAMIC_KEYWORD_SET = loadKeywordsFromTm();

export function isKeywordPairKeepTogether(left: string, right: string): boolean {
  if (!left || !right) return false;
  const L = left.toUpperCase();
  const R = right.toUpperCase();
  return DYNAMIC_KEYWORD_SET.has(L) && DYNAMIC_KEYWORD_SET.has(R);
}

export function computeBaseLevelFromLines(lines: string[], size: number): number {
  for (const ln of lines) {
    if (!ln || /^\s*$/.test(ln)) continue;
    const m = ln.match(/^(\s*)/);
    const leading = m ? m[1] : '';
    const tabCount = (leading.match(/\t/g) || []).length;
    const spaceCount = (leading.match(/ /g) || []).length;
    return tabCount + Math.floor(spaceCount / (size || 3));
  }
  return 0;
}

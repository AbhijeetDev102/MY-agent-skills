#!/usr/bin/env node
/**
 * validate-skills.js
 *
 * Validates skills in skills/, eval cases in evals/cases/, and command parity
 * in commands/ against the Agent Skills specification and addyosmani/agent-skills
 * quality standards.
 *
 * Exit codes: 0 = passed (or passed with warnings), 1 = one or more errors.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const MAX_DESCRIPTION_LENGTH = 1024;
const MAX_SKILL_LINES        = 500;
const KEBAB_CASE             = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SPEC_FRONTMATTER_KEYS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);

const DESCRIPTION_TRIGGER            = /\buse (this )?when\b|\buse (before|after|during)\b/i;
const DESCRIPTION_TRIGGER_NEGATE_ALL = /\b(do not|don't|never) use (this )?(when|before|after|during)\b/gi;

const REQUIRED_SECTIONS = [
  '## Overview',
  '## When to Use',
  '## Common Rationalizations',
  '## Red Flags',
  '## Verification',
];

const SKILL_REF_PATTERNS = [
  /\buse the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\bfollow the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\binvoke the `([a-z][a-z0-9-]+[a-z0-9])` skill/gi,
  /\bcontinue with `([a-z][a-z0-9-]+[a-z0-9])`/gi,
];

function normalizeLineEndings(text) {
  return String(text).replace(/\r\n?/g, '\n');
}

function stripFencedCodeBlocks(content) {
  const lines = normalizeLineEndings(content).split('\n');
  const out = [];
  let fence = null;

  for (const line of lines) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (!fence) {
      if (match) {
        fence = { char: match[1][0], len: match[1].length };
        continue;
      }
      out.push(line);
    } else {
      const closeMatch = line.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (closeMatch && closeMatch[1][0] === fence.char && closeMatch[1].length >= fence.len) {
        fence = null;
      }
    }
  }

  return out.join('\n');
}

function unquoteYamlScalar(raw) {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(content) {
  const normalized = normalizeLineEndings(content);
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return null;

  const lines = match[1].split('\n');
  const data = {};
  const topLevelKeys = [];
  const duplicateKeys = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;

    // Ignore indented lines (handled by parent key or nested mapping like metadata)
    if (/^[ \t]/.test(line)) continue;

    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:(.*)$/);
    if (!kv) {
      return { parseError: `Malformed frontmatter line: ${line.trim()}` };
    }

    const key = kv[1];
    const rest = kv[2].trim();
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      duplicateKeys.push(key);
    }
    topLevelKeys.push(key);

    if (/^[>|][+-]?$/.test(rest)) {
      const style = rest[0];
      const chomp = rest.slice(1);
      const blockLines = [];
      let baseIndent = null;

      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.trim()) {
          blockLines.push('');
          i++;
          continue;
        }
        const indentMatch = next.match(/^([ \t]+)(.*)$/);
        if (!indentMatch) break;
        if (baseIndent === null) baseIndent = indentMatch[1].length;
        blockLines.push(next.slice(Math.min(baseIndent, indentMatch[1].length)));
        i++;
      }

      while (blockLines.length > 0 && blockLines[blockLines.length - 1] === '') {
        if (chomp === '-') {
          blockLines.pop();
        } else {
          break;
        }
      }

      let value;
      if (style === '>') {
        value = blockLines
          .map(l => l.trim())
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        value = blockLines.join('\n').trimEnd();
      }
      data[key] = value;
    } else if (rest === '') {
      // Nested mapping (e.g., metadata:) or intentionally empty value
      const nested = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        if (!next.trim() || /^[ \t]/.test(next)) {
          if (next.trim()) nested.push(next.trim());
          i++;
        } else {
          break;
        }
      }
      data[key] = nested.length > 0 ? nested.join('\n') : '';
    } else {
      data[key] = unquoteYamlScalar(rest);
    }
  }

  return { data, topLevelKeys, duplicateKeys };
}

function extractSkillReferences(content) {
  const cleaned = stripFencedCodeBlocks(content);
  const refs = new Set();
  for (const pattern of SKILL_REF_PATTERNS) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(cleaned)) !== null) {
      refs.add(m[1]);
    }
  }
  return [...refs];
}

function lintSkillContent(dirName, content, knownSkills = new Set([dirName])) {
  const errors = [];
  const warnings = [];
  const normalized = normalizeLineEndings(content);

  if (!KEBAB_CASE.test(dirName)) {
    errors.push(`Skill directory name '${dirName}' must be lowercase-hyphen-separated (kebab-case)`);
  }

  const fm = parseFrontmatter(normalized);
  if (!fm) {
    errors.push('Missing or malformed YAML frontmatter (expected --- block at top of SKILL.md)');
    return { errors, warnings };
  }
  if (fm.parseError) {
    errors.push(fm.parseError);
    return { errors, warnings };
  }

  for (const key of fm.duplicateKeys) {
    errors.push(`Duplicate frontmatter key: '${key}'`);
  }
  for (const key of fm.topLevelKeys) {
    if (!SPEC_FRONTMATTER_KEYS.has(key)) {
      errors.push(`Unsupported top-level frontmatter key '${key}' (allowed: ${[...SPEC_FRONTMATTER_KEYS].join(', ')})`);
    }
  }

  const name = typeof fm.data.name === 'string' ? fm.data.name.trim() : '';
  const description = typeof fm.data.description === 'string' ? fm.data.description.trim() : '';

  if (!name) {
    errors.push("Frontmatter missing required non-empty field: 'name'");
  } else if (name !== dirName) {
    errors.push(`Frontmatter name '${name}' does not match directory name '${dirName}'`);
  }

  if (!description) {
    errors.push("Frontmatter missing required non-empty field: 'description'");
  } else {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description length (${description.length}) exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    const stripped = description.replace(DESCRIPTION_TRIGGER_NEGATE_ALL, ' ');
    if (!DESCRIPTION_TRIGGER.test(stripped)) {
      errors.push("Description must include a positive trigger condition (e.g. 'Use when ...')");
    }
  }

  const strippedBody = stripFencedCodeBlocks(normalized);
  const h2Headings = new Set(
    [...strippedBody.matchAll(/^## +(.+?)\s*$/gm)].map(m => `## ${m[1].trim()}`),
  );

  for (const req of REQUIRED_SECTIONS) {
    if (!h2Headings.has(req)) {
      errors.push(`Missing required section: '${req}'`);
    }
  }

  const lineCount = normalized.split('\n').length;
  if (lineCount > MAX_SKILL_LINES) {
    warnings.push(`SKILL.md has ${lineCount} lines (recommended budget <= ${MAX_SKILL_LINES} lines)`);
  }

  for (const ref of extractSkillReferences(normalized)) {
    if (!knownSkills.has(ref)) {
      warnings.push(`Cross-skill reference to unknown skill '${ref}'`);
    }
  }

  return { errors, warnings };
}

function lintSkillLayout(skillDir) {
  const errors = [];

  function walk(dir, relBase) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
      const abs = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const children = fs.readdirSync(abs);
        if (children.length === 0) {
          errors.push(`Empty subdirectory '${rel}/' — remove empty directories`);
        } else {
          walk(abs, rel);
        }
        continue;
      }

      if (rel === 'SKILL.md' || !entry.name.endsWith('.md')) continue;
      const stem = entry.name.slice(0, -'.md'.length);
      if (!KEBAB_CASE.test(stem)) {
        errors.push(`Supporting markdown file '${rel}' must have a lowercase-hyphen-separated filename`);
      }
    }
  }

  walk(skillDir, '');
  return errors;
}

function lintEvalCaseContent(dirName, rawJson) {
  const errors = [];
  let parsed;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return [`Invalid JSON in evals/cases/${dirName}.json: ${err.message}`];
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return [`evals/cases/${dirName}.json must be a JSON object`];
  }

  if (parsed.skill_name !== dirName) {
    errors.push(`evals/cases/${dirName}.json 'skill_name' (${parsed.skill_name}) must match '${dirName}'`);
  }

  const pos = parsed.trigger && parsed.trigger.positive;
  if (!Array.isArray(pos) || pos.length < 3) {
    errors.push(`evals/cases/${dirName}.json must define at least 3 trigger.positive entries`);
  } else {
    pos.forEach((item, idx) => {
      if (!item || typeof item.prompt !== 'string' || !item.prompt.trim()) {
        errors.push(`evals/cases/${dirName}.json trigger.positive[${idx}] must have a non-empty prompt`);
      }
    });
  }

  const neg = parsed.trigger && parsed.trigger.negative;
  if (!Array.isArray(neg) || neg.length < 2) {
    errors.push(`evals/cases/${dirName}.json must define at least 2 trigger.negative entries`);
  } else {
    neg.forEach((item, idx) => {
      if (!item || typeof item.prompt !== 'string' || !item.prompt.trim()) {
        errors.push(`evals/cases/${dirName}.json trigger.negative[${idx}] must have a non-empty prompt`);
      }
    });
  }

  if (!Array.isArray(parsed.evals) || parsed.evals.length < 1) {
    errors.push(`evals/cases/${dirName}.json must define at least 1 behavioral eval`);
  } else {
    parsed.evals.forEach((ev, idx) => {
      if (!ev || ev.id === undefined || ev.id === null) {
        errors.push(`evals/cases/${dirName}.json evals[${idx}] missing 'id'`);
      }
      if (!ev || typeof ev.prompt !== 'string' || !ev.prompt.trim()) {
        errors.push(`evals/cases/${dirName}.json evals[${idx}] must have a non-empty 'prompt'`);
      }
      if (!ev || !Array.isArray(ev.expectations) || ev.expectations.length < 1) {
        errors.push(`evals/cases/${dirName}.json evals[${idx}] must have a non-empty 'expectations' array`);
      }
    });
  }

  return errors;
}

function extractTomlStringValue(content, key) {
  const normalized = normalizeLineEndings(content);
  const multiDouble = normalized.match(new RegExp(`^${key}\\s*=\\s*"""([\\s\\S]*?)"""`, 'm'));
  if (multiDouble) return multiDouble[1].trim();
  const multiSingle = normalized.match(new RegExp(`^${key}\\s*=\\s*'''([\\s\\S]*?)'''`, 'm'));
  if (multiSingle) return multiSingle[1].trim();
  const singleLineDouble = normalized.match(new RegExp(`^${key}\\s*=\\s*"([^"\\n]*)"`, 'm'));
  if (singleLineDouble) return singleLineDouble[1].trim();
  const singleLineSingle = normalized.match(new RegExp(`^${key}\\s*=\\s*'([^'\\n]*)'`, 'm'));
  if (singleLineSingle) return singleLineSingle[1].trim();
  return null;
}

function lintCommandTomlContent(fileName, content) {
  const errors = [];
  const description = extractTomlStringValue(content, 'description');
  const prompt = extractTomlStringValue(content, 'prompt');

  if (!description) {
    errors.push(`commands/${fileName} missing non-empty 'description' assignment`);
  }
  if (!prompt) {
    errors.push(`commands/${fileName} missing non-empty 'prompt' assignment`);
  }
  return errors;
}

function validateRepo(rootDir = path.resolve(__dirname, '..')) {
  const skillsDir   = path.join(rootDir, 'skills');
  const evalsDir    = path.join(rootDir, 'evals', 'cases');
  const commandsDir = path.join(rootDir, 'commands');

  const results = [];
  let totalErrors = 0;
  let totalWarnings = 0;

  if (!fs.existsSync(skillsDir)) {
    return {
      ok: false,
      totalErrors: 1,
      totalWarnings: 0,
      results: [{ target: 'skills/', errors: [`Missing skills directory at ${skillsDir}`], warnings: [] }],
    };
  }

  const skillDirs = fs.readdirSync(skillsDir)
    .filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory())
    .sort();

  if (skillDirs.length === 0) {
    return {
      ok: false,
      totalErrors: 1,
      totalWarnings: 0,
      results: [{ target: 'skills/', errors: ['skills/ directory contains no skill folders'], warnings: [] }],
    };
  }

  const knownSkills = new Set(skillDirs);

  for (const dirName of skillDirs) {
    const skillDir  = path.join(skillsDir, dirName);
    const skillPath = path.join(skillDir, 'SKILL.md');
    const evalPath  = path.join(evalsDir, `${dirName}.json`);

    let errors = [];
    let warnings = [];

    if (!fs.existsSync(skillPath)) {
      errors.push(`Missing skills/${dirName}/SKILL.md`);
    } else {
      const content = fs.readFileSync(skillPath, 'utf8');
      const res = lintSkillContent(dirName, content, knownSkills);
      errors.push(...res.errors);
      warnings.push(...res.warnings);
      errors.push(...lintSkillLayout(skillDir));
    }

    if (!fs.existsSync(evalPath)) {
      errors.push(`Missing eval case file: evals/cases/${dirName}.json`);
    } else {
      const rawEval = fs.readFileSync(evalPath, 'utf8');
      errors.push(...lintEvalCaseContent(dirName, rawEval));
    }

    totalErrors += errors.length;
    totalWarnings += warnings.length;
    results.push({ target: `skills/${dirName}`, errors, warnings });
  }

  if (fs.existsSync(commandsDir)) {
    const tomlFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.toml')).sort();
    for (const fileName of tomlFiles) {
      const content = fs.readFileSync(path.join(commandsDir, fileName), 'utf8');
      const errors = lintCommandTomlContent(fileName, content);
      totalErrors += errors.length;
      results.push({ target: `commands/${fileName}`, errors, warnings: [] });
    }
  }

  return {
    ok: totalErrors === 0,
    totalErrors,
    totalWarnings,
    skillCount: skillDirs.length,
    results,
  };
}

function main() {
  const summary = validateRepo();

  for (const item of summary.results) {
    if (item.errors.length === 0 && item.warnings.length === 0) {
      console.log(`  ✓  ${item.target}`);
    } else {
      const icon = item.errors.length > 0 ? '  ✗ ' : '  ⚠ ';
      console.log(`${icon} ${item.target}`);
      for (const msg of item.errors)   console.log(`       ERROR: ${msg}`);
      for (const msg of item.warnings) console.log(`       WARN:  ${msg}`);
    }
  }

  const status = summary.totalErrors > 0
    ? 'FAILED'
    : summary.totalWarnings > 0
      ? 'PASSED WITH WARNINGS'
      : 'PASSED';

  console.log(`\n${summary.skillCount || 0} skill(s) checked — ${summary.totalErrors} error(s), ${summary.totalWarnings} warning(s) — ${status}`);
  if (!summary.ok) process.exit(1);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error(`\nERROR: validate-skills failed unexpectedly: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  normalizeLineEndings,
  stripFencedCodeBlocks,
  parseFrontmatter,
  extractSkillReferences,
  lintSkillContent,
  lintSkillLayout,
  lintEvalCaseContent,
  lintCommandTomlContent,
  validateRepo,
};

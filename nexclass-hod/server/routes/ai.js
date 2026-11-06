const express = require('express');
const router = express.Router();
const https = require('https');
const { requireAuth, requireRole } = require('../middleware/auth')
const { requireFeature } = require('../middleware/license')

function generateGeminiText(prompt, { json = false, maxOutputTokens = 1500 } = {}) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const error = new Error('Gemini is not configured. Set GEMINI_API_KEY in the server .env file.');
      error.status = 503;
      return reject(error);
    }
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens,
        ...(json ? { responseMimeType: 'application/json' } : {})
      }
    });
    const request = https.request({
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
        'content-length': Buffer.byteLength(payload)
      }
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(body); }
        catch { return reject(new Error('Gemini returned an unreadable response.')); }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(parsed.error?.message || 'Gemini could not generate a response.');
          error.status = response.statusCode === 429 ? 429 : 502;
          return reject(error);
        }
        const text = parsed.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '').join('').trim();
        if (!text) return reject(new Error('Gemini returned an empty response.'));
        resolve(text);
      });
    });
    request.setTimeout(30000, () => request.destroy(new Error('Gemini request timed out.')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

router.post('/generate-questions', requireAuth, requireRole('teacher'), requireFeature('ai'), async (req, res) => {
  const { topic, subject, count = 3, types = ['mcq', 'short_answer', 'long_answer'], difficulty = 'medium' } = req.body;
  if (!String(topic || '').trim()) return res.status(400).json({ error: 'Topic is required' });
  const allowedTypes = ['mcq', 'short_answer', 'long_answer', 'code'];
  const requestedTypes = Array.isArray(types) ? types.filter(type => allowedTypes.includes(type)) : [];
  const questionCount = Math.max(1, Math.min(10, Number(count) || 3));
  const prompt = `You help a teacher draft assessment questions. Create ${questionCount} original ${String(difficulty).slice(0, 30)} level questions for ${String(subject || 'the course').slice(0, 100)} on this topic: ${String(topic).slice(0, 300)}. Use only these question types: ${requestedTypes.join(', ') || 'mcq, short_answer, long_answer'}. Return a JSON array. Every item must include type, text, points. MCQ items also need four options and correct_index from 0 to 3. Written and code items need a concise rubric. Code questions also need language. Keep answer keys only in MCQ correct_index. Do not include markdown.`;
  try {
    const text = await generateGeminiText(prompt, { json: true, maxOutputTokens: 3000 });
    const questions = JSON.parse(text);
    if (!Array.isArray(questions)) throw new Error('Gemini returned an invalid question draft.');
    res.json({ questions: questions.slice(0, questionCount) });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.status === 429
      ? 'Gemini free-tier quota is temporarily exhausted. Try again later.'
      : error.message || 'Gemini could not draft questions. Please try again.' });
  }
});

router.post('/hint', requireAuth, requireRole('student', 'teacher'), requireFeature('ai'), async (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  if (!process.env.GEMINI_API_KEY) {
    return res.json({ hint: getLocalHint(code, language) });
  }

  try {
    const hint = await generateGeminiText(
      `You are a code teaching assistant. Give 2-3 concise hints for a student writing ${String(language || 'code').slice(0, 30)}. Do not give the full solution.\n\n\`\`\`${language || ''}\n${String(code).slice(0, 12000)}\n\`\`\``,
      { maxOutputTokens: 800 }
    );
    res.json({ hint });
  } catch {
    res.json({ hint: getLocalHint(code, language) });
  }
});

function getLocalHint(code, language) {
  let issues = [];

  // Check brackets
  const brackets = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (let char of line) {
      if (brackets[char]) {
        stack.push({ char, lineNum: i + 1 });
      } else if (Object.values(brackets).includes(char)) {
        if (stack.length === 0) {
          issues.push(`Found unmatched closing bracket '${char}' on line ${i + 1}`);
        } else {
          const top = stack.pop();
          if (brackets[top.char] !== char) {
            issues.push(`Mismatched brackets: '${top.char}' opened on line ${top.lineNum} closed with '${char}' on line ${i + 1}`);
          }
        }
      }
    }
  }

  while (stack.length > 0) {
    const top = stack.pop();
    issues.push(`Unmatched opening bracket '${top.char}' on line ${top.lineNum}`);
  }

  // Python specific checks
  if (language === 'python') {
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (
        (trimmed.startsWith('def ') ||
         trimmed.startsWith('if ') ||
         trimmed.startsWith('elif ') ||
         trimmed.startsWith('else') ||
         trimmed.startsWith('for ') ||
         trimmed.startsWith('while ') ||
         trimmed.startsWith('class ')) &&
        !trimmed.endsWith(':')
      ) {
        issues.push(`Syntax Hint: Missing colon ':' at the end of block statement on line ${i + 1}`);
      }
    });
  }

  // JS checks
  if (language === 'javascript') {
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('const ') && !trimmed.includes('=')) {
        issues.push(`Syntax Hint: 'const' declaration must be initialized on line ${i + 1}`);
      }
    });
  }

  let hintText = `💡 [Offline Mode] Gemini API is offline or not configured.\n\n`;
  if (issues.length > 0) {
    hintText += `Local Heuristic Code Check found the following potential issues:\n` + issues.map(iss => `- ${iss}`).join('\n');
  } else {
    hintText += `Local Heuristic Code Check didn't find obvious syntax errors. Double check logic, variable names, and outputs!`;
  }
  return hintText;
}

module.exports = router;

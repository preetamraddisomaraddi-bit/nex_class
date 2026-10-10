const express = require('express');
const router = express.Router();
const https = require('https');

router.post('/hint', (req, res) => {
  const { code, language } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.json({ hint: getLocalHint(code, language) });
  }

  // Anthropic API request
  const data = JSON.stringify({
    model: 'claude-3-5-sonnet-latest',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `You are an AI teaching assistant. The student is writing ${language} code. Keep your feedback concise, focusing on hints rather than giving direct solutions. Here is the student's code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide 2-3 specific hints or guidelines on how they can improve or fix any potential bugs in this code.`
      }
    ]
  });

  const options = {
    hostname: 'api.anthropic.com',
    port: 443,
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-length': Buffer.byteLength(data)
    }
  };

  const reqApi = https.request(options, (resApi) => {
    let body = '';
    resApi.on('data', (chunk) => body += chunk);
    resApi.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (parsed.content && parsed.content[0] && parsed.content[0].text) {
          res.json({ hint: parsed.content[0].text });
        } else {
          res.json({ hint: getLocalHint(code, language) + '\n\n(AI Request returned no text. Showing local analysis instead.)' });
        }
      } catch (e) {
        res.json({ hint: getLocalHint(code, language) + '\n\n(Error parsing AI response. Showing local analysis instead.)' });
      }
    });
  });

  reqApi.on('error', () => {
    res.json({ hint: getLocalHint(code, language) });
  });

  reqApi.write(data);
  reqApi.end();
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

  let hintText = `💡 [Offline Mode] Claude API is offline or not configured.\n\n`;
  if (issues.length > 0) {
    hintText += `Local Heuristic Code Check found the following potential issues:\n` + issues.map(iss => `- ${iss}`).join('\n');
  } else {
    hintText += `Local Heuristic Code Check didn't find obvious syntax errors. Double check logic, variable names, and outputs!`;
  }
  return hintText;
}

module.exports = router;

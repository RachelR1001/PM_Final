const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

const deepseekApiKey = '3476dfe5-ca59-470b-94d0-00c42a630460';
const deepseekApiEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

app.use(cors());
app.use(express.json());

const MAX_RETRIES = 3;

async function sendRequestToDeepSeek(prompt) {
    let retries = 0;
    while (retries < MAX_RETRIES) {
        try {
            const response = await axios.post(deepseekApiEndpoint, {
                model: 'deepseek-v3-250324',
                temperature: 0,
                top_p: 0.9,
                messages: [{ role: 'user', content: prompt }]
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${deepseekApiKey}`
                }
            });
            return response.data;
        } catch (error) {
            console.error(`DeepSeek 请求出错（第 ${retries + 1} 次尝试）:`, error);
            retries++;
            if (retries === MAX_RETRIES) throw new Error('达到最大重试次数');
        }
    }
}

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "缺少 prompt 参数" });
    try {
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            return res.status(500).json({ error: 'DeepSeek 响应为空' });
        }
        res.json({ text: response.choices[0].message.content.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/analyze-email-structure', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "缺少 prompt 参数" });
    try {
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            return res.status(500).json({ error: 'DeepSeek 响应异常' });
        }

        const responseContent = response.choices[0].message.content.trim();
        const components = [];
        const lineRegex = /^(\d+)\.\s*(.*?):\s*"(.*?)"$/gm;
        let match;
        while ((match = lineRegex.exec(responseContent)) !== null) {
            if (match[2] && match[3]) {
                components.push({ title: match[2].trim(), tag: match[3].trim() });
            }
        }

        res.json(components);
    } catch (error) {
        console.error('结构分析失败:', error);
        res.status(500).json({ error: '邮件结构分析失败' });
    }
});

app.post('/generate-recommended-factors', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "缺少 prompt 参数" });
    }
    try {
        const response = await sendRequestToDeepSeek(prompt);
        const responseText = response.choices[0].message.content.trim();

        const recommendedFactors = [];
        const tagGroups = [
            {
                title: 'Relationship type',
                tags: ['Supervisor and Student', 'Friends and family', 'Etc.']
            },
            {
                title: 'Familiarity',
                tags: [
                    'Familiar',
                    'Knows each other and establishes some intimacy',
                    'Knows each other but unfamiliar',
                    'Strangers'
                ]
            },
            {
                title: 'Power, resource, status, hierarchy difference',
                tags: ['Receiver is higher', 'Equal', 'Receiver is lower']
            },
            {
                title: 'Needs for Maintaining relationship',
                tags: ['Get far away', 'Remain the same', 'Get closer']
            },
            {
                title: 'Culture',
                tags: ['Direct Western Culture', 'Indirect Eastern Culture']
            },
            {
                title: 'Personality traits',
                tags: ['Introverted', 'Extroverted']
            },
            {
                title: 'Promptness',
                tags: ['Urgent', 'Non-urgent']
            },
            {
                title: 'You want the receiver to feel you are',
                tags: [
                    'Gratitude / Appreciation 🙏',
                    'Excitement / Enthusiasm 🎉',
                    'Apology / Regret 😔',
                    'Frustration / Disappointment 😤',
                    'Concern / Empathy 😨',
                    'Neutral Emotion ⚪'
                ]
            },
            {
                title: 'You want to avoid the receiver from feeling you are',
                tags: [
                    'Avoid Disrespectful / Aggressive 😡',
                    'Avoid Condescending / Patronizing 🙄',
                    'Avoid Dismissive / Uncaring 😒',
                    'Avoid Confusing / Unclear 😕',
                    'Avoid Annoyed / Irritated 😤',
                    'NA ⚪'
                ]
            },
            {
                title: 'The mistake is more on which side?',
                tags: ['Our side', 'Receiver\'s side', 'It’s not whose mistake']
            },
            {
                title: 'Occasion',
                tags: ['Formal: On behalf of an organization or writing for a formal event. Formal notification or announcement.', 'Personal']
            },
            {
                title: 'Avoid negative consequence',
                tags: [
                    'Avoid being harsh',
                    'Avoid breaking relationships',
                    'Avoid being criticized by the receiver',
                    '[To AI Helper: If you choose this factor as one of the most important factors, please generate several potential consequences which user may want to avoid in the given context, instead of directly using the given example]'
                ]
            },
            {
                title: 'Balance competing factors',
                tags: [
                    'Show apology vs. clearly state my request',
                    'Clearly state my request but avoid hurting future relationships',
                    '[To AI Helper: If you choose this factor as one of the most important factors, please generate several potential competing factors which user may want to avoid in the given context, instead of directly using the given example. Please start with “Avoid xxxx”, highlight it is avoid something.]'
                ]
            }
        ];

        const factorRegex = /\*\*(.*?)\*\*/g;
        const foundTitles = new Set();
        let match;
        while ((match = factorRegex.exec(responseText)) && foundTitles.size < 3) {
            const factorTitle = match[1].trim();
            foundTitles.add(factorTitle);
        }

        tagGroups.forEach(group => {
            if (foundTitles.has(group.title)) {
                recommendedFactors.push(group);
            }
        });

        if (recommendedFactors.length < 3) {
            console.warn('推荐因素不足3个，可能需要调整解析逻辑');
        }

        if (recommendedFactors.length === 0) {
            console.error('未找到推荐因素');
            return res.status(500).json({ error: '未找到推荐因素' });
        }

        res.json(recommendedFactors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/generate-final-email', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) {
        return res.status(400).json({ error: "缺少 prompt 参数" });
    }
    try {
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            console.error('DeepSeek 生成最终邮件响应为空');
            return res.status(500).json({ error: 'DeepSeek 生成最终邮件响应为空' });
        }
        res.json({ text: response.choices[0].message.content.trim() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/save-log', async (req, res) => {
    const { userInput, prompt, toneFactors, finalEmail } = req.body;
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timestamp = now.getTime();
    const fileName = `${year}${month}${day}_${timestamp}.md`;
    const logDir = path.join(__dirname, '..', 'userLogs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    const logFilePath = path.join(logDir, fileName);

    const markdownContent = `# 邮件生成日志
• **UserInput**: ${userInput}
• **Selected Tone Factor**:
\`\`\`
${JSON.stringify(toneFactors, null, 2)}
\`\`\`
• **Request Prompt**:
\`\`\`
${prompt}
\`\`\`
• **Final Email**:
\`\`\`
${finalEmail}
\`\`\`
`;
    try {
        fs.writeFileSync(logFilePath, markdownContent);
        res.json({ message: '日志保存成功' });
    } catch (err) {
        console.error('保存日志时出错:', err);
        res.status(500).json({ error: '保存日志时出错' });
    }
});

app.post('/suggest-email-components', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });
  
    try {
      const response = await sendRequestToDeepSeek(prompt);
      if (!response.choices?.length) {
        return res.status(500).json({ error: '建议组件响应异常' });
      }
  
      const txt = response.choices[0].message.content.trim();
  
      const components = [];
  
      const blockRegex =
        /^(\d+)\.\s*Component Name:\s*"(.*?)"\s*[\r\n]+\s*Component Content:\s*"(.*?)"/gm;
      let m;
      while ((m = blockRegex.exec(txt)) !== null) {
        components.push({ title: m[2].trim(), tag: m[3].trim() });
      }
  
      if (components.length === 0) {
        const lineRegex =
          /^(\d+)\.\s*([^:：]+?)[:：]\s*[“"']?(.+?)[”"']?\s*$/gm;
        while ((m = lineRegex.exec(txt)) !== null) {
          components.push({ title: m[2].trim(), tag: m[3].trim() });
        }
      }
  
      if (/^\s*NA\s*$/i.test(txt)) return res.json([]);
  
      return res.json(components);
    } catch (err) {
      console.error('建议组件请求失败:', err);
      res.status(500).json({ error: '建议组件请求失败' });
    }
  });

app.post('/adjust-component', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });

    try {
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            return res.status(500).json({ error: '调整请求响应异常' });
        }

        const adjustResult = response.choices[0].message.content.trim();
        const jsonResult = JSON.parse(adjustResult);

        if (!['Choose from some given options', 'Need further user information', 'Tone adjustment'].includes(jsonResult.Type)) {
            return res.status(500).json({ error: '不支持的修订类型' });
        }

        res.json(jsonResult);
    } catch (error) {
        console.error('调整请求失败:', error);
        res.status(500).json({ error: '调整请求失败' });
    }
});
/* ================================================== */
/* 纯文本语义分段接口：LLM 优先 + 本地兜底            */
/* ================================================== */
// =================================================
// 纯文本语义分段接口：LLM 优先 + 本地兜底
// =================================================
app.post('/format-plaintext', async (req, res) => {
    const { components } = req.body;
    if (!Array.isArray(components) || components.length === 0) {
      return res.status(400).json({ error: '缺少有效组件列表' });
    }
  
    /* ---------- 1. 组 Prompt ---------- */
    const list = components
      .map((c, i) => `${i + 1}. ${c.title}: "${c.tag}"`)
      .join('\n');
  
    const llmprompt = `
  You are an email formatter.
  
  Task:
  1. Group the components into **3‑6** logical paragraphs.
  2. Keep EVERY word exactly as‑is — no additions, deletions, or rewrites.
  3. Put TWO newlines between paragraphs; INSIDE a paragraph, remove all line‑breaks.
  4. Output ONLY the email text (no numbering, no explanations).
  
  Components:
  ${list}
    `.trim();
  
    /* ---------- 2. 调用 LLM ---------- */
    let raw = '';
    try {
      const data = await sendRequestToDeepSeek(llmprompt);
      raw = (data.choices?.[0]?.message?.content || '').trim();
    } catch (e) {
      console.error('DeepSeek 调用失败:', e.message);
    }
  
    /* ---------- 3. 统一换行 & 统计段落 ---------- */
    raw = raw.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    let paraCnt = raw.split('\n\n').filter(Boolean).length;
  
    /* ---------- 4. 若合规 → 正则微调 ---------- */
    if (paraCnt >= 3 && paraCnt <= 6) {
      // 4‑A 保护 Dear / regards 行 —— 先插空行
      raw = raw
        .replace(/^(Dear[^\n]*,?)/im, '$1\n\n')                            // Dear 行后空行
        .replace(/((?:Best|Warm|Kind|Sincere|With)[^\n]*?regards?,?)/i,
                 '\n\n$1\n');                                             // regards 行独段
  
      // 4‑B 段内单换行 → 空格
      raw = raw.replace(/([^\n])\n([^\n])/g, '$1 $2');
  
      // 4‑C 去掉可能残留的 “Subject Line:” 前缀
      raw = raw.replace(/^Subject Line:\s*/i, '');
  
      // 4‑D 把 “[Your Full Name] [Your Contact Information …]” 分行
      raw = raw.replace(/\]\s+\[/g, ']\n[');
  
      return res.json({ plainText: raw.trim() });
    }
  
    /* ---------- 5. 不合规 → 兜底 ---------- */
    return res.json({ plainText: heuristicMerge(components) });
  });
  
  
  
  /* -------------------------------------------------- */
  /* 极简启发式兜底                                     */
  /* -------------------------------------------------- */
  function heuristicMerge(comps) {
    // 主旨行
    const subject = comps[0].tag.trim();
  
    // >>> 修改: 提取 greeting / closing / 签名 / 联系方式
    const greetIdx = comps.findIndex(c => /^(dear|hi)\b/i.test(c.tag));
    const greeting = greetIdx !== -1 ? comps[greetIdx].tag.trim() : '';
  
    const closeIdx = comps.findIndex(c =>
      /(regards|sincerely|best wishes)\b/i.test(c.tag)
    );
    const closingLine =
      closeIdx !== -1 ? comps[closeIdx].tag.trim() : '';
  
    // 签名与联系方式 = closingLine 之后的所有组件，各自独立行
    const signatureArr =
      closeIdx !== -1
        ? comps.slice(closeIdx + 1).map(c => c.tag.trim()).filter(Boolean)
        : [];
  
    // 正文组件：介于 greeting 与 closing 之间
    const bodyArr = comps
      .filter((_, idx) =>
        idx !== 0 &&
        idx !== greetIdx &&
        (closeIdx === -1 || idx < closeIdx)
      )
      .map(c => c.tag.trim());
  
    const bodyParagraph = bodyArr.join(' '); // 全并一段
  
    // 组装：subject / greeting / body / closing / (签名 + 联系方式)
    return [
      subject,
      greeting,
      bodyParagraph,
      closingLine,
      ...signatureArr, // 每行一个
    ]
      .filter(Boolean)
      .join('\n\n');
    // <<< 修改
  }

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});    
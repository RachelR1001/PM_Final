const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

const deepseekApiKey = '3476dfe5-ca59-470b-94d0-00c42a630460';
const deepseekApiEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const factorList = require('../data/PredefinedData/factor_list.json'); // 引用 factor_list.json

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
                tags: ['Our side', 'Receiver\'s side', 'It`s not whose mistake']
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
                    '[To AI Helper: If you choose this factor as one of the most important factors, please generate several potential competing factors which user may want to avoid in the given context, instead of directly using the given example. Please start with "Avoid xxxx", highlight it is avoid something.]'
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
          /^(\d+)\.\s*([^:：]+?)[:：]\s*[""']?(.+?)[""']?\s*$/gm;
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
        .replace(/^(Dear[^\n]*,?)/im, '$1\n\n')                            // Dear 行后空行
        .replace(/((?:Best|Warm|Kind|Sincere|With)[^\n]*?regards?,?)/i,
                 '\n\n$1\n');                                             // regards 行独段
  
      // 4‑B 段内单换行 → 空格
      raw = raw.replace(/([^\n])\n([^\n])/g, '$1 $2');
  
      // 4‑C 去掉可能残留的 ""Subject Line:"" 前缀
      raw = raw.replace(/^Subject Line:\s*/i, '');
  
      // 4‑D 把 ""[Your Full Name] [Your Contact Information …]"" 分行
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

app.post('/rank-and-revise-factors', async (req, res) => {
    const { userTask } = req.body;

    // 检查 userTask 是否存在
    if (!userTask) {
        return res.status(400).json({ error: "缺少 userTask 参数" });
    }

    // 加载 markdown 文件内容
    const promptPath = path.join(__dirname, '../data/Prompts/contextual_factor_predictor.prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 prompt 文件失败:', error);
        return res.status(500).json({ error: '加载 prompt 文件失败' });
    }

    // 替换 markdown 文件中的占位符
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_LIST}}', JSON.stringify(factorList, null, 2));

    try {
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            return res.status(500).json({ error: 'DeepSeek 响应为空' });
        }

        // 移除 Markdown 格式的代码块标记
        const rawContent = response.choices[0].message.content.trim();
        const jsonContent = rawContent.replace(/```json|```/g, ''); // 移除 ```json 和 ``` 标记

        // 解析 JSON
        let result;
        try {
            result = JSON.parse(jsonContent);
        } catch (error) {
            console.error('解析 JSON 失败:', jsonContent);
            return res.status(500).json({ error: '解析 JSON 失败' });
        }

        // 根据返回的 ranked_factor_ids 和 modified_options 构建结果
        const rankedFactors = result.ranked_factor_ids.map(id => {
            const factor = factorList.find(f => f.id === id);
            if (factor) {
                return {
                    ...factor,
                    options: result.modified_options[id] || factor.options
                };
            }
            console.warn(`未找到匹配的 factor: ${id}`);
            return null;
        }).filter(Boolean);

        res.json(rankedFactors);
    } catch (error) {
        console.error('Rank and revise factors 出错:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/generate-snippet', async (req, res) => {
    const { userTask, factorName, factorOption } = req.body;

    if (!userTask || !factorName || !factorOption) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    // 加载 prompt 模板
    const promptPath = path.join(__dirname, '../data/Prompts/snippet_generator_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 prompt 文件失败:', error);
        return res.status(500).json({ error: '加载 prompt 文件失败' });
    }

    // 填充 prompt
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_NAME}}', factorName)
        .replace('{{FACTOR_OPTION}}', factorOption);

    try {
        // 调用 DeepSeek 服务生成 snippet
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            throw new Error('DeepSeek 响应为空');
        }

        // 解析返回的 JSON 数据
        const rawContent = response.choices[0].message.content.trim();
        const jsonContent = rawContent.replace(/```json|```/g, ''); // 移除 Markdown 格式标记
        const parsedData = JSON.parse(jsonContent);

        // 提取 snippet 字段
        const snippet = parsedData.snippet || '未生成 snippet';
        res.json({ snippet });
    } catch (error) {
        console.error('生成 snippet 出错:', error.message);
        res.status(500).json({ error: '生成 snippet 出错，请稍后重试' });
    }
});

app.post('/create-session', (req, res) => {
    const { userName, userInput } = req.body;

    if (!userName || !userInput) {
        return res.status(400).json({ error: 'userName 和 userInput 是必需的' });
    }

    const sessionDataPath = path.join(__dirname, '../data/SessionData');
    const userPath = path.join(sessionDataPath, userName);
    const taskId = `${userName}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const taskPath = path.join(userPath, taskId);

    try {
        // 创建用户目录
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath, { recursive: true });
        }

        // 创建任务目录
        if (!fs.existsSync(taskPath)) {
            fs.mkdirSync(taskPath, { recursive: true });
        }

        // 创建 meta 目录和 task.json 文件
        const metaPath = path.join(taskPath, 'meta');
        if (!fs.existsSync(metaPath)) {
            fs.mkdirSync(metaPath, { recursive: true });
        }
        const taskJsonPath = path.join(metaPath, 'task.json');
        const taskJsonContent = {
            user: userName,
            task_id: taskId,
            created_iso: new Date().toISOString(),
            original_task: userInput
        };
        fs.writeFileSync(taskJsonPath, JSON.stringify(taskJsonContent, null, 2));

        // 创建 factors 目录
        const factorsPath = path.join(taskPath, 'factors');
        if (!fs.existsSync(factorsPath)) {
            fs.mkdirSync(factorsPath, { recursive: true });
        }

        // 创建 intents 目录
        const intentsPath = path.join(taskPath, 'intents');
        if (!fs.existsSync(intentsPath)) {
            fs.mkdirSync(intentsPath, { recursive: true });
        }

        // 创建 drafts 目录
        const draftsPath = path.join(taskPath, 'drafts');
        if (!fs.existsSync(draftsPath)) {
            fs.mkdirSync(draftsPath, { recursive: true });
        }

        // 创建 localized 目录
        const localizedPath = path.join(taskPath, 'localized');
        if (!fs.existsSync(localizedPath)) {
            fs.mkdirSync(localizedPath, { recursive: true });
        }

        // 创建 logs 目录
        const logsPath = path.join(taskPath, 'logs');
        if (!fs.existsSync(logsPath)) {
            fs.mkdirSync(logsPath, { recursive: true });
        }

        res.status(200).json({ message: 'Session 数据已创建', taskId });
    } catch (error) {
        console.error('创建 SessionData 目录或文件时出错:', error);
        res.status(500).json({ error: '创建 SessionData 目录或文件时出错' });
    }
});

app.post('/save-factor-choices', (req, res) => {
    const { userName, factorChoices, taskId } = req.body;

    console.log('Save Factor Choices Request Body:', req.body);

    if (!userName || !factorChoices || !taskId) {
        return res.status(400).json({ error: 'userName、factorChoices 和 taskId 是必需的' });
    }

    const factorsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'factors');
    const factorChoicesPath = path.join(factorsPath, 'choices.json');

    try {
        if (!fs.existsSync(factorsPath)) {
            fs.mkdirSync(factorsPath, { recursive: true });
        }

        fs.writeFileSync(factorChoicesPath, JSON.stringify(factorChoices, null, 2));
        res.status(200).json({ message: 'Factor choices saved successfully' });
    } catch (error) {
        console.error('Error saving factor choices:', error);
        res.status(500).json({ error: 'Error saving factor choices' });
    }
});

app.post('/analyze-intent', async (req, res) => {
    const { userTask, factorChoices, userName, taskId } = req.body;

    console.log('Analyze Intent Request Body:', req.body);

    if (!userTask || !factorChoices || !userName || !taskId) {
        return res.status(400).json({ error: 'userTask、factorChoices、userName 和 taskId 是必需的' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/intent_analyzer_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 intent_analyzer_prompt.md 文件失败:', error);
        return res.status(500).json({ error: '加载 intent_analyzer_prompt.md 文件失败' });
    }

    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2));

    try {
        const response = await sendRequestToDeepSeek(prompt);

        if (!response.choices || response.choices.length === 0) {
            console.error('DeepSeek 响应为空:', response);
            throw new Error('DeepSeek 响应为空');
        }

        const rawContent = response.choices[0].message.content.trim();
        const jsonContent = rawContent.replace(/```json|```/g, ''); // 移除 Markdown 格式标记

        let parsedData;
        try {
            parsedData = JSON.parse(jsonContent);
        } catch (error) {
            console.error('解析 JSON 数据失败:', jsonContent);
            return res.status(500).json({ error: '解析 JSON 数据失败' });
        }

        const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');
        console.log('Intents Path:', intentsPath);

        try {
            if (!fs.existsSync(path.dirname(intentsPath))) {
                fs.mkdirSync(path.dirname(intentsPath), { recursive: true });
            }
            fs.writeFileSync(intentsPath, JSON.stringify(parsedData, null, 2));
        } catch (error) {
            console.error('写入 intents/current.json 文件失败:', error);
            return res.status(500).json({ error: '写入 intents/current.json 文件失败' });
        }

        res.json(parsedData);
    } catch (error) {
        console.error('分析意图时出错:', error);
        res.status(500).json({ error: '分析意图时出错' });
    }
});

app.post('/generate-first-draft', async (req, res) => {
    const { userTask, factorChoices, intents, userName, taskId } = req.body;

    console.log('Generate First Draft Request Body:', req.body);

    if (!userTask || !factorChoices || !intents || !userName || !taskId) {
        return res.status(400).json({ error: 'userTask、factorChoices、intents、userName 和 taskId 是必需的' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/first_draft_composer_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 first_draft_composer_prompt.md 文件失败:', error);
        return res.status(500).json({ error: '加载 first_draft_composer_prompt.md 文件失败' });
    }

    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intents, null, 2));

    try {
        const response = await sendRequestToDeepSeek(prompt);

        if (!response.choices || response.choices.length === 0) {
            console.error('DeepSeek 响应为空:', response);
            throw new Error('DeepSeek 响应为空');
        }

        const draftContent = response.choices[0].message.content.trim();
        const draftsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'drafts', 'latest.md');
        console.log('Drafts Path:', draftsPath);

        try {
            if (!fs.existsSync(path.dirname(draftsPath))) {
                fs.mkdirSync(path.dirname(draftsPath), { recursive: true });
            }
            fs.writeFileSync(draftsPath, draftContent);
        } catch (error) {
            console.error('写入 drafts/latest.md 文件失败:', error);
            return res.status(500).json({ error: '写入 drafts/latest.md 文件失败' });
        }

        res.json({ draft: draftContent });
    } catch (error) {
        console.error('生成第一版草稿时出错:', error);
        res.status(500).json({ error: '生成第一版草稿时出错' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});    
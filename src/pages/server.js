const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

// 设置 DeepSeek API 密钥和端点
const deepseekApiKey = '3476dfe5-ca59-470b-94d0-00c42a630460';
const deepseekApiEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

// 使用 cors 中间件
app.use(cors());
app.use(express.json());

const MAX_RETRIES = 3;

// 封装发送请求到 DeepSeek 的函数，包含重试逻辑
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

// 处理生成文本的请求（示例接口，供参考）
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

// 处理邮件结构分析请求（前端构建 prompt，后端接收）
app.post('/analyze-email-structure', async (req, res) => {
    console.log('1212:', req.body);
    const { prompt } = req.body;
    console.log('分析邮件结构的请求:', prompt);
    if (!prompt) return res.status(400).json({ error: "缺少 prompt 参数" });
    try {
        console.log('分析邮件结构的请求:', prompt);
        const response = await sendRequestToDeepSeek(prompt);
        if (!response.choices || response.choices.length === 0) {
            console.error('DeepSeek 响应异常');
            return res.status(500).json({ error: '结构分析响应异常' });
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

// 处理生成推荐因素的请求
app.post('/generate-recommended-factors', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: "缺少 prompt 参数" });
    }

    try {
        const response = await sendRequestToDeepSeek(prompt);
        const responseText = response.choices[0].message.content.trim();
        console.log('DeepSeek 返回的推荐因素文本:', responseText);

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

        console.log('后端返回给前端的推荐因素:', recommendedFactors);
        res.json(recommendedFactors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 处理生成最终邮件的请求
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

// 处理保存日志的请求
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

/* ---------- /suggest-email-components 路由 ---------- */
app.post('/suggest-email-components', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '缺少 prompt 参数' });
  
    try {
      const response = await sendRequestToDeepSeek(prompt);
      if (!response.choices?.length) {
        return res.status(500).json({ error: '建议组件响应异常' });
      }
  
      const txt = response.choices[0].message.content.trim();
      console.log('DeepSeek 返回 ↓↓↓\n', txt);
  
      const components = [];
  
      /* ① 优先解析“两行格式”—— Component Name + Component Content */
      const blockRegex =
        /^(\d+)\.\s*Component Name:\s*"(.*?)"\s*[\r\n]+\s*Component Content:\s*"(.*?)"/gm;
      let m;
      while ((m = blockRegex.exec(txt)) !== null) {
        components.push({ title: m[2].trim(), tag: m[3].trim() });
      }
  
      /* ② 如果没解析到，再退回旧的“单行格式” */
      if (components.length === 0) {
        const lineRegex =
          /^(\d+)\.\s*([^:：]+?)[:：]\s*[“"']?(.+?)[”"']?\s*$/gm;
        while ((m = lineRegex.exec(txt)) !== null) {
          components.push({ title: m[2].trim(), tag: m[3].trim() });
        }
      }
  
      /* ③ 碰到 “NA” 就返回空数组 */
      if (/^\s*NA\s*$/i.test(txt)) return res.json([]);
  
      return res.json(components);
    } catch (err) {
      console.error('建议组件请求失败:', err);
      res.status(500).json({ error: '建议组件请求失败' });
    }
  });
  
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
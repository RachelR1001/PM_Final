
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

const deepseekApiKey = 'sk-608de673fd7a4fa1b3f48fa9e7f0d685';
const deepseekApiEndpoint = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

const factorList = require('../../public/data/PredefinedData/factor_list.json'); // 引用 factor_list.json

app.use(cors());
app.use(express.json());

const MAX_RETRIES = 3;

// 添加保存历史记录的辅助函数
function saveIntentHistory(userName, taskId, action, prev, next, source, actor) {
    const historyPath = path.join(__dirname, '../../public/data/SessionData', userName, taskId, 'intents', 'history.json');
    
    try {
        let history = [];
        if (fs.existsSync(historyPath)) {
            const historyContent = fs.readFileSync(historyPath, 'utf-8');
            history = JSON.parse(historyContent);
        }
        
        const historyEntry = {
            ts: new Date().toISOString(),
            action: action,
            prev: prev,
            next: next,
            source: source,
            actor: actor
        };
        
        history.push(historyEntry);
        
        // 确保目录存在
        const historyDir = path.dirname(historyPath);
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
    } catch (error) {
        console.error('保存历史记录时出错:', error);
    }
}

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

app.post('/rank-and-revise-factors', async (req, res) => {
    const { userTask } = req.body;

    // 检查 userTask 是否存在
    if (!userTask) {
        return res.status(400).json({ error: "缺少 userTask 参数" });
    }

    // 加载 markdown 文件内容
    const promptPath = path.join(__dirname, '../../public/data/Prompts/contextual_factor_predictor.prompt.md');
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
    const { userTask, factorName, factorOption, factorChoices } = req.body;

    if (!userTask || !factorName || !factorOption || !factorChoices) {
        return res.status(400).json({ error: '缺少必要参数' });
    }

    // 加载 prompt 模板
    const promptPath = path.join(__dirname, '../../public/data/Prompts/snippet_generator_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 prompt 文件失败:', error);
        return res.status(500).json({ error: '加载 prompt 文件失败' });
    }

    // 填充 prompt
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask) // 替换用户任务
        .replace('{{FACTOR_NAME}}', factorName) // 替换目标因子名称
        .replace('{{FACTOR_OPTION}}', factorOption) // 替换目标因子选项
        .replace(/{{FACTOR_CHOICES}}/g, JSON.stringify(factorChoices, null, 2)); // 替换因子选择列表（两处）

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

// 创建会话接口 - 只在FirstPage调用
app.post('/create-session', (req, res) => {
    const { userName, userInput } = req.body;

    if (!userName || !userInput) {
        return res.status(400).json({ error: 'userName 和 userInput 是必需的' });
    }

    const sessionDataPath = path.join(__dirname, '../../public/data/SessionData');
    const userPath = path.join(sessionDataPath, userName);
    const taskId = `${userName}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const taskPath = path.join(userPath, taskId);

    try {
        // 创建用户目录（如果不存在）
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath, { recursive: true });
        }

        // 创建 PersonaAnchor 目录
        const personaAnchorPath = path.join(userPath, 'PersonaAnchor');
        if (!fs.existsSync(personaAnchorPath)) {
            fs.mkdirSync(personaAnchorPath, { recursive: true });
        }

        // 创建 SituationAnchor 目录
        const situationAnchorPath = path.join(userPath, 'SituationAnchor');
        if (!fs.existsSync(situationAnchorPath)) {
            fs.mkdirSync(situationAnchorPath, { recursive: true });
        }

        // 创建 AdaptiveStylebook 目录
        const adaptiveStylebookPath = path.join(userPath, 'AdaptiveStylebook');
        if (!fs.existsSync(adaptiveStylebookPath)) {
            fs.mkdirSync(adaptiveStylebookPath, { recursive: true });
        }

        // 创建任务目录
        if (!fs.existsSync(taskPath)) {
            fs.mkdirSync(taskPath, { recursive: true });
        }

        // 创建子目录
        const subDirs = ['meta', 'factors', 'intents', 'drafts', 'localized', 'logs'];
        subDirs.forEach((subDir) => {
            const subDirPath = path.join(taskPath, subDir);
            if (!fs.existsSync(subDirPath)) {
                fs.mkdirSync(subDirPath, { recursive: true });
            }
        });

        // 创建 task.json 在 meta 目录中
        const taskJsonPath = path.join(taskPath, 'meta', 'task.json');
        const taskJsonContent = {
            user: userName,
            task_id: taskId,
            created_iso: new Date().toISOString(),
            original_task: "", // Set original_task to an empty string
        };
        fs.writeFileSync(taskJsonPath, JSON.stringify(taskJsonContent, null, 2));

        // 创建 intents/history.json
        const historyPath = path.join(taskPath, 'intents', 'history.json');
        fs.writeFileSync(historyPath, JSON.stringify([], null, 2));

        res.status(200).json({ message: 'Session 数据已创建', taskId });
    } catch (error) {
        console.error('创建 SessionData 目录或文件时出错:', error);
        res.status(500).json({ error: '创建 SessionData 目录或文件时出错' });
    }
});

// 保存factor choices接口 - 修复重复定义问题
app.post('/save-factor-choices', (req, res) => {
    const { userName, factorChoices, taskId } = req.body;

    if (!userName || !factorChoices || !taskId) {
        return res.status(400).json({ error: 'userName、factorChoices 和 taskId 是必需的' });
    }

    // 使用传入的taskId构建路径
    const factorChoicesPath = path.join(__dirname, '../public/data/SessionData', userName, taskId, 'factors', 'choices.json');

    try {
        // 确保目录存在
        const factorsDir = path.dirname(factorChoicesPath);
        if (!fs.existsSync(factorsDir)) {
            fs.mkdirSync(factorsDir, { recursive: true });
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

    if (!userTask || !factorChoices || !userName || !taskId) {
        return res.status(400).json({ error: 'userTask、factorChoices、userName 和 taskId 是必需的' });
    }

    const promptPath = path.join(__dirname, '../../public/data/Prompts/intent_analyzer_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 intent_analyzer_prompt.md 文件失败:', error);
        return res.status(500).json({ error: '加载 intent_analyzer_prompt.md 文件失败' });
    }

    // Generate the prompt by replacing placeholders
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2));

    // 使用传入的taskId构建路径
    const intentsPath = path.join(__dirname, '../public/data/SessionData', userName, taskId, 'intents', 'current.json');

    try {
        const response = await sendRequestToDeepSeek(prompt);

        if (!response.choices || response.choices.length === 0) {
            console.error('DeepSeek 响应为空:', response);
            throw new Error('DeepSeek 响应为空');
        }

        const rawContent = response.choices[0].message.content.trim();
        const jsonContent = rawContent.replace(/```json|```/g, ''); // Remove Markdown formatting
        const parsedData = JSON.parse(jsonContent);

        // 确保目录存在
        if (!fs.existsSync(path.dirname(intentsPath))) {
            fs.mkdirSync(path.dirname(intentsPath), { recursive: true });
        }
        fs.writeFileSync(intentsPath, JSON.stringify(parsedData, null, 2));

        // 为每个初始化的 intent 保存历史记录
        if (Array.isArray(parsedData)) {
            parsedData.forEach(intent => {
                saveIntentHistory(
                    userName,
                    taskId,
                    'initial-load',
                    null,
                    intent,
                    'AI › IntentAnalyzer v1',
                    'AI'
                );
            });
        }

        res.json(parsedData);
    } catch (error) {
        console.error('Error analyzing intent:', error);
        res.status(500).json({ error: 'Error analyzing intent' });
    }
});

app.post('/generate-first-draft', async (req, res) => {
  const { userTask, factorChoices } = req.body;

  if (!userTask || !factorChoices) {
    return res.status(400).json({ error: 'userTask and factorChoices are required' });
  }

  const promptPath = path.join(__dirname, '../../public/data/Prompts/4first_draft_composer.prompt.md');
  let promptTemplate;

  try {
    promptTemplate = fs.readFileSync(promptPath, 'utf-8');
  } catch (error) {
    console.error('Failed to load 4first_draft_composer.prompt.md:', error);
    return res.status(500).json({ error: 'Failed to load prompt template' });
  }

  const prompt = promptTemplate
    .replace('{{USER_TASK}}', userTask)
    .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2));

  try {
    const response = await sendRequestToDeepSeek(prompt);

    if (!response.choices || response.choices.length === 0) {
      throw new Error('DeepSeek response is empty');
    }

    const draftContent = response.choices[0].message.content.trim();
    res.json({ draft: draftContent });
  } catch (error) {
    console.error('Error generating first draft:', error);
    res.status(500).json({ error: 'Failed to generate first draft' });
  }
});

// 提供 SessionData 文件的静态访问
app.get('/sessiondata/:taskId/*', (req, res) => {
    const { taskId } = req.params;
    const filePath = req.params[0]; // 获取剩余的路径部分
    
    // 从 taskId 中提取用户名（假设格式为 userName_timestamp）
    const userName = taskId.split('_')[0];
    
    const fullPath = path.join(__dirname, '../public/data/SessionData', userName, taskId, filePath);
    
    console.log('请求文件路径:', fullPath);
    
    // 检查文件是否存在
    if (!fs.existsSync(fullPath)) {
        console.error('文件不存在:', fullPath);
        return res.status(404).json({ error: '文件不存在' });
    }
    
    try {
        // 根据文件扩展名设置正确的 Content-Type
        const ext = path.extname(fullPath).toLowerCase();
        if (ext === '.json') {
            res.setHeader('Content-Type', 'application/json');
            const content = fs.readFileSync(fullPath, 'utf-8');
            res.send(content);
        } else if (ext === '.md') {
            res.setHeader('Content-Type', 'text/plain');
            const content = fs.readFileSync(fullPath, 'utf-8');
            res.send(content);
        } else {
            res.sendFile(fullPath);
        }
    } catch (error) {
        console.error('读取文件时出错:', error);
        res.status(500).json({ error: '读取文件时出错' });
    }
});

app.post('/variation-maker', async (req, res) => {
    const { draftLatest, factorChoices, intentCurrent, selectedContent } = req.body;

    // 检查请求体内容
    console.log('Request Body:', req.body);

    if (!draftLatest || !factorChoices || !intentCurrent || !selectedContent) {
        console.error('Missing required fields:', { draftLatest, factorChoices, intentCurrent, selectedContent });
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../../public/data/Prompts/variation_maker_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
        console.log('Loaded Prompt Template:', promptTemplate); // 检查模板内容
    } catch (error) {
        console.error('Failed to load variation_maker_prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // 替换占位符
    const prompt = promptTemplate
        .replace('{{Draft_LATEST}}', draftLatest || '')
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2) || '[]')
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2) || '[]')
        .replace('{{SELECTED_CONTENT}}', selectedContent || '');

    console.log('Generated Prompt for Variation Maker:', prompt); // 检查替换后的内容

    try {
        const response = await sendRequestToDeepSeek(prompt);

        if (!response.choices || response.choices.length === 0) {
            return res.status(500).json({ error: 'DeepSeek response is empty' });
        }

        const rawContent = response.choices[0].message.content.trim();
        const variations = rawContent
            .split('\n')
            .filter((line) => line.trim() !== '') // Remove empty lines
            .map((line) => {
                // Remove markdown artifacts and trim whitespace
                let cleanedLine = line.replace(/^[\s"']+|[\s"']+$/g, '').replace(/和$/, '');
                
                // Extract content up to the first sentence-ending punctuation
                // Look for ., ?, ! followed by space, quote, or end of string
                const match = cleanedLine.match(/^(.*?[.?!])(?:\s|["']|$)/);
                if (match) {
                    return match[1]; // Return the sentence without trailing punctuation context
                }
                
                // If no sentence-ending punctuation found, return the cleaned line
                return cleanedLine;
            })
            .filter((line) => line.trim() !== ''); // Remove any empty results

        res.json({ variations });
    } catch (error) {
        console.error('Error generating variations:', error);
        res.status(500).json({ error: 'Failed to generate variations' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
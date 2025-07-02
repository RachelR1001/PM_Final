const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

const geminiApiKey = 'AIzaSyDim8J8xzRTmPl1ve98-gQq8UueGZhH9s8'; // Gemini API Key
const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`;

const factorList = require('../data/PredefinedData/factor_list.json'); // 引用 factor_list.json

app.use(cors());
app.use(express.json());

const MAX_RETRIES = 3;

// 添加保存历史记录的辅助函数
function saveIntentHistory(userName, taskId, action, prev, next, source, actor) {
    const historyPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'history.json');
    
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


async function sendRequestToGemini(prompt, options = {}) {
    let retries = 0;
    const { enableThinking = false } = options; // Default to thinkingBudget: 0

    while (retries < MAX_RETRIES) {
        try {
            const requestBody = {
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    thinkingConfig: {
                        thinkingBudget: enableThinking ? 1000 : 0 
                    }
                }
            };

            console.log('Request Body:', JSON.stringify(requestBody, null, 2));

            const response = await axios.post(geminiApiEndpoint, requestBody, {
                headers: {
                    'Content-Type': 'application/json',
                }

            });

            console.log('Gemini API Response:', response.data);

            if (response.data && response.data.candidates && response.data.candidates.length > 0 &&
                response.data.candidates[0].content && response.data.candidates[0].content.parts &&
                response.data.candidates[0].content.parts.length > 0) {
                const finishReason = response.data.candidates[0].finishReason;
                if (finishReason && finishReason !== 'STOP') {
                     console.warn(`Gemini response finished with reason: ${finishReason}`);
                }
                return response.data.candidates[0].content.parts[0].text;
            } else if (response.data?.promptFeedback?.blockReason) {
                 console.error(`Gemini request blocked: ${response.data.promptFeedback.blockReason}`, response.data.promptFeedback);
                 throw new Error(`Gemini request blocked due to: ${response.data.promptFeedback.blockReason}`);
            } else {
                console.error('Invalid response structure from Gemini:', response.data);
                throw new Error('Gemini 响应结构无效');
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error?.message || error.message;
            console.error(`Gemini 请求出错（第 ${retries + 1} 次尝试）:`, errorMessage, error.response?.data);
            retries++;
            if (retries === MAX_RETRIES) throw new Error(`达到最大重试次数: ${errorMessage}`);
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
        }
    }
    throw new Error('Gemini request failed after multiple retries.');
}

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "缺少 prompt 参数" });
    try {
        const generatedText = await sendRequestToGemini(prompt);
        if (!generatedText) {
            return res.status(500).json({ error: 'Gemini 响应为空' });
        }
        res.json({ text: generatedText.trim() });
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
        const responseText = await sendRequestToGemini(prompt);
        if (!responseText) {
            return res.status(500).json({ error: 'Gemini 响应为空' });
        }

        // 移除 Markdown 格式的代码块标记
        const jsonContent = responseText.replace(/```json|```/g, ''); // 移除 ```json 和 ``` 标记

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
        // 调用 Gemini 服务生成 snippet
        const responseText = await sendRequestToGemini(prompt);
        if (!responseText) {
            throw new Error('Gemini 响应为空');
        }

        // 解析返回的 JSON 数据
        const jsonContent = responseText.replace(/```json|```/g, ''); // 移除 Markdown 格式标记
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

    const sessionDataPath = path.join(__dirname, '../data/SessionData');
    const userPath = path.join(sessionDataPath, userName);
    const taskId = `${userName}_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const taskPath = path.join(userPath, taskId);

    try {
        // 创建用户目录（如果不存在）
        if (!fs.existsSync(userPath)) {
            fs.mkdirSync(userPath, { recursive: true });
        }

        // 创建或更新 anchors.json
        const anchorsPath = path.join(userPath, 'anchors.json');
        let anchorsData = {};
        if (fs.existsSync(anchorsPath)) {
            anchorsData = JSON.parse(fs.readFileSync(anchorsPath, 'utf-8'));
        }
        // 添加新的任务记录
        anchorsData[taskId] = {
            created_iso: new Date().toISOString(),
            task_summary: userInput.substring(0, 100) // 截取前100个字符作为摘要
        };
        fs.writeFileSync(anchorsPath, JSON.stringify(anchorsData, null, 2));

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
            original_task: userInput,
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
    const factorChoicesPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'factors', 'choices.json');

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

    const promptPath = path.join(__dirname, '../data/Prompts/intent_analyzer_prompt.md');
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
    const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');

    try {
        // Enable thinking budget ONLY for intent analysis
        const responseText = await sendRequestToGemini(prompt, { enableThinking: true });

        if (!responseText) {
            console.error('Gemini 响应为空:', responseText);
            throw new Error('Gemini 响应为空');
        }

        const jsonContent = responseText.replace(/```json|```/g, ''); // Remove Markdown formatting
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
    const { userTask, factorChoices, intents, userName, taskId } = req.body;

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

    // Generate the prompt by replacing placeholders
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intents, null, 2));

    // Construct paths for 00_first.md and latest.md
    const draftsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'drafts');
    const firstDraftPath = path.join(draftsPath, '00_first.md');
    const latestDraftPath = path.join(draftsPath, 'latest.md');

    try {
        // Removed thinking budget - use default (disabled)
        const draftContent = await sendRequestToGemini(prompt);

        if (!draftContent) {
            console.error('Gemini 响应为空:', draftContent);
            throw new Error('Gemini 响应为空');
        }

        // Ensure the drafts directory exists
        if (!fs.existsSync(draftsPath)) {
            fs.mkdirSync(draftsPath, { recursive: true });
        }

        // Save the content to both 00_first.md and latest.md
        fs.writeFileSync(firstDraftPath, draftContent.trim(), 'utf-8');
        fs.writeFileSync(latestDraftPath, draftContent.trim(), 'utf-8');

        res.json({ draft: draftContent.trim() });
    } catch (error) {
        console.error('Error generating first draft:', error);
        res.status(500).json({ error: 'Error generating first draft' });
    }
});

// 提供 SessionData 文件的静态访问
app.get('/sessiondata/:taskId/*', (req, res) => {
    const { taskId } = req.params;
    const filePath = req.params[0]; // 获取剩余的路径部分
    
    // 从 taskId 中提取用户名（假设格式为 userName_timestamp）
    const userName = taskId.split('_')[0];
    
    const fullPath = path.join(__dirname, '../data/SessionData', userName, taskId, filePath);
    
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

    const promptPath = path.join(__dirname, '../data/Prompts/variation_maker_prompt.md');
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
        const responseText = await sendRequestToGemini(prompt);

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        const variations = responseText
            .split('\n')
            .filter((line) => line.trim() !== '') // Remove empty lines
            .map((line) => line.replace(/^[\s"']+|[\s"']+$/g, '').replace(/和$/, ''));

        res.json({ variations });
    } catch (error) {
        console.error('Error in Variation Maker:', error);
        res.status(500).json({ error: 'Error in Variation Maker' });
    }
});

app.post('/variation-intent-analyzer', async (req, res) => {
    const {
        draftLatest,
        factorChoices,
        intentCurrent,
        selectedContent,
        localizedRevisedContent,
        variationOptions,
        userName,
        taskId,
    } = req.body;

    if (
        !draftLatest ||
        !factorChoices ||
        !intentCurrent ||
        !selectedContent ||
        !localizedRevisedContent ||
        !variationOptions ||
        !userName ||
        !taskId
    ) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/variation_intent_analyzer.prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load variation_intent_analyzer.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // Replace placeholders in the prompt
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', draftLatest)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{LOCALIZED_REVISED_CONTENT}}', localizedRevisedContent)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{VARIATION_OPTION}}', JSON.stringify(variationOptions, null, 2))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2));

    try {
        const responseText = await sendRequestToGemini(prompt, { enableThinking: true });

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        const jsonContent = responseText.replace(/```json|```/g, ''); // Remove Markdown formatting
        const parsedData = JSON.parse(jsonContent);

        // Build the path to the intents file
        const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');

        // Read the current intents
        let currentIntents = [];
        if (fs.existsSync(intentsPath)) {
            try {
                currentIntents = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
            } catch (error) {
                console.error('Error reading current intents:', error);
                currentIntents = intentCurrent; // Use the provided intents as a fallback
            }
        } else {
            currentIntents = intentCurrent; // Use the provided intents as a fallback
        }

        // Apply the AI's edit instructions and save history
        if (Array.isArray(parsedData)) {
            parsedData.forEach((instruction) => {
                const { action, prev, next } = instruction;
                
                // 保存历史记录
                saveIntentHistory(
                    userName,
                    taskId,
                    action,
                    prev,
                    next,
                    'AI › VariationIntentAnalyzer v1',
                    'AI'
                );
                
                if (action === 'add') {
                    currentIntents.push(next);
                } else if (action === 'remove') {
                    currentIntents = currentIntents.filter(
                        (intent) => !(intent.dimension === prev.dimension && intent.value === prev.value)
                    );
                } else if (action === 'change') {
                    currentIntents = currentIntents.map((intent) =>
                        intent.dimension === prev.dimension && intent.value === prev.value ? next : intent
                    );
                }
            });
        }

        // Ensure the directory exists
        const intentsDir = path.dirname(intentsPath);
        if (!fs.existsSync(intentsDir)) {
            fs.mkdirSync(intentsDir, { recursive: true });
        }

        // Save the updated intents
        fs.writeFileSync(intentsPath, JSON.stringify(currentIntents, null, 2));

        res.json({ updatedIntents: currentIntents });
    } catch (error) {
        console.error('Error in Variation Intent Analyzer:', error);
        res.status(500).json({ error: 'Error in Variation Intent Analyzer: ' + error.message });
    }
});

app.post('/sessiondata/:taskId/drafts/latest.md', (req, res) => {
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    // Extract the username from the taskId
    const userName = taskId.split('_')[0];
    const filePath = path.join(__dirname, '../data/SessionData', userName, taskId, 'drafts', 'latest.md');

    try {
        fs.writeFileSync(filePath, content, 'utf-8');
        res.status(200).json({ message: 'Content saved successfully.' });
    } catch (error) {
        console.error('Error saving content to latest.md:', error);
        res.status(500).json({ error: 'Failed to save content.' });
    }
});

app.post('/direct-rewriter', async (req, res) => {
    const {
        draftLatest,
        factorChoices,
        intentCurrent,
        selectedContent,
        manualInstruction,
        userName,
        taskId,
    } = req.body;

    if (!draftLatest || !factorChoices || !intentCurrent || !selectedContent) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    // manualInstruction 可以为空
    if (manualInstruction === undefined) {
        manualInstruction = '';
    }

    const promptPath = path.join(__dirname, '../data/Prompts/prompt_AI_rewrite.prompt.md');
    let promptTemplate;
    try {
        // Load the prompt template
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load prompt_AI_rewrite.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // Replace placeholders in the prompt with real data
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', draftLatest)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2))
        .replace('{{USER_PROMPT}}', manualInstruction);

    try {
        // Send the prompt to the AI service
        const rewrittenVersion = await sendRequestToGemini(prompt);

        if (!rewrittenVersion) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        // Return the rewritten version to the client
        res.json({ rewrittenVersion: rewrittenVersion.trim() });
    } catch (error) {
        console.error('Error in Direct Rewriter:', error);
        res.status(500).json({ error: 'Error in Direct Rewriter: ' + error.message });
    }
});

app.post('/rewrite-intent', async (req, res) => {
    const {
        draftLatest,
        factorChoices,
        intentCurrent,
        selectedContent,
        manualInstruction,
        userName,
        taskId,
    } = req.body;

    if (!draftLatest || !factorChoices || !intentCurrent || !selectedContent || !manualInstruction || !userName || !taskId) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/prompt_AI_rewrite.prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load prompt_AI_rewrite.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // Replace placeholders in the prompt with real data
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', draftLatest)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2))
        .replace('{{USER_PROMPT}}', manualInstruction);

    const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');
    const historyPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'history.json');

    try {
        // Send the prompt to the AI service
        const responseText = await sendRequestToGemini(prompt, { enableThinking: true });

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        console.log('Raw AI Response:', responseText);

        let parsedData;
        try {
            const jsonContent = responseText.replace(/```json|```/g, ''); // Remove Markdown formatting
            parsedData = JSON.parse(jsonContent);
        } catch (error) {
            console.warn('AI response is not valid JSON. Using plain text response instead.');
            parsedData = [{ action: 'add', next: { dimension: 'custom', value: responseText.trim() } }];
        }

        // Read the current intents
        let currentIntents = [];
        if (fs.existsSync(intentsPath)) {
            try {
                currentIntents = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
            } catch (error) {
                console.error('Error reading current intents:', error);
                currentIntents = intentCurrent; // Use the provided intents as a fallback
            }
        } else {
            currentIntents = intentCurrent; // Use the provided intents as a fallback
        }

        // Apply the AI's edit instructions and save history
        if (Array.isArray(parsedData)) {
            parsedData.forEach((instruction) => {
                const { action, prev, next } = instruction;

                // Log the change to history.json
                saveIntentHistory(
                    userName,
                    taskId,
                    action,
                    prev,
                    next,
                    'AI › RewriteIntentAnalyzer v1',
                    'AI'
                );

                if (action === 'add') {
                    currentIntents.push(next);
                } else if (action === 'remove') {
                    currentIntents = currentIntents.filter(
                        (intent) => !(intent.dimension === prev.dimension && intent.value === prev.value)
                    );
                } else if (action === 'change') {
                    currentIntents = currentIntents.map((intent) =>
                        intent.dimension === prev.dimension && intent.value === prev.value ? next : intent
                    );
                }
            });
        }

        // Ensure the directory exists
        const intentsDir = path.dirname(intentsPath);
        if (!fs.existsSync(intentsDir)) {
            fs.mkdirSync(intentsDir, { recursive: true });
        }

        // Save the updated intents
        fs.writeFileSync(intentsPath, JSON.stringify(currentIntents, null, 2));

        res.json({ updatedIntents: currentIntents });
    } catch (error) {
        console.error('Error in Rewrite Intent:', error);
        res.status(500).json({ error: 'Error in Rewrite Intent: ' + error.message });
    }
});

app.post('/selective-aspect-rewriter', async (req, res) => {
    const { userTask, draftLatest, factorChoices, intentCurrent, selectedContent, aspectsListJson, aspectsSelectionJson, userPrompt } = req.body;

    const promptPath = path.join(__dirname, '../data/Prompts/selective_aspect_rewriter.prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('加载 prompt 文件失败:', error);
        return res.status(500).json({ error: '加载 prompt 文件失败' });
    }

    // 替换占位符
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent))
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{ASPECTS_LIST_JSON}}', JSON.stringify(aspectsListJson))
        .replace('{{ASPECTS_SELECTION_JSON}}', JSON.stringify(aspectsSelectionJson))
        .replace('{{USER_PROMPT}}', userPrompt);

    try {
        // 调用 AI 服务
        const rewrittenVersion = await sendRequestToGemini(prompt);

        if (!rewrittenVersion) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        res.json({ rewrittenVersion: rewrittenVersion.trim() });
    } catch (error) {
        console.error('Error in Selective Aspect Rewriter:', error);
        res.status(500).json({ error: 'Error in Selective Aspect Rewriter' });
    }
});

app.post('/aspect-intent-analyzer', async (req, res) => {
    const {
        userTask,
        draftLatest,
        factorChoices,
        intentCurrent,
        selectedContent,
        aspectsSelectionJson,
        userName,
        taskId,
    } = req.body;

    if (
        !userTask ||
        !draftLatest ||
        !factorChoices ||
        !intentCurrent ||
        !selectedContent ||
        !aspectsSelectionJson ||
        !userName ||
        !taskId
    ) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/selective_aspect_rewriter.prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load selective_aspect_rewriter.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2))
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{ASPECTS_SELECTION_JSON}}', JSON.stringify(aspectsSelectionJson));

    const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');

    try {
        // Enable thinking budget for this request
        const responseText = await sendRequestToGemini(prompt, { enableThinking: true });

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        console.log('Raw AI Response:', responseText);

        let parsedData;
        try {
            const jsonContent = responseText.replace(/```json|```/g, ''); // Remove Markdown formatting
            parsedData = JSON.parse(jsonContent);
        } catch (error) {
            console.warn('AI response is not valid JSON. Using plain text response instead.');
            parsedData = [{ action: 'add', next: { dimension: 'custom', value: responseText.trim() } }];
        }

        let currentIntents = [];
        if (fs.existsSync(intentsPath)) {
            try {
                currentIntents = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
            } catch (error) {
                console.error('Error reading current intents:', error);
            }
        }

        if (Array.isArray(parsedData)) {
            parsedData.forEach((instruction) => {
                const { action, prev, next } = instruction;

                saveIntentHistory(
                    userName,
                    taskId,
                    action,
                    prev,
                    next,
                    'AI › AspectIntentAnalyzer v1',
                    'AI'
                );

                if (action === 'add') {
                    currentIntents.push(next);
                } else if (action === 'remove') {
                    currentIntents = currentIntents.filter(
                        (intent) => !(intent.dimension === prev.dimension && intent.value === prev.value)
                    );
                } else if (action === 'change') {
                    currentIntents = currentIntents.map((intent) =>
                        intent.dimension === prev.dimension && intent.value === prev.value ? next : intent
                    );
                }
            });
        }

        const intentsDir = path.dirname(intentsPath);
        if (!fs.existsSync(intentsDir)) {
            fs.mkdirSync(intentsDir, { recursive: true });
        }

        fs.writeFileSync(intentsPath, JSON.stringify(currentIntents, null, 2));

        res.json({ updatedIntents: currentIntents });
    } catch (error) {
        console.error('Error in Aspect Intent Analyzer:', error);
        res.status(500).json({ error: 'Error in Aspect Intent Analyzer: ' + error.message });
    }
});

// ... existing code ...

// 手动更新 intent 的接口
app.post('/sessiondata/:taskId/intents/manual-update', (req, res) => {
    const { taskId } = req.params;
    const { updatedIntent, prevIntent } = req.body; // 从请求体中获取更新后的 intent 和之前的 intent
    const userName = taskId.split('_')[0]; // 假设 taskId 格式为 userName_timestamp

    // 构建文件路径
    const intentsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'current.json');
    const historyPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'intents', 'history.json');

    try {
        // 更新 current.json
        let currentIntents = [];
        if (fs.existsSync(intentsPath)) {
            currentIntents = JSON.parse(fs.readFileSync(intentsPath, 'utf-8'));
        }

        // 查找并更新对应的 intent
        const updatedIntents = currentIntents.map((intent) =>
            intent.dimension === prevIntent.dimension && intent.value === prevIntent.value
                ? updatedIntent
                : intent
        );

        // 保存到 current.json
        fs.writeFileSync(intentsPath, JSON.stringify(updatedIntents, null, 2), 'utf-8');

        // 更新 history.json
        let history = [];
        if (fs.existsSync(historyPath)) {
            history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
        }

        const historyEntry = {
            ts: new Date().toISOString(),
            action: 'manual-update',
            prev: prevIntent,
            next: updatedIntent,
            source: 'userUI > manual',
            actor: 'user',
        };

        history.push(historyEntry);

        // 保存到 history.json
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');

        res.status(200).json({ message: 'Intent updated successfully.' });
    } catch (error) {
        console.error('Error updating intent:', error);
        res.status(500).json({ error: 'Failed to update intent.' });
    }
});

// ... existing code ...

// Regenerate Draft 接口
app.post('/regenerate-draft', async (req, res) => {
    const { taskId, userTask, factorChoices, intentCurrent, userName } = req.body;

    if (!taskId || !userTask || !factorChoices || !intentCurrent || !userName) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/email_regenerator.prompt.md');
    const draftsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'drafts');
    const latestDraftPath = path.join(draftsPath, 'latest.md');

    let promptTemplate;
    try {
        // 读取 prompt 文件
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load email_regenerator.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // 替换占位符生成 prompt
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', userTask)
        .replace('{{DRAFT_LATEST}}', fs.existsSync(latestDraftPath) ? fs.readFileSync(latestDraftPath, 'utf-8') : '')
        .replace('{{FACTOR_CHOICES}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2))
        .replace('{{INTENT_HISTORY}}', '[]'); // 可扩展为实际历史记录

    try {
        // 调用 AI 服务生成草稿
        const draftContent = await sendRequestToGemini(prompt);

        if (!draftContent) {
            throw new Error('AI response is empty');
        }

        // 确保 drafts 目录存在
        if (!fs.existsSync(draftsPath)) {
            fs.mkdirSync(draftsPath, { recursive: true });
        }

        // 保存到 latest.md
        fs.writeFileSync(latestDraftPath, draftContent.trim(), 'utf-8');

        // 按次序创建类似 01_draft.md 的文件
        const draftFiles = fs.readdirSync(draftsPath).filter((file) => file.match(/^\d+_draft\.md$/));
        const nextDraftNumber = draftFiles.length + 1;
        const nextDraftPath = path.join(draftsPath, `${String(nextDraftNumber).padStart(2, '0')}_draft.md`);
        fs.writeFileSync(nextDraftPath, draftContent.trim(), 'utf-8');

        res.status(200).json({ message: 'Draft regenerated successfully.', draft: draftContent.trim() });
    } catch (error) {
        console.error('Error regenerating draft:', error);
        res.status(500).json({ error: 'Failed to regenerate draft.' });
    }
});

app.post('/generate-anchor-builder', async (req, res) => {
    const { userTask, userName, taskId } = req.body;

    if (!userTask || !userName || !taskId) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/anchor_builder.prompt.md');
    const anchorFilePath = path.join(__dirname, '../data/SessionData', userName, taskId, 'anchors.json');

    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load anchor_builder.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    const prompt = promptTemplate.replace('{{USER_TASK}}', userTask);

    try {
        const responseText = await sendRequestToGemini(prompt,  { enableThinking: true });

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        // Parse the response into JSON format
        const sanitizedContent = responseText.replace(/```json|```/g, ''); // Remove Markdown-style code block delimiters
        let anchorData;
        try {
            anchorData = JSON.parse(sanitizedContent);
        } catch (error) {
            console.error('Failed to parse AI response as JSON:', error);
            return res.status(500).json({ error: 'Failed to parse AI response as JSON' });
        }

        // Ensure the directory exists
        const anchorDir = path.dirname(anchorFilePath);
        if (!fs.existsSync(anchorDir)) {
            fs.mkdirSync(anchorDir, { recursive: true });
        }

        // Write the anchor data to anchors.json
        try {
            fs.writeFileSync(anchorFilePath, JSON.stringify(anchorData, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to write to anchors.json:', error);
            return res.status(500).json({ error: 'Failed to write to anchors.json' });
        }

        res.json({ message: 'Anchor content saved successfully.', anchorData });
    } catch (error) {
        console.error('Error in Anchor Builder generation:', error);
        res.status(500).json({ error: 'Error in Anchor Builder generation' });
    }
});

app.post('/api/update-anchor', (req, res) => {
    const { type, title, description, userName, taskId } = req.body;

    if (!type || !title || !description || !userName || !taskId) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const anchorFilePath = path.join(__dirname, '../data/SessionData', userName, taskId, 'anchors.json');

    try {
        // Read the existing anchor.json file
        let anchorData = {};
        if (fs.existsSync(anchorFilePath)) {
            const fileContent = fs.readFileSync(anchorFilePath, 'utf-8');
            anchorData = JSON.parse(fileContent);
        }

        // Update the relevant section (persona or situation)
        anchorData[type] = { title, description };

        // Write the updated data back to the file
        fs.writeFileSync(anchorFilePath, JSON.stringify(anchorData, null, 2), 'utf-8');

        res.json({ message: `${type} Anchor updated successfully.` });
    } catch (error) {
        console.error('Failed to update anchor.json:', error);
        res.status(500).json({ error: 'Failed to update anchor.json' });
    }
});

app.post('/api/regenerate-anchor', async (req, res) => {
    const { userName, taskId, anchorType, userPrompt } = req.body;

    if (!userName || !taskId || !anchorType || !userPrompt) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/anchor_editor.prompt.md');
    const anchorFilePath = path.join(__dirname, '../data/SessionData', userName, taskId, 'anchors.json');

    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load anchor_editor.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // Read the current anchor data
    let anchorData = {};
    try {
        if (fs.existsSync(anchorFilePath)) {
            const fileContent = fs.readFileSync(anchorFilePath, 'utf-8');
            anchorData = JSON.parse(fileContent);
        }
    } catch (error) {
        console.error('Failed to read anchors.json:', error);
        return res.status(500).json({ error: 'Failed to read anchors.json' });
    }

    const currentAnchor = anchorData[anchorType] || { title: '', description: '' };

    // Replace placeholders in the prompt
    const prompt = promptTemplate
        .replace('{{USER_TASK}}', taskId) // Assuming taskId represents the user task
        .replace('{{DRAFT_LATEST}}', '') // Replace with actual draft content if available
        .replace('{{INTENT_CURRENT}}', '[]') // Replace with actual intent pairs if available
        .replace('{{CURRENT_ANCHOR}}', JSON.stringify(currentAnchor, null, 2))
        .replace('{{USER_PROMPT}}', userPrompt);

    try {
        const responseText = await sendRequestToGemini(prompt);

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        // Parse the AI response
        const sanitizedContent = responseText.replace(/```json|```/g, ''); // Remove Markdown-style code block delimiters
        let updatedAnchor;
        try {
            updatedAnchor = JSON.parse(sanitizedContent);
        } catch (error) {
            console.error('Failed to parse AI response as JSON:', error);
            return res.status(500).json({ error: 'Failed to parse AI response as JSON' });
        }

        // Update the anchor data
        anchorData[anchorType] = updatedAnchor;

        // Write the updated data back to the file
        try {
            fs.writeFileSync(anchorFilePath, JSON.stringify(anchorData, null, 2), 'utf-8');
        } catch (error) {
            console.error('Failed to write to anchors.json:', error);
            return res.status(500).json({ error: 'Failed to write to anchors.json' });
        }

        res.json({ message: `${anchorType} Anchor regenerated successfully.`, updatedAnchor });
    } catch (error) {
        console.error('Error in Anchor Regeneration:', error);
        res.status(500).json({ error: 'Error in Anchor Regeneration' });
    }
});

app.get('/api/anchors/:userName', (req, res) => {
    const { userName } = req.params;
    const userPath = path.join(__dirname, '../data/SessionData', userName);

    if (!fs.existsSync(userPath)) {
        return res.status(404).json({ error: `User directory not found for ${userName}` });
    }

    try {
        const taskDirs = fs.readdirSync(userPath).filter((dir) => {
            const taskPath = path.join(userPath, dir);
            return fs.statSync(taskPath).isDirectory();
        });

        const aggregatedAnchors = { persona: {}, situation: {} };

        taskDirs.forEach((taskId) => {
            const anchorPath = path.join(userPath, taskId, 'anchors.json');
            if (fs.existsSync(anchorPath)) {
                try {
                    const anchorData = JSON.parse(fs.readFileSync(anchorPath, 'utf-8'));
                    if (anchorData.persona) {
                        Object.keys(anchorData.persona).forEach((key) => {
                            aggregatedAnchors.persona[key] = anchorData.persona[key];
                        });
                    }
                    if (anchorData.situation) {
                        Object.keys(anchorData.situation).forEach((key) => {
                            aggregatedAnchors.situation[key] = anchorData.situation[key];
                        });
                    }
                } catch (error) {
                    console.error(`Error reading or parsing ${anchorPath}:`, error);
                }
            }
        });

        res.json(aggregatedAnchors);
    } catch (error) {
        console.error('Error aggregating anchors:', error);
        res.status(500).json({ error: 'Failed to aggregate anchors.' });
    }
});

app.post('/generate-contextual-draft', async (req, res) => {
    const { personaAnchor, situationAnchor, writingSample, taskId, userName } = req.body;

    // 检查必要字段是否存在
    if (!taskId || !userName) {
        return res.status(400).json({ error: 'Missing required fields: taskId or userName' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/contextual_first_draft_composer.prompt.md');
    let promptTemplate;

    try {
        // 读取 prompt 模板文件
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load contextual_first_draft_composer.prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    // 替换占位符
    const prompt = promptTemplate
        .replace('{{PERSONA_ANCHOR}}', personaAnchor || '')
        .replace('{{SITUATION_ANCHOR}}', situationAnchor || '')
        .replace('{{WRITING_SAMPLE}}', writingSample || '')
        .replace('{{USER_TASK}}', ''); // 如果有 userTask，可以替换此处

    try {
        // 调用 Gemini 服务生成草稿
        const draftContent = await sendRequestToGemini(prompt);

        if (!draftContent) {
            throw new Error('AI response is empty');
        }

        // 保存草稿到对应的 taskId
        const draftsPath = path.join(__dirname, '../data/SessionData', userName, taskId, 'drafts');
        const latestDraftPath = path.join(draftsPath, 'latest.md');

        // 确保 drafts 目录存在
        if (!fs.existsSync(draftsPath)) {
            fs.mkdirSync(draftsPath, { recursive: true });
        }

        // 保存到 latest.md
        fs.writeFileSync(latestDraftPath, draftContent.trim(), 'utf-8');

        // 保存到新的草稿文件（例如 01_draft.md, 02_draft.md 等）
        const draftFiles = fs.readdirSync(draftsPath).filter((file) => file.match(/^\d+_draft\.md$/));
        const nextDraftNumber = draftFiles.length + 1;
        const nextDraftPath = path.join(draftsPath, `${String(nextDraftNumber).padStart(2, '0')}_draft.md`);
        fs.writeFileSync(nextDraftPath, draftContent.trim(), 'utf-8');

        res.status(200).json({ draft: draftContent.trim() });
    } catch (error) {
        console.error('Error generating contextual draft:', error);
        res.status(500).json({ error: 'Failed to generate contextual draft.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
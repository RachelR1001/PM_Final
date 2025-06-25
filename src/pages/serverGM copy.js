const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3001;

const geminiApiKey = 'AIzaSyDXvd4T2bsK0cV2bTYbHiR5guCKFDe3g1M'; // Gemini API Key
const geminiApiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${geminiApiKey}`;

const factorList = require('../data/PredefinedData/factor_list.json'); // 引用 factor_list.json

app.use(cors());
app.use(express.json());

const MAX_RETRIES = 3;

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

    if (!draftLatest || !factorChoices || !intentCurrent || !selectedContent) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/variation_maker_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load variation_maker_prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    const prompt = promptTemplate
        .replace('{{Draft_LATEST}}', draftLatest)
        .replace('{{factor_choices}}', JSON.stringify(factorChoices, null, 2))
        .replace('{{intent_current}}', JSON.stringify(intentCurrent, null, 2))
        .replace('{{selected_content}}', selectedContent);

    try {
        const responseText = await sendRequestToGemini(prompt);

        if (!responseText) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        const variations = responseText
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

        // Apply the AI's edit instructions
        if (Array.isArray(parsedData)) {
            parsedData.forEach((instruction) => {
                const { action, prev, next } = instruction;
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
    const { draftLatest, factorChoices, intentCurrent, selectedContent, manualInstruction } = req.body;

    if (!draftLatest || !factorChoices || !intentCurrent || !selectedContent || !manualInstruction) {
        return res.status(400).json({ error: 'Missing required fields in the request body' });
    }

    const promptPath = path.join(__dirname, '../data/Prompts/direct_revision_intent_analyzer_prompt.md');
    let promptTemplate;
    try {
        promptTemplate = fs.readFileSync(promptPath, 'utf-8');
    } catch (error) {
        console.error('Failed to load direct_revision_intent_analyzer_prompt.md:', error);
        return res.status(500).json({ error: 'Failed to load prompt template' });
    }

    const prompt = promptTemplate
        .replace('{{USER_TASK}}', draftLatest)
        .replace('{{DRAFT_LATEST}}', draftLatest)
        .replace('{{SELECTED_CONTENT}}', selectedContent)
        .replace('{{LOCALIZED_REVISED_CONTENT}}', manualInstruction)
        .replace('{{INTENT_CURRENT}}', JSON.stringify(intentCurrent, null, 2));

    try {
        // Removed thinking budget - use default (disabled)
        const rewrittenVersion = await sendRequestToGemini(prompt);

        if (!rewrittenVersion) {
            return res.status(500).json({ error: 'AI response is empty' });
        }

        res.json({ rewrittenVersion: rewrittenVersion.trim() });
    } catch (error) {
        console.error('Error in Direct Rewriter:', error);
        res.status(500).json({ error: 'Error in Direct Rewriter' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
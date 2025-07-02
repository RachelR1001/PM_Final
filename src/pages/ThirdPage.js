import React, { useMemo, useState, useEffect } from 'react';
import { createEditor, Editor, Transforms, Text } from 'slate';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { Row, Col, Card, Typography, Tag, Menu, Dropdown, Modal, Radio, message, Spin, Checkbox, Input, Button, Alert, List } from 'antd';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import aspectsList from '../data/PredefinedData/aspects_list.json';
import { EditOutlined, SaveOutlined } from '@ant-design/icons';

const { Title, Text: AntText } = Typography;

// 辅助函数 - 移到组件外部，在使用前定义
const toggleFormat = (editor, format) => {
    const isActive = isFormatActive(editor, format);

    if (isActive) {
        Editor.removeMark(editor, format);
    } else {
        Editor.addMark(editor, format, true);
    }
};

// 辅助函数 - 检查文本格式是否激活
const isFormatActive = (editor, format) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
};

// 辅助函数 - 切换块级元素
const toggleBlock = (editor, format) => {
    const isActive = isBlockActive(editor, format);
    const isList = ['numbered-list', 'bulleted-list'].includes(format);

    Transforms.unwrapNodes(editor, {
        match: n => ['numbered-list', 'bulleted-list'].includes(n.type),
        split: true,
    });

    Transforms.setNodes(editor, {
        type: isActive ? 'paragraph' : isList ? 'list-item' : format,
    });

    if (!isActive && isList) {
        const block = { type: format, children: [] };
        Transforms.wrapNodes(editor, block);
    }
};

// 辅助函数 - 检查块级元素是否激活
const isBlockActive = (editor, format) => {
    const [match] = Editor.nodes(editor, {
        match: n => n.type === format,
    });

    return !!match;
};

// 安全的节点内容提取函数
const getNodeText = (editor, node) => {
    try {
        // 检查节点是否有效
        if (!node || typeof node !== 'object') {
            return '';
        }
        
        // 如果节点有 children 属性且是数组
        if (node.children && Array.isArray(node.children)) {
            return node.children.map(child => {
                if (typeof child === 'string') {
                    return child;
                } else if (child && typeof child === 'object' && child.text !== undefined) {
                    return child.text;
                } else if (child && child.children) {
                    return getNodeText(editor, child);
                }
                return '';
            }).join('');
        }
        
        // 如果节点直接有 text 属性
        if (node.text !== undefined) {
            return node.text;
        }
        
        return '';
    } catch (error) {
        console.error('Error processing node:', node, error);
        return '';
    }
};

// 工具栏按钮组件
const ToolbarButton = ({ format, children, isActive, onMouseDown }) => {
    return (
        <button
            onMouseDown={onMouseDown}
            style={{
                padding: '8px 12px',
                border: '1px solid #d9d9d9',
                background: isActive ? '#1890ff' : '#fff',
                color: isActive ? '#fff' : '#000',
                cursor: 'pointer',
                borderRadius: '4px',
                marginRight: '4px',
                fontSize: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                minWidth: '32px',
                justifyContent: 'center',
            }}
        >
            {children}
        </button>
    );
};

// 工具栏组件
const Toolbar = () => {
    const editor = useSlate();

    return (
        <div style={{
            padding: '8px',
            borderBottom: '1px solid #d9d9d9',
            background: '#fafafa',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
        }}>
            {/* 文本格式按钮 */}
            <ToolbarButton
                format="bold"
                isActive={isFormatActive(editor, 'bold')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleFormat(editor, 'bold');
                }}
            >
                <strong>B</strong>
            </ToolbarButton>
            
            <ToolbarButton
                format="italic"
                isActive={isFormatActive(editor, 'italic')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleFormat(editor, 'italic');
                }}
            >
                <em>I</em>
            </ToolbarButton>
            
            <ToolbarButton
                format="underline"
                isActive={isFormatActive(editor, 'underline')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleFormat(editor, 'underline');
                }}
            >
                <u>U</u>
            </ToolbarButton>

            <div style={{ width: '1px', height: '24px', background: '#d9d9d9', margin: '0 8px' }} />

            {/* 块级元素按钮 */}
            <ToolbarButton
                format="heading-one"
                isActive={isBlockActive(editor, 'heading-one')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, 'heading-one');
                }}
            >
                H1
            </ToolbarButton>
            
            <ToolbarButton
                format="heading-two"
                isActive={isBlockActive(editor, 'heading-two')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, 'heading-two');
                }}
            >
                H2
            </ToolbarButton>
            
            <ToolbarButton
                format="paragraph"
                isActive={isBlockActive(editor, 'paragraph')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, 'paragraph');
                }}
            >
                P
            </ToolbarButton>

            <div style={{ width: '1px', height: '24px', background: '#d9d9d9', margin: '0 8px' }} />

            {/* 列表按钮 */}
            <ToolbarButton
                format="bulleted-list"
                isActive={isBlockActive(editor, 'bulleted-list')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, 'bulleted-list');
                }}
            >
                • List
            </ToolbarButton>
            
            <ToolbarButton
                format="numbered-list"
                isActive={isBlockActive(editor, 'numbered-list')}
                onMouseDown={(event) => {
                    event.preventDefault();
                    toggleBlock(editor, 'numbered-list');
                }}
            >
                1. List
            </ToolbarButton>
        </div>
    );
};

const ThirdPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { userName, userTask, taskId } = location.state || {};

    const editor = useMemo(() => withReact(createEditor()), []);
    
    // 设置一个稳定的初始值
    const initialValue = useMemo(() => [
        {
            type: 'paragraph',
            children: [{ text: '' }],
        },
    ], []);

    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(true);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [variationOptions, setVariationOptions] = useState([]);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isLoadingVariations, setIsLoadingVariations] = useState(false);
    const [isDirectRewriterModalVisible, setIsDirectRewriterModalVisible] = useState(false);
    const [manualInstruction, setManualInstruction] = useState('');
    const [rewrittenVersion, setRewrittenVersion] = useState('');
    const [isLoadingRewrittenVersion, setIsLoadingRewrittenVersion] = useState(false);
    const [intents, setIntents] = useState([]);
    const [isSelectiveAspectRewriterModalVisible, setIsSelectiveAspectRewriterModalVisible] = useState(false);
    const [aspectsKeep, setAspectsKeep] = useState([]);
    const [aspectsChange, setAspectsChange] = useState([]);
    const [editingIndex, setEditingIndex] = useState(null); // 当前正在编辑的 intent 索引
    const [editingValue, setEditingValue] = useState(''); // 当前编辑的值
    const [directRewriterLoading, setDirectRewriterLoading] = useState(false);
    const [selectiveAspectLoading, setSelectiveAspectLoading] = useState(false);
    const [editorKey, setEditorKey] = useState(0); // 添加一个状态变量
    const [isLoadingSaveAndGenerate, setIsLoadingSaveAndGenerate] = useState(false);

    // Function to handle right-click
    const handleContextMenu = (event) => {
        event.preventDefault();

        // Get the selected text
        const selection = window.getSelection();
        console.log('Selection:', selection); // Debug log
        const selectedText = selection.toString();
        console.log('Selected Text:', selectedText); // Debug log

        if (selectedText) {
            setSelectedText(selectedText);
        }
    };

    // Menu for the context menu
    const menu = (
        <Menu
            onClick={({ key }) => handleMenuClick(key)}
            items={[
                { key: 'Variation Maker', label: 'Variation Maker' },
                { key: 'Direct-Rewrite Agent', label: 'Direct-Rewrite Agent' },
                { key: 'Selective Aspect Rewriter', label: 'Selective Aspect Rewriter' },
            ]}
        />
    );

    // Function to handle menu option clicks
    const handleMenuClick = async (option) => {
        if (option === 'Variation Maker') {
            setIsModalVisible(true);
            setIsLoadingVariations(true);

            if (!value || !Array.isArray(value) || value.length === 0) {
                message.error('Editor content is invalid or empty.');
                setIsLoadingVariations(false);
                return;
            }

            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            const factorChoices = await getFactorChoices();
            const intentCurrent = await getIntentCurrent();

            console.log('Request Data for Variation Maker:', {
                draftLatest,
                factorChoices,
                intentCurrent,
                selectedContent: selectedText,
            });

            try {
                const response = await axios.post('http://localhost:3001/variation-maker', {
                    draftLatest,
                    factorChoices,
                    intentCurrent,
                    selectedContent: selectedText,
                });

                if (response.data && response.data.variations) {
                    const rawVariations = response.data.variations;
                    const parsedVariations = rawVariations
                        .filter((line) =>
                            line.trim() &&
                            !line.startsWith('```') &&
                            line.trim() !== '[' &&
                            line.trim() !== ']'
                        )
                        .map((line) => line.replace(/^[\s"']+|[\s"']+$/g, '').replace(/和$/, ''));

                    setVariationOptions(parsedVariations);
                } else {
                    message.error('Failed to fetch variations. Please try again.');
                }
            } catch (error) {
                console.error('Error fetching variations:', error);
                message.error('Error fetching variations. Please try again.');
            } finally {
                setIsLoadingVariations(false);
            }
        } else if (option === 'Direct-Rewrite Agent') {
            setIsDirectRewriterModalVisible(true);
            setRewrittenVersion(''); // Clear previous rewritten version
            setManualInstruction(''); // Clear previous manual instruction
        } else if (option === 'Selective Aspect Rewriter') {
            setIsSelectiveAspectRewriterModalVisible(true);
            setAspectsKeep([]);
            setAspectsChange([]);
            setManualInstruction('');
            setRewrittenVersion('');
        }
    };

    // Function to get factor choices from the backend
    const getFactorChoices = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/sessiondata/${taskId}/factors/choices.json`);
            return response.data; // Return the JSON data
        } catch (error) {
            console.error('Error fetching factor choices:', error);
            message.error('Failed to fetch factor choices. Please try again.');
            return []; // Return an empty array as a fallback
        }
    };

    // Function to get current intents from the backend
    const getIntentCurrent = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/sessiondata/${taskId}/intents/current.json`);
            return response.data; // Return the JSON data
        } catch (error) {
            console.error('Error fetching current intents:', error);
            message.error('Failed to fetch current intents. Please try again.');
            return []; // Return an empty array as a fallback
        }
    };

    // Function to handle modal confirm for Variation Maker
    const handleModalConfirm = async () => {
        console.log('handleModalConfirm triggered'); // Debug log

        if (!selectedOption) {
            message.error('Please select a variation before confirming.');
            return;
        }

        // Replace the selected text in the editor with the chosen variation
        const { selection } = editor;
        if (selection && selectedText) {
            try {
                if (Editor.string(editor, selection) === selectedText) {
                    Transforms.delete(editor, { at: selection });
                    Transforms.insertText(editor, selectedOption, { at: selection.anchor });
                } else {
                    Transforms.insertText(editor, selectedOption);
                }
            } catch (transformError) {
                console.warn('Error replacing text in editor:', transformError);
                Transforms.insertText(editor, selectedOption); // Fallback
            }
        }

        message.success('Text replaced in the editor.');

        // Close the modal immediately
        handleModalClose();

        // Run the variation-intent-analyzer API call in the background
        try {
            const factorChoices = await getFactorChoices();
            const intentCurrent = await getIntentCurrent();

            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            const requestData = {
                draftLatest,
                factorChoices,
                intentCurrent,
                selectedContent: selectedText,
                localizedRevisedContent: selectedOption,
                variationOptions,
                userName,
                taskId,
            };

            console.log('Sending request to /variation-intent-analyzer with data:', requestData);

            // Asynchronous API call
            axios.post('http://localhost:3001/variation-intent-analyzer', requestData)
                .then((response) => {
                    if (response.data && response.data.updatedIntents) {
                        setIntents(response.data.updatedIntents); // Update intents in the state
                        message.success('Intents updated successfully in the background.');
                    } else {
                        message.error('Failed to update intents in the background.');
                    }
                })
                .catch((error) => {
                    console.error('Error during background variation-intent-analyzer call:', error);
                    message.error('An error occurred while updating intents in the background.');
                });
        } catch (error) {
            console.error('Error preparing data for variation-intent-analyzer:', error);
            message.error('Failed to prepare data for background intent analysis.');
        }
    };

    // Function to handle modal close
    const handleModalClose = () => {
        setIsModalVisible(false);
        setVariationOptions([]);
        setSelectedOption(null);
    };

    // Function to handle radio selection
    const handleOptionChange = (e) => {
        setSelectedOption(e.target.value);
    };

    // Function to handle rewrite request
    const handleRewrite = async () => {
        setIsLoadingRewrittenVersion(true);

        try {
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            const requestData = {
                draftLatest: draftLatest || '', // 确保非空
                factorChoices: (await getFactorChoices()) || [], // 确保非空
                intentCurrent: intents || [], // 确保非空
                selectedContent: selectedText || '', // 确保非空
                manualInstruction: manualInstruction.trim() || '', // 允许为空
                userName: userName || 'unknown', // 确保非空
                taskId: taskId || 'unknown', // 确保非空
            };

            const response = await axios.post('http://localhost:3001/direct-rewriter', requestData);

            if (response.data && response.data.rewrittenVersion) {
                setRewrittenVersion(response.data.rewrittenVersion.trim());
                message.success('Rewritten version generated successfully.');
            } else {
                message.error('Failed to generate rewritten version. Please try again.');
            }
        } catch (error) {
            console.error('Error in handleRewrite:', error);
            message.error('Error in handleRewrite. Please try again.');
        } finally {
            setIsLoadingRewrittenVersion(false);
        }
    };

    // Function to fetch intents from current.json
    const fetchIntents = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/sessiondata/${taskId}/intents/current.json`);
            setIntents(response.data || []); // Set the fetched intents
        } catch (error) {
            console.error('Error fetching intents:', error);
            message.error('Failed to fetch intents. Please try again.');
        }
    };

    // Function to save updated intents to current.json and history.json
    const saveIntent = async (index, updatedValue) => {
        try {
            // 确保 taskId 存在
            if (!taskId) {
                throw new Error('Task ID is missing.');
            }

            // 获取当前 intent 和更新后的 intent
            const prevIntent = intents[index];
            const updatedIntent = { ...prevIntent, value: updatedValue };

            // 调用后端接口
            await axios.post(`http://localhost:3001/sessiondata/${taskId}/intents/manual-update`, {
                prevIntent,
                updatedIntent,
            });

            // 更新前端状态
            const updatedIntents = [...intents];
            updatedIntents[index] = updatedIntent;
            setIntents(updatedIntents);

            message.success('Intent updated successfully.');
        } catch (error) {
            console.error('Error saving intent:', error);
            message.error('Failed to save intent. Please try again.');
        }
    };

    // Placeholder for Regenerate Draft button click
    const handleRegenerateDraft = async () => {
        try {
            const response = await axios.post('http://localhost:3001/regenerate-draft', {
                taskId,
                userTask,
                factorChoices: await getFactorChoices(),
                intentCurrent: intents,
                userName,
            });

            if (response.data && response.data.draft) {
                message.success('Draft regenerated successfully.');

                console.log('Regenerated draft:', response.data.draft); // 调试日志
                await loadLatestDraft(); // 确保调用
            } else {
                message.error('Failed to regenerate draft. Please try again.');
            }
        } catch (error) {
            console.error('Error regenerating draft:', error);
            message.error('Failed to regenerate draft. Please try again.');
        }
    };

    // Function to handle edit icon click
    const handleEdit = (index) => {
        setEditingIndex(index);
        setEditingValue(intents[index].value); // Set the current value for editing
    };

    // Function to handle save icon click
    const handleSave = (index) => {
        saveIntent(index, editingValue); // Save the updated value to current.json and history.json
        setEditingIndex(null); // Exit editing mode
        setEditingValue(''); // Clear editing value
    };

    // Fetch intents when the component mounts or taskId changes
    useEffect(() => {
        if (taskId) {
            fetchIntents();
        }
    }, [taskId]);

    // 动态加载草稿内容
    useEffect(() => {
        const fetchDraft = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`);
                console.log(response.data);
                const draftContent = response.data || 'No content available.';
                
                // 更好的内容解析逻辑
                const slateContent = draftContent
                    .split('\n\n') // 按段落分割
                    .filter(paragraph => paragraph.trim()) // 过滤空段落
                    .map((paragraph) => ({
                        type: 'paragraph',
                        children: [{ text: paragraph.trim() }],
                    }));

                // 确保至少有一个段落
                if (slateContent.length === 0) {
                    slateContent.push({
                        type: 'paragraph',
                        children: [{ text: 'No content available.' }],
                    });
                }

                setValue(slateContent);
                setContentLoaded(true);
            } catch (error) {
                console.error('Failed to load draft:', error);
                setValue([
                    {
                        type: 'paragraph',
                        children: [{ text: 'Failed to load content.' }],
                    },
                ]);
                setContentLoaded(true);
            } finally {
                setLoading(false);
            }
        };

        if (taskId) {
            fetchDraft();
        } else {
            // 如果没有 taskId，显示默认内容
            setValue([
                {
                    type: 'paragraph',
                    children: [{ text: 'No task selected.' }],
                },
            ]);
            setContentLoaded(true);
            setLoading(false);
        }
    }, [taskId]);

    // 自定义渲染函数，用于处理富文本样式和块级元素
    const renderElement = ({ attributes, children, element }) => {
        switch (element.type) {
            case 'heading-one':
                return <h1 {...attributes}>{children}</h1>;
            case 'heading-two':
                return <h2 {...attributes}>{children}</h2>;
            case 'bulleted-list':
                return <ul {...attributes}>{children}</ul>;
            case 'numbered-list':
                return <ol {...attributes}>{children}</ol>;
            case 'list-item':
                return <li {...attributes}>{children}</li>;
            default:
                return <p {...attributes}>{children}</p>;
        }
    };

    const renderLeaf = ({ attributes, children, leaf }) => {
        if (leaf.bold) {
            children = <strong>{children}</strong>;
        }
        if (leaf.italic) {
            children = <em>{children}</em>;
        }
        if (leaf.underline) {
            children = <u>{children}</u>;
        }
        return <span {...attributes}>{children}</span>;
    };

    // 处理键盘事件，例如加粗、斜体等快捷键
    const handleKeyDown = (event) => {
        if (!event.ctrlKey && !event.metaKey) {
            return;
        }

        switch (event.key) {
            case 'b': {
                event.preventDefault();
                toggleFormat(editor, 'bold');
                break;
            }
            case 'i': {
                event.preventDefault();
                toggleFormat(editor, 'italic');
                break;
            }
            case 'u': {
                event.preventDefault();
                toggleFormat(editor, 'underline');
                break;
            }
            default:
                break;
        }
    };

    // Function to save the content to latest.md
    const handleSaveDraft = async () => {
        const draftLatest = value
            .map((node) => getNodeText(editor, node))
            .filter((text) => text.trim())
            .join('\n\n');

        try {
            await axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                content: draftLatest,
            });
            message.success('Draft saved successfully.');

            // 主动加载最新的草稿内容
            await loadLatestDraft();
        } catch (error) {
            console.error('Error saving draft:', error);
            message.error('Failed to save draft. Please try again.');
        }
    };

    // Function to save and navigate to Anchor Builder
    const handleSaveAndGenerateTemplate = async () => {
        setIsLoadingSaveAndGenerate(true);

        try {
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            // Save the draft
            await axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                content: draftLatest,
            });
            message.success('Draft saved successfully.');

            // Call the new API endpoint
            const response = await axios.post('http://localhost:3001/generate-anchor-builder', {
                userTask,
                userName,
                taskId,
            });

            if (response.data && response.data.anchorData) {
                // Navigate to Anchor Builder with the generated content
                navigate('/fourth', {
                    state: {
                        userName,
                        taskId,
                        userTask,
                        anchorContent: JSON.stringify(response.data.anchorData), // 将 anchorData 转为字符串传递
                    },
                });
            } else {
                message.error('Failed to generate anchor content. Please try again.');
            }
        } catch (error) {
            console.error('Error saving draft and generating anchor content:', error);
            message.error('Failed to save draft or generate anchor content. Please try again.');
        } finally {
            setIsLoadingSaveAndGenerate(false);
        }
    };

    // Function to handle aspect selection
    const handleAspectSelection = (aspectId, type) => {
        if (type === 'keep') {
            setAspectsKeep((prev) =>
                prev.includes(aspectId) ? prev.filter((id) => id !== aspectId) : [...prev, aspectId]
            );
        } else if (type === 'change') {
            setAspectsChange((prev) =>
                prev.includes(aspectId) ? prev.filter((id) => id !== aspectId) : [...prev, aspectId]
            );
        }
    };

    const handleDirectWriterConfirm = async () => {
        if (!rewrittenVersion.trim()) {
            message.error('No rewritten version available to confirm.');
            return;
        }

        // 立即更新富文本编辑器内容
        const { selection } = editor;
        if (selection && selectedText) {
            try {
                const selectedRangeText = Editor.string(editor, selection);
                if (selectedRangeText === selectedText) {
                    Transforms.delete(editor, { at: selection });
                    Transforms.insertText(editor, rewrittenVersion, { at: selection.anchor });
                } else {
                    console.warn('Selected text does not match. Inserting at cursor position.');
                    Transforms.insertText(editor, rewrittenVersion);
                }
            } catch (transformError) {
                console.warn('Error replacing text in editor:', transformError);
                Transforms.insertText(editor, rewrittenVersion); // Fallback
            }
        } else {
            console.warn('No selection found. Inserting at cursor position.');
            Transforms.insertText(editor, rewrittenVersion);
        }

        message.success('Text replaced in the editor.');

        // 后台运行 rewrite-intent
        try {
            const requestData = {
                draftLatest: rewrittenVersion,
                factorChoices: await getFactorChoices(),
                intentCurrent: intents,
                selectedContent: selectedText,
                manualInstruction,
                userName,
                taskId,
            };

            // 异步调用 API
            axios.post('http://localhost:3001/rewrite-intent', requestData)
                .then((response) => {
                    if (response.data && response.data.updatedIntents) {
                        setIntents(response.data.updatedIntents); // 更新 intents
                        message.success('Intents updated successfully in the background.');
                    } else {
                        message.error('Failed to update intents in the background.');
                    }
                })
                .catch((error) => {
                    console.error('Error in background rewrite-intent:', error);
                    message.error('Failed to update intents in the background.');
                });

            // 异步保存 latest.md
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                content: draftLatest,
            }).then(() => {
                message.success('Draft saved successfully in the background.');
            }).catch((error) => {
                console.error('Error saving draft in the background:', error);
                message.error('Failed to save draft in the background.');
            });
        } catch (error) {
            console.error('Error in handleDirectWriterConfirm:', error);
            message.error('Failed to process rewrite-intent in the background.');
        }
    };

    const handleSelectiveAspectConfirm = async () => {
        console.log('handleSelectiveAspectConfirm triggered'); // Debug log

        if (!rewrittenVersion.trim()) {
            message.error('No rewritten version available to confirm.');
            return;
        }

        // Replace the selected text in the editor with the rewritten version
        const { selection } = editor;
        if (selection && selectedText) {
            try {
                const selectedRangeText = Editor.string(editor, selection);
                if (selectedRangeText === selectedText) {
                    Transforms.delete(editor, { at: selection });
                    Transforms.insertText(editor, rewrittenVersion, { at: selection.anchor });
                } else {
                    console.warn('Selected text does not match. Inserting at cursor position.');
                    Transforms.insertText(editor, rewrittenVersion);
                }
            } catch (transformError) {
                console.warn('Error replacing text in editor:', transformError);
                Transforms.insertText(editor, rewrittenVersion); // Fallback
            }
        } else {
            console.warn('No selection found. Inserting at cursor position.');
            Transforms.insertText(editor, rewrittenVersion);
        }

        message.success('Text replaced in the editor.');

        // Close the modal immediately
        setIsSelectiveAspectRewriterModalVisible(false);

        // Run the aspect-intent-analyzer API call in the background
        try {
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            const requestData = {
                userTask: userTask || 'Default user task',
                draftLatest: draftLatest || '',
                factorChoices: await getFactorChoices(),
                intentCurrent: intents || [],
                selectedContent: selectedText || '',
                aspectsSelectionJson: {
                    lock: aspectsKeep,
                    revise: aspectsChange,
                },
                manualInstruction: manualInstruction.trim() || '', // Optional
                userName: userName || 'unknown',
                taskId: taskId || 'unknown',
            };

            console.log('Sending request to /aspect-intent-analyzer with data:', requestData);

            // Asynchronous API call
            axios.post('http://localhost:3001/aspect-intent-analyzer', requestData)
                .then((response) => {
                    if (response.data && response.data.updatedIntents) {
                        setIntents(response.data.updatedIntents); // Update intents in the state
                        message.success('Intents updated successfully in the background.');
                    } else {
                        message.error('Failed to update intents in the background.');
                    }
                })
                .catch((error) => {
                    console.error('Error during background aspect-intent-analyzer call:', error);
                    message.error('An error occurred while updating intents in the background.');
                });
        } catch (error) {
            console.error('Error preparing data for aspect-intent-analyzer:', error);
            message.error('Failed to prepare data for background intent analysis.');
        }
    };

    const handleAspectRewrite = async () => {
        setIsLoadingRewrittenVersion(true);

        try {
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            const requestData = {
                userTask: userTask || 'Default user task',
                draftLatest: draftLatest || '',
                factorChoices: await getFactorChoices(),
                intentCurrent: intents || [],
                selectedContent: selectedText || '',
                aspectsListJson: aspectsList, // 预定义的 aspects 列表
                aspectsSelectionJson: {
                    lock: aspectsKeep,
                    revise: aspectsChange,
                },
                userPrompt: manualInstruction.trim() || '', // 用户输入的指令
            };

            const response = await axios.post('http://localhost:3001/selective-aspect-rewriter', requestData);

            if (response.data && response.data.rewrittenVersion) {
                setRewrittenVersion(response.data.rewrittenVersion.trim());
                message.success('Aspect rewrite generated successfully.');
            } else {
                message.error('Failed to generate aspect rewrite. Please try again.');
            }
        } catch (error) {
            console.error('Error in handleAspectRewrite:', error);
            message.error('Error in handleAspectRewrite. Please try again.');
        } finally {
            setIsLoadingRewrittenVersion(false);
        }
    };

    const loadLatestDraft = async () => {
        try {
            const response = await axios.get(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`);
            const draftContent = response.data || 'No content available.';

            const slateContent = draftContent
                .split('\n\n')
                .filter(paragraph => paragraph.trim())
                .map((paragraph) => ({
                    type: 'paragraph',
                    children: [{ text: paragraph.trim() }],
                }));

            if (slateContent.length === 0) {
                slateContent.push({
                    type: 'paragraph',
                    children: [{ text: 'No content available.' }],
                });
            }

            setValue(slateContent);
            setEditorKey(prevKey => prevKey + 1); // 强制触发重新渲染
        } catch (error) {
            console.error('Failed to load latest draft:', error);
            message.error('Failed to load latest draft. Please try again.');
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh', // Full viewport height
                background: '#f5f5f5',
            }}
        >
            {/* Main Content */}
            <Row
                gutter={[16, 16]} // Add spacing between columns
                style={{
                    flex: 1, // Take up remaining space
                    height: '100%', // Ensure Row takes full height
                    overflow: 'hidden', // Prevent overflow
                    padding: '16px',
                }}
            >
                {/* Left-side information panel - 4 columns */}
                <Col span={6} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    {/* Task Information */}
                    <div style={{ flex: '0 0 40%', overflow: 'hidden' }}>
                        <Card
                            title="Task Information"
                            size="small"
                            style={{
                                height: '100%', // Take full height of the container
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                            bodyStyle={{
                                overflowY: 'auto', // Enable scrolling
                                height: '100%',
                            }}
                        >
                            <div style={{ marginBottom: '16px' }}>
                                <Typography.Text strong>User Name:</Typography.Text>
                                <div style={{ marginTop: '4px' }}>
                                    <Tag color="blue">{userName || 'N/A'}</Tag>
                                </div>
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <Typography.Text strong>Task ID:</Typography.Text>
                                <div style={{ marginTop: '4px' }}>
                                    <Tag color="green">{taskId || 'N/A'}</Tag>
                                </div>
                            </div>

                            <div>
                                <Typography.Text strong>User Task:</Typography.Text>
                                <div
                                    style={{
                                        marginTop: '8px',
                                        padding: '12px',
                                        background: '#f8f9fa',
                                        borderRadius: '6px',
                                        fontSize: '14px',
                                        lineHeight: '1.5',
                                        wordBreak: 'break-word',
                                    }}
                                >
                                    {userTask || 'No task description available'}
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Intent Analyzer */}
                    <div style={{ flex: '0 0 60%', overflow: 'hidden', marginTop: '16px' }}>
                        <Card
                            title="Intent Analyzer"
                            size="small"
                            style={{
                                height: '100%', // Take full height of the container
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                            bodyStyle={{
                                padding: '12px',
                                overflowY: 'auto', // Enable vertical scrolling
                                height: '100%',
                            }}
                            extra={
                                <Button type="primary" size="small" onClick={handleRegenerateDraft}>
                                    Regenerate Draft
                                </Button>
                            }
                        >
                            <List
                                dataSource={intents}
                                renderItem={(intent, index) => (
                                    <List.Item
                                        key={index}
                                        actions={[
                                            editingIndex === index ? (
                                                <SaveOutlined
                                                    key="save"
                                                    onClick={() => handleSave(index)}
                                                    style={{ color: 'green' }}
                                                />
                                            ) : (
                                                <EditOutlined
                                                    key="edit"
                                                    onClick={() => handleEdit(index)}
                                                    style={{ color: 'blue' }}
                                                />
                                            ),
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={<AntText strong>{intent.dimension}</AntText>}
                                            description={
                                                editingIndex === index ? (
                                                    <Input
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                        onPressEnter={() => handleSave(index)}
                                                    />
                                                ) : (
                                                    intent.value
                                                )
                                            }
                                        />
                                    </List.Item>
                                )}
                            />
                        </Card>
                    </div>
                </Col>

                {/* Right-side editor - 20 columns */}
                <Col span={18} style={{ height: '100%' }}>
                    <Card
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Email Draft Editor</span>
                                <div>
                                    <button
                                        onClick={handleSaveDraft}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#1890ff',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            marginRight: '8px',
                                        }}
                                    >
                                        Save
                                    </button>
                                    <Button
                                        type="primary"
                                        onClick={handleSaveAndGenerateTemplate}
                                        loading={isLoadingSaveAndGenerate}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#52c41a',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                        }}
                                    >
                                        Save and Generate Anchors
                                    </Button>
                                </div>
                            </div>
                        }
                        size="small"
                        style={{
                            height: '100%', // Take full height of the container
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                        bodyStyle={{
                            overflowY: 'auto', // Enable scrolling
                            height: '100%',
                        }}
                    >
                        {contentLoaded ? (
                            <Dropdown overlay={menu} trigger={['contextMenu']}>
                                <div style={{
                                    background: '#fff',
                                    overflow: 'hidden',
                                }}>
                                    <Slate
                                        key={editorKey}
                                        editor={editor}
                                        initialValue={value}
                                        onChange={(newValue) => setValue(newValue)}
                                    >
                                        {/* Render the toolbar */}
                                        <Toolbar />

                                        {/* Render the editable area */}
                                        <Editable
                                            renderElement={renderElement}
                                            renderLeaf={renderLeaf}
                                            onKeyDown={handleKeyDown}
                                            onContextMenu={handleContextMenu}
                                            placeholder={loading ? 'Loading...' : 'Start typing...'}
                                            style={{
                                                padding: '16px',
                                                minHeight: '500px',
                                                outline: 'none',
                                            }}
                                        />
                                    </Slate>
                                </div>
                            </Dropdown>
                        ) : (
                            <div
                                style={{
                                    padding: '16px',
                                    minHeight: '500px',
                                    background: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#999',
                                }}
                            >
                                Loading content...
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            {/* Footer */}
            <div
                style={{
                    height: '60px', // Fixed footer height
                    background: '#f0f0f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTop: '1px solid #d9d9d9',
                }}
            >
                <p style={{ margin: 0, color: '#999' }}>© 2025 Email Writing Assistant</p>
            </div>

            {/* Modal for Variation Maker */}
            <Modal
                title="Variation Maker"
                visible={isModalVisible}
                onCancel={handleModalClose}
                onOk={handleModalConfirm}
                okText="Confirm"
                cancelText="Cancel"
                okButtonProps={{ disabled: !selectedOption }}
                width={{
                    xs: '90%',
                    sm: '80%',
                    md: '70%',
                    lg: '60%',
                    xl: '50%',
                    xxl: '40%',
                }}
            >
                {isLoadingVariations ? (
                    <Spin tip="Loading variations..." />
                ) : (
                    <>
                        <p><strong>Selected Content:</strong> {selectedText}</p>
                        <Radio.Group onChange={handleOptionChange} value={selectedOption} style={{ width: '100%' }}>
                            {variationOptions.map((option, index) => (
                                    <div key={index} style={{ marginBottom: '12px' }}>
                                    <Radio 
                                        value={option}
                                        style={{ 
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            whiteSpace: 'normal',
                                            lineHeight: '1.5'
                                        }}
                                    >
                                        <span style={{ marginLeft: '8px', wordBreak: 'break-word' }}>
                                            {option}
                                        </span>
                                    </Radio>
                                </div>
                            ))}
                        </Radio.Group>
                    </>
                )}
            </Modal>

            {/* Modal for Direct Rewriter Agent */}
            <Modal
                title="Direct Rewriter Agent"
                visible={isDirectRewriterModalVisible}
                onCancel={() => setIsDirectRewriterModalVisible(false)}
                onOk={async () => {
                    setDirectRewriterLoading(true); // Start loading
                    try {
                        await handleDirectWriterConfirm(); // Execute confirm logic
                        setIsDirectRewriterModalVisible(false); // Close modal
                    } catch (error) {
                        console.error('Error in Direct Rewriter Confirm:', error);
                        message.error('Failed to confirm. Please try again.');
                    } finally {
                        setDirectRewriterLoading(false); // Stop loading
                    }
                }}
                confirmLoading={directRewriterLoading} // Bind loading state to confirm button
                okButtonProps={{ disabled: !rewrittenVersion.trim() }}
                width={{
                    xs: '90%',
                    sm: '80%',
                    md: '70%',
                    lg: '60%',
                    xl: '50%',
                    xxl: '40%',
                }}
            >
                <p><strong>Selected Content:</strong> {selectedText}</p>
                <Input.TextArea
                    placeholder="Enter your manual instruction"
                    value={manualInstruction}
                    onChange={(e) => setManualInstruction(e.target.value)}
                    rows={4}
                />
                <Button
                    type="primary"
                    onClick={handleRewrite}
                    style={{ marginTop: '16px' }}
                >
                    Rewrite
                </Button>
                {isLoadingRewrittenVersion ? (
                    <Spin tip="Loading rewritten version..." />
                ) : (
                    <div style={{ marginTop: '16px', padding: '12px', background: '#f8f9fa', borderRadius: '4px' }}>
                        {rewrittenVersion || 'No rewritten version available.'}
                    </div>
                )}
            </Modal>

            {/* Selective Aspect Rewriter Modal */}
            <Modal
                title="Selective Aspect Rewriter"
                visible={isSelectiveAspectRewriterModalVisible}
                onCancel={() => setIsSelectiveAspectRewriterModalVisible(false)}
                onOk={async () => {
                    setSelectiveAspectLoading(true); // Start loading
                    try {
                        await handleSelectiveAspectConfirm(); // Execute confirm logic
                        setIsSelectiveAspectRewriterModalVisible(false); // Close modal
                    } catch (error) {
                        console.error('Error in Selective Aspect Confirm:', error);
                        message.error('Failed to confirm. Please try again.');
                    } finally {
                        setSelectiveAspectLoading(false); // Stop loading
                    }
                }}
                confirmLoading={selectiveAspectLoading} // Bind loading state to confirm button
                okButtonProps={{ disabled: !rewrittenVersion.trim() }}
                width="70%"
            >
                <p><strong>Selected Content:</strong> {selectedText}</p>

                {/* 功能提示 */}
                <Alert
                    message="Support Multi-aspect Control"
                    description="Users can select multiple predefined aspects to 'keep' (locked), and multiple aspects to 'change' (editable), with optional additional prompt instructions for nuance."
                    type="info"
                    showIcon
                    style={{ marginBottom: '16px' }}
                />

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    {/* Aspects (Keep) */}
                    <Card
                        title="Aspects (Keep)"
                        size="small"
                        style={{ flex: 1 }}
                        bodyStyle={{ maxHeight: '300px', overflowY: 'auto' }}
                    >
                        <Checkbox.Group
                            value={aspectsKeep}
                            onChange={(checkedValues) => setAspectsKeep(checkedValues)}
                        >
                            {aspectsList.map((aspect) => (
                                <div key={aspect.id} style={{ marginBottom: '12px' }}>
                                    <Checkbox value={aspect.id}>
                                        <Typography.Text strong>{aspect.title}</Typography.Text>
                                        <br />
                                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                            {aspect.description}
                                        </Typography.Text>
                                    </Checkbox>
                                </div>
                            ))}
                        </Checkbox.Group>
                    </Card>

                    {/* Aspects (Change) */}
                    <Card
                        title="Aspects (Change)"
                        size="small"
                        style={{ flex: 1 }}
                        bodyStyle={{ maxHeight: '300px', overflowY: 'auto' }}
                    >
                        <Checkbox.Group
                            value={aspectsChange}
                            onChange={(checkedValues) => setAspectsChange(checkedValues)}
                        >
                            {aspectsList.map((aspect) => (
                                <div key={aspect.id} style={{ marginBottom: '12px' }}>
                                    <Checkbox value={aspect.id}>
                                        <Typography.Text strong>{aspect.title}</Typography.Text>
                                        <br />
                                        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                                            {aspect.description}
                                        </Typography.Text>
                                    </Checkbox>
                                </div>
                            ))}
                        </Checkbox.Group>
                    </Card>
                </div>

                {/* Additional Prompt Instructions */}
                <Card
                    title="Additional Prompt Instructions"
                    size="small"
                    style={{ marginBottom: '16px' }}
                >
                    <Input.TextArea
                        placeholder="Enter additional instructions for nuance"
                        value={manualInstruction}
                        onChange={(e) => setManualInstruction(e.target.value)}
                        rows={3}
                    />
                </Card>

                {/* Rewrite Button */}
                <Button
                    type="primary"
                    onClick={handleAspectRewrite}
                    disabled={aspectsKeep.length === 0 && aspectsChange.length === 0}
                    style={{ marginBottom: '16px' }}
                >
                    Aspect Rewrite
                </Button>

                {/* Rewritten Version */}
                <Card
                    title="Rewritten Version"
                    size="small"
                    bodyStyle={{ minHeight: '100px' }}
                >
                    {isLoadingRewrittenVersion ? (
                        <Spin tip="Loading rewritten version..." />
                    ) : (
                        <Typography.Text>
                            {rewrittenVersion || 'No rewritten version available.'}
                        </Typography.Text>
                    )}
                </Card>
            </Modal>
        </div>
    );
};

export default ThirdPage;    
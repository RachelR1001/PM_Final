import React, { useMemo, useState, useEffect } from 'react';
import { createEditor, Editor, Transforms, Text } from 'slate';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { Row, Col, Card, Typography, Tag, Menu, Dropdown, Modal, Radio, message, Spin } from 'antd';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';

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

    // Function to handle right-click
    const handleContextMenu = (event) => {
        event.preventDefault();

        // Get the selected text
        const selection = window.getSelection();
        const selectedText = selection.toString();

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

        setIsLoadingVariations(true);

        try {
            // Fetch real data for factor choices and current intents
            const factorChoices = await getFactorChoices();
            const intentCurrent = await getIntentCurrent();

            // Get the current editor content
            const draftLatest = value
                .map((node) => getNodeText(editor, node))
                .filter((text) => text.trim())
                .join('\n\n');

            // Prepare the data for the request
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

            // Send the request to the server
            const response = await axios.post('http://localhost:3001/variation-intent-analyzer', requestData);

            if (response.data && response.data.updatedIntents) {
                message.success('Intents updated successfully.');
                console.log('Updated intents:', response.data.updatedIntents);

                // Replace the selected text with the new variation in the editor
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
            } else {
                message.error('Failed to update intents. Please try again.');
            }
        } catch (error) {
            console.error('Error during handleModalConfirm:', error);
            message.error('An error occurred. Please try again.');
        } finally {
            setIsLoadingVariations(false);
            handleModalClose();
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
        if (!manualInstruction.trim()) {
            message.error('Please provide a manual instruction.');
            return;
        }

        setIsLoadingRewrittenVersion(true);

        const draftLatest = value
            .map((node) => getNodeText(editor, node))
            .filter((text) => text.trim())
            .join('\n\n');

        const factorChoices = await getFactorChoices();
        const intentCurrent = await getIntentCurrent();

        try {
            const response = await axios.post('http://localhost:3001/direct-rewriter', {
                draftLatest,
                factorChoices,
                intentCurrent,
                selectedContent: selectedText,
                manualInstruction,
            });

            if (response.data && response.data.rewrittenVersion) {
                setRewrittenVersion(response.data.rewrittenVersion);
            } else {
                message.error('Failed to fetch rewritten version. Please try again.');
            }
        } catch (error) {
            console.error('Error fetching rewritten version:', error);
            message.error('Error fetching rewritten version. Please try again.');
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
    const handleSave = async () => {
        const draftLatest = value
            .map((node) => getNodeText(editor, node))
            .filter((text) => text.trim())
            .join('\n\n');

        try {
            await axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                content: draftLatest,
            });
            message.success('Draft saved successfully.');
        } catch (error) {
            console.error('Error saving draft:', error);
            message.error('Failed to save draft. Please try again.');
        }
    };

    // Function to save and navigate to Anchor Builder
    const handleSaveAndGenerateTemplate = async () => {
        const draftLatest = value
            .map((node) => getNodeText(editor, node))
            .filter((text) => text.trim())
            .join('\n\n');

        try {
            // Save the draft
            await axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                content: draftLatest,
            });
            message.success('Draft saved successfully.');

            // Navigate to Anchor Builder
            navigate('/fourth', { state: { userName, taskId, userTask } });
        } catch (error) {
            console.error('Error saving draft and navigating:', error);
            message.error('Failed to save draft or navigate. Please try again.');
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
            <div
                style={{
                    flex: 1, // Take up remaining space
                    overflow: 'hidden', // Prevent overflow
                    display: 'flex',
                    flexDirection: 'row',
                    padding: '16px',
                }}
            >
                {/* Left-side information panel - 4 columns */}
                <div
                    style={{
                        flex: '0 0 25%', // Fixed width for the left panel
                        paddingRight: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    <Card
                        title="Task Information"
                        size="small"
                        style={{
                            flex: '1 1 auto', // Allow resizing
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                        bodyStyle={{
                            overflowY: 'auto', // Enable scrolling
                            maxHeight: 'calc(100vh - 200px)', // Adjust height for footer
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

                    {/* New Intent Analyzer Card */}
                    <Card
                        title="Intent Analyzer"
                        size="small"
                        style={{
                            marginTop: '16px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            height: '300px', // Fixed height
                            overflow: 'hidden', // Hide overflow
                        }}
                        bodyStyle={{
                            padding: '12px',
                            overflowY: 'auto', // Enable vertical scrolling
                            height: 'calc(100% - 48px)', // Adjust for card header
                        }}
                    >
                        {intents.length > 0 ? (
                            <ul style={{ paddingLeft: '16px', margin: 0 }}>
                                {intents.map((intent, index) => (
                                    <li key={index} style={{ marginBottom: '8px', wordBreak: 'break-word' }}>
                                        <strong>{intent.dimension}:</strong> {intent.value}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p style={{ color: '#999', textAlign: 'center' }}>No intents available.</p>
                        )}
                    </Card>
                </div>
                
                {/* Right-side editor - 20 columns */}
                <div
                    style={{
                        flex: '1 1 75%', // Take up remaining space
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Card
                        title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Email Draft Editor</span>
                                <div>
                                    <button
                                        onClick={handleSave}
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
                                    <button
                                        onClick={handleSaveAndGenerateTemplate}
                                        style={{
                                            padding: '4px 8px',
                                            background: '#52c41a',
                                            color: '#fff',
                                            border: 'none',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Save and Generate Template
                                    </button>
                                </div>
                            </div>
                        }
                        size="small"
                        style={{
                            flex: '1 1 auto', // Allow resizing
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        }}
                        bodyStyle={{
                            overflowY: 'auto', // Enable scrolling
                            maxHeight: 'calc(100vh - 200px)', // Adjust height for footer
                        }}
                    >
                        {contentLoaded ? (
                            <Dropdown overlay={menu} trigger={['contextMenu']}>
                                <div style={{
                                    background: '#fff',
                                    overflow: 'hidden',
                                }}>
                                    <Slate
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
                </div>
            </div>

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
                footer={[
                    <button
                        key="cancel"
                        onClick={() => setIsDirectRewriterModalVisible(false)}
                        style={{
                            padding: '8px 16px',
                            background: '#f5f5f5',
                            color: '#000',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '8px',
                        }}
                    >
                        Cancel
                    </button>,
                    <button
                        key="confirm"
                        onClick={async () => {
                            if (!rewrittenVersion.trim()) {
                                message.error('No rewritten version available to confirm.');
                                return;
                            }

                            setIsLoadingRewrittenVersion(true);

                            try {
                                // Fetch real data for factor choices and current intents
                                const factorChoices = await getFactorChoices();
                                const intentCurrent = await getIntentCurrent();

                                // Get the current editor content
                                const draftLatest = value
                                    .map((node) => getNodeText(editor, node))
                                    .filter((text) => text.trim())
                                    .join('\n\n');

                                // Prepare the data for the request
                                const requestData = {
                                    draftLatest,
                                    factorChoices,
                                    intentCurrent,
                                    selectedContent: selectedText,
                                    manualInstruction,
                                    userName,
                                    taskId,
                                };

                                console.log('Sending request to /rewrite-intent with data:', requestData);

                                // Send the request to the server
                                const response = await axios.post('http://localhost:3001/rewrite-intent', requestData);

                                if (response.data && response.data.updatedIntents) {
                                    message.success('Intents updated successfully.');
                                    console.log('Updated intents:', response.data.updatedIntents);

                                    // Replace the selected text with the rewritten version in the editor
                                    const { selection } = editor;
                                    if (selection && selectedText) {
                                        try {
                                            if (Editor.string(editor, selection) === selectedText) {
                                                Transforms.delete(editor, { at: selection });
                                                Transforms.insertText(editor, rewrittenVersion, { at: selection.anchor });
                                            } else {
                                                Transforms.insertText(editor, rewrittenVersion);
                                            }
                                        } catch (transformError) {
                                            console.warn('Error replacing text in editor:', transformError);
                                            Transforms.insertText(editor, rewrittenVersion); // Fallback
                                        }
                                    }

                                    // Update latest.md with the new content
                                    const updatedDraft = value
                                        .map((node) => getNodeText(editor, node))
                                        .filter((text) => text.trim())
                                        .join('\n\n');

                                    await axios.post(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`, {
                                        content: updatedDraft,
                                    });

                                    message.success('Latest draft updated successfully.');
                                } else {
                                    message.error('Failed to update intents. Please try again.');
                                }
                            } catch (error) {
                                console.error('Error during confirm action:', error);
                                message.error('An error occurred. Please try again.');
                            } finally {
                                setIsLoadingRewrittenVersion(false);
                                setIsDirectRewriterModalVisible(false);
                            }
                        }}
                        style={{
                            padding: '8px 16px',
                            background: '#52c41a',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                        disabled={!rewrittenVersion.trim()}
                    >
                        Confirm
                    </button>,
                ]}
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
                <div style={{ marginBottom: '16px' }}>
                    <strong>Your Manual Instruction:</strong>
                    <input
                        type="text"
                        placeholder="Please input your free-form instruction for AI agent to rewrite the selected content"
                        value={manualInstruction}
                        onChange={(e) => setManualInstruction(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px',
                            marginTop: '8px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                        }}
                    />
                        </div>
                <button
                    onClick={handleRewrite}
                    style={{
                        padding: '8px 16px',
                        background: '#1890ff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        marginBottom: '16px',
                    }}
                >
                    Rewrite
                </button>
                            <div>
                    <strong>Rewritten Version:</strong>
                    {isLoadingRewrittenVersion ? (
                        <Spin tip="Loading rewritten version..." />
                    ) : (
                        <div
                            style={{
                                marginTop: '8px',
                                padding: '12px',
                                background: '#f8f9fa',
                                borderRadius: '4px',
                                border: '1px solid #d9d9d9',
                                minHeight: '100px',
                            }}
                        >
                            {rewrittenVersion || 'No rewritten version available.'}
                            </div>
                        )}
                    </div>
            </Modal>
        </div>
    );
};

export default ThirdPage;    
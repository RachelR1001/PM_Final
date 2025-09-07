import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createEditor, Editor, Transforms, Range, Text } from 'slate';
import { Slate, Editable, withReact, useSlate, ReactEditor } from 'slate-react';
import { Card, Typography, message, Button, Row, Col, Tooltip, Tag, Radio, Checkbox, Flex } from 'antd';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGlobalContext } from '../App';

const { Title } = Typography;

// Helper functions for text formatting
const toggleFormat = (editor, format) => {
    const isActive = isFormatActive(editor, format);
    if (isActive) {
        Editor.removeMark(editor, format);
    } else {
        Editor.addMark(editor, format, true);
    }
};

const isFormatActive = (editor, format) => {
    const marks = Editor.marks(editor);
    return marks ? marks[format] === true : false;
};

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

const isBlockActive = (editor, format) => {
    const [match] = Editor.nodes(editor, {
        match: n => n.type === format,
    });
    return !!match;
};

// Safe node text extraction
const getNodeText = (editor, node) => {
    try {
        if (!node || typeof node !== 'object') {
            return '';
        }
        
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
        
        if (node.text !== undefined) {
            return node.text;
        }
        
        return '';
    } catch (error) {
        console.error('Error processing node:', node, error);
        return '';
    }
};

// Component that appears when text is selected/highlighted
const FloatingToolbar = ({ component, onReplace, onClose, position }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(component?.content || '');

    if (!component || !position) return null;

    const handleSave = () => {
        onReplace(component.id, editText);
        setIsEditing(false);
        onClose();
    };

    const handleCancel = () => {
        setEditText(component.content);
        setIsEditing(false);
        onClose();
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: position.top - 80,
                left: position.left,
                background: 'white',
                border: '1px solid #d9d9d9',
                borderRadius: '6px',
                padding: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                minWidth: '320px',
                maxWidth: '400px',
            }}
        >
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>
                {component.title}
            </div>
            
            {!isEditing ? (
                <div>
                    <div style={{ marginBottom: '8px', fontSize: '13px', lineHeight: '1.4' }}>
                        {component.content}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button size="small" onClick={() => setIsEditing(true)}>
                            Edit Component
                        </Button>
                        <Button size="small" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            ) : (
                <div>
                    <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '80px',
                            marginBottom: '8px',
                            padding: '8px',
                            border: '1px solid #d9d9d9',
                            borderRadius: '4px',
                            resize: 'vertical',
                            fontSize: '13px',
                        }}
                        placeholder="Edit component content..."
                    />
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Button size="small" onClick={handleCancel}>
                            Cancel
                        </Button>
                        <Button size="small" type="primary" onClick={handleSave}>
                            Save Changes
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

// Toolbar Button Component
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

// Toolbar Component
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
            {/* Text formatting buttons */}
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

            {/* Block element buttons */}
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

            <div style={{ width: '1px', height: '24px', background: '#d9d9d9', margin: '0 8px' }} />

            {/* List buttons */}
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

const EmailEditor = () => {
    const location = useLocation();
    const { state } = location;
    const userTask = state?.userTask || '';
    const navigate = useNavigate();
    const editor = useMemo(() => withReact(createEditor()), []);
    const { globalState } = useGlobalContext();
    const { username: globalUsername, taskId: globalTaskId, userTask: globalUserTask } = globalState;

    // Use global state
    const taskId = globalTaskId;
    const userName = globalUsername;
    // const userTask = globalUserTask;
    
    // Initial editor value
    const initialValue = useMemo(() => [
        {
            type: 'paragraph',
            children: [{ text: '' }],
        },
    ], []);

    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(true);
    const [contentLoaded, setContentLoaded] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const [components, setComponents] = useState([]);
    const [selectedComponentId, setSelectedComponentId] = useState(null);
    const [highlightedRanges, setHighlightedRanges] = useState([]);
    const [floatingToolbar, setFloatingToolbar] = useState({ visible: false, component: null, position: null });
    const editorRef = useRef(null);
    const [originalText, setOriginalText] = useState('');
    // Add this state near other useState declarations
    const [combinedResults, setCombinedResults] = useState([]);

    // Load draft content on component mount
    useEffect(() => {
        const fetchDraft = async () => {
            try {
                const response = await axios.get(`http://localhost:3001/sessiondata/${globalTaskId}/drafts/latest.md`);
                const draftContent = response.data || 'No content available.';
                setOriginalText(draftContent);
                
                // Parse content into Slate format - preserve original structure
                const slateContent = draftContent
                    .split('\n\n')
                    .filter(paragraph => paragraph.trim())
                    .map((paragraph) => ({
                        type: 'paragraph',
                        children: [{ text: paragraph.trim() }],
                    }));

                // Ensure at least one paragraph exists
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
            setValue([
                {
                    type: 'paragraph',
                    children: [{ text: 'No task selected.' }],
                },
            ]);
            setContentLoaded(true);
            setLoading(false);
        }
    }, [taskId, globalTaskId]);

    let commonComponents = [];
    let linkResults = null;
    let combinedResult = null;

    // Extract components using the component extractor
    const handleExtractComponents = async () => {
        try {
            setLoading(true);
            const response = await axios.post('http://localhost:3001/component-extractor', {
                taskId: globalTaskId,
                userName: globalUsername,
            });

            let extractedComponents = [];
            try {
                extractedComponents = JSON.parse(response.data.components);
            } catch (e) {
                const jsonMatch = response.data.components.match(/\[[\s\S]*\]/);
                if (jsonMatch) {
                    extractedComponents = JSON.parse(jsonMatch[0]);
                } else {
                    console.error('Could not parse components');
                    message.error('Failed to parse components');
                    return;
                }
            }

            setComponents(extractedComponents);
            message.success(`Extracted ${extractedComponents.length} components`);

            commonComponents = extractedComponents;
            console.log('Assigned Common Components:', commonComponents);

            // Call the new intent-analyzer-new endpoint
            try {
                console.log('Global State:', { globalUsername, globalTaskId, userTask });
                const intentResponse = await axios.post('http://localhost:3001/intent-analyzer-new', {
                    userTask: userTask,
                    userName: globalUsername,
                    taskId: globalTaskId,
                });
                console.log('Intent Analyzer New Response:', intentResponse.data);

                // Call the new component-intent-link endpoint
                const linkResponse = await axios.post('http://localhost:3001/component-intent-link', {
                    userName: globalUsername,
                    taskId: globalTaskId,
                    componentList: extractedComponents,
                });

                linkResults = typeof linkResponse.data.links === 'string' 
                    ? JSON.parse(linkResponse.data.links) 
                    : linkResponse.data.links;
                console.log('Component-Intent Link Results:', linkResults);
                handleCombinedResult();
            } catch (intentError) {
                console.error('Error calling intent-analyzer-new or component-intent-link:', intentError);
            }
        } catch (error) {
            console.error('Failed to extract components:', error);
            message.error('Failed to extract components');
        } finally {
            setLoading(false);
        }
    };

    // 改进的文本查找函数，支持模糊匹配和跨段落搜索
    const findTextInEditor = (searchText, editorValue) => {
        if (!searchText || !editorValue) return null;

        // 构建完整的文本内容，保持段落间的换行
        const fullText = editorValue
            .map(node => getNodeText(null, node))
            .join('\n\n');
        
        // 标准化搜索文本和全文（去除多余空格，统一换行）
        const normalizeText = (text) => {
            return text
                .replace(/\s+/g, ' ')  // 将多个空格替换为单个空格
                .replace(/\n+/g, ' ')  // 将换行替换为空格
                .trim()
                .toLowerCase();
        };
        
        const normalizedSearch = normalizeText(searchText);
        const normalizedFull = normalizeText(fullText);
        
        console.log('Searching for:', normalizedSearch);
        console.log('In text:', normalizedFull.substring(0, 200) + '...');
        
        // 在标准化文本中查找位置
        let index = normalizedFull.indexOf(normalizedSearch);
        
        // 如果直接匹配失败，尝试部分匹配
        if (index === -1) {
            // 尝试匹配前80%的内容
            const partialLength = Math.floor(normalizedSearch.length * 0.8);
            const partialSearch = normalizedSearch.substring(0, partialLength);
            index = normalizedFull.indexOf(partialSearch);
            
            if (index !== -1) {
                console.log('Found partial match at index:', index);
                return {
                    start: index,
                    end: index + partialSearch.length,
                    fullText: normalizedFull,
                    originalSearchText: searchText,
                    isPartialMatch: true
                };
            }
        }
        
        if (index === -1) {
            console.log('Text not found');
            return null;
        }
        
        console.log('Found exact match at index:', index);
        return {
            start: index,
            end: index + normalizedSearch.length,
            fullText: normalizedFull,
            originalSearchText: searchText,
            isPartialMatch: false
        };
    };

    // 改进的高亮应用函数，支持跨段落高亮
    const applyHighlightingToValue = (editorValue, componentContent, componentId) => {
        console.log('Applying highlighting for component:', componentId);
        console.log('Component content:', componentContent);
        
        // 首先清除所有高亮
        const cleanValue = editorValue.map(node => ({
            ...node,
            children: node.children.map(child => {
                const { highlight, componentId: oldComponentId, ...cleanChild } = child;
                return cleanChild;
            })
        }));

        const position = findTextInEditor(componentContent, cleanValue);
        if (!position) {
            console.log('Position not found, returning clean value');
            return cleanValue;
        }

        console.log('Found position:', position);

        // 构建位置映射：从标准化文本位置映射到实际节点位置
        let currentNormalizedPos = 0;
        let nodePositions = [];
        
        cleanValue.forEach((node, nodeIndex) => {
            const nodeText = getNodeText(null, node);
            const normalizedNodeText = nodeText.replace(/\s+/g, ' ').trim().toLowerCase();
            
            nodePositions.push({
                nodeIndex,
                originalText: nodeText,
                normalizedText: normalizedNodeText,
                normalizedStart: currentNormalizedPos,
                normalizedEnd: currentNormalizedPos + normalizedNodeText.length,
                node
            });
            
            currentNormalizedPos += normalizedNodeText.length;
            if (nodeIndex < cleanValue.length - 1) {
                currentNormalizedPos += 1; // 段落间的空格
            }
        });

        console.log('Node positions:', nodePositions);

        // 找到需要高亮的节点范围
        const highlightStart = position.start;
        const highlightEnd = position.end;
        
        const affectedNodes = nodePositions.filter(pos => 
            !(pos.normalizedEnd <= highlightStart || pos.normalizedStart >= highlightEnd)
        );

        console.log('Affected nodes:', affectedNodes);

        if (affectedNodes.length === 0) {
            return cleanValue;
        }

        // 应用高亮到受影响的节点
        const newValue = cleanValue.map((node, nodeIndex) => {
            const nodePos = nodePositions.find(pos => pos.nodeIndex === nodeIndex);
            if (!nodePos || !affectedNodes.includes(nodePos)) {
                return node;
            }

            // 计算在当前节点中的高亮范围
            const nodeStart = Math.max(0, highlightStart - nodePos.normalizedStart);
            const nodeEnd = Math.min(nodePos.normalizedText.length, highlightEnd - nodePos.normalizedStart);

            console.log(`Node ${nodeIndex}: highlighting from ${nodeStart} to ${nodeEnd} in "${nodePos.normalizedText}"`);

            if (nodeStart >= nodeEnd) {
                return node;
            }

            // 在原始文本中找到对应位置（考虑到标准化时可能改变的空格）
            const originalText = nodePos.originalText;
            let originalStart = 0;
            let originalEnd = originalText.length;

            // 简单映射：如果是部分高亮，尝试在原文中找到相似的位置
            if (nodeStart > 0 || nodeEnd < nodePos.normalizedText.length) {
                // 对于部分匹配，使用比例来估算位置
                const startRatio = nodeStart / nodePos.normalizedText.length;
                const endRatio = nodeEnd / nodePos.normalizedText.length;
                
                originalStart = Math.floor(originalText.length * startRatio);
                originalEnd = Math.ceil(originalText.length * endRatio);
            }

            // 确保边界有效
            originalStart = Math.max(0, Math.min(originalStart, originalText.length));
            originalEnd = Math.max(originalStart, Math.min(originalEnd, originalText.length));

            console.log(`Mapping to original text positions: ${originalStart} to ${originalEnd}`);

            // 分割文本并应用高亮
            const beforeText = originalText.substring(0, originalStart);
            const highlightText = originalText.substring(originalStart, originalEnd);
            const afterText = originalText.substring(originalEnd);

            const newChildren = [];
            if (beforeText) {
                newChildren.push({ text: beforeText });
            }
            if (highlightText) {
                newChildren.push({ 
                    text: highlightText, 
                    highlight: true, 
                    componentId: componentId 
                });
            }
            if (afterText) {
                newChildren.push({ text: afterText });
            }

            return {
                ...node,
                children: newChildren.length > 0 ? newChildren : [{ text: originalText }]
            };
        });

        console.log('Applied highlighting, returning new value');
        return newValue;
    };

    // 修复后的高亮应用函数
    const applyHighlighting = (componentContent, componentId) => {
        console.log('Applying highlighting for:', componentContent);
        const newValue = applyHighlightingToValue(value, componentContent, componentId);
        setValue(newValue);
        setEditorKey(prev => prev + 1);
    };

    // 修复后的移除高亮函数
    const removeAllHighlighting = () => {
        const cleanValue = value.map(node => ({
            ...node,
            children: node.children.map(child => {
                // 移除高亮属性但保留其他格式
                const { highlight, componentId, ...cleanChild } = child;
                return cleanChild;
            })
        }));
        
        setValue(cleanValue);
        setSelectedComponentId(null);
        setEditorKey(prev => prev + 1);
    };

    // 改进后的组件选择处理函数，添加调试信息
    const handleComponentSelect = (component) => {
        console.log('Selecting component:', component);
        
        if (selectedComponentId === component.id) {
            // 如果点击的是已选中的组件，则取消选择
            console.log('Deselecting component');
            removeAllHighlighting();
            return;
        }
        
        // 设置新的选中状态
        console.log('Setting selected component ID:', component.id);
        setSelectedComponentId(component.id);
        
        // 直接应用新的高亮（applyHighlighting函数会先清除所有高亮）
        applyHighlighting(component.content, component.id);
    };

    // Handle clicking on highlighted text
    const handleHighlightClick = (event, componentId) => {
        const component = components.find(c => c.id === componentId);
        if (!component) return;

        // Calculate toolbar position
        const rect = event.target.getBoundingClientRect();
        const editorRect = editorRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
        
        setFloatingToolbar({
            visible: true,
            component: component,
            position: {
                top: rect.top - editorRect.top,
                left: rect.left - editorRect.left,
            },
        });
    };

    // Handle component replacement
    const handleComponentReplace = (componentId, newContent) => {
        // Update components state
        const updatedComponents = components.map(comp => 
            comp.id === componentId ? { ...comp, content: newContent } : comp
        );
        setComponents(updatedComponents);

        // Update the original text content
        let updatedText = originalText;
        const component = components.find(c => c.id === componentId);
        if (component) {
            updatedText = updatedText.replace(component.content, newContent);
            setOriginalText(updatedText);
        }

        // Re-parse and update editor content
        const slateContent = updatedText
            .split('\n\n')
            .filter(paragraph => paragraph.trim())
            .map((paragraph) => ({
                type: 'paragraph',
                children: [{ text: paragraph.trim() }],
            }));

        setValue(slateContent);
        
        // Re-apply highlighting with new content
        setTimeout(() => {
            applyHighlighting(newContent, componentId);
        }, 100);
        
        message.success('Component updated successfully');
    };

    // Close floating toolbar
    const closeFloatingToolbar = () => {
        setFloatingToolbar({ visible: false, component: null, position: null });
    };

    // Custom render functions for rich text elements
    const renderElement = ({ attributes, children, element }) => {
        const paragraphStyle = {
            marginBottom: '20px', // 增加段间距
            marginTop: '0'
        };
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
        let element = children;
        
        if (leaf.bold) {
            element = <strong>{element}</strong>;
        }
        if (leaf.italic) {
            element = <em>{element}</em>;
        }
        if (leaf.underline) {
            element = <u>{element}</u>;
        }
        
        // Apply highlighting style with dimension buttons
        if (leaf.highlight) {
            // Find the corresponding combined result for this component
            const combinedResult = combinedResults.find(result => result.id === leaf.componentId);
            const dimensions = combinedResult?.linkedIntents || [];
            
            element = (
                <span style={{ position: 'relative', display: 'inline-block' }}>
                    {/* Dimension buttons above the highlighted text */}
                    {dimensions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '-12px', // 从 -25px 改为 -12px，让按钮距离文本仅2px
                            left: '0',
                            display: 'flex',
                            gap: '4px',
                            zIndex: 10,
                            flexWrap: 'wrap'
                        }}>
                            {dimensions.map((intent, index) => (
                                <Button
                                    key={`${leaf.componentId}-${index}`}
                                    size="small"
                                    shape="circle"
                                    style={{
                                        width: '10px',
                                        height: '10px',
                                        minWidth: '10px',
                                        padding: '0',
                                        fontSize: '8px',
                                        backgroundColor: getDimensionColor(intent.dimension),
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDimensionClick(intent, leaf.componentId);
                                    }}
                                    title={intent.dimension}
                                />
                            ))}
                        </div>
                    )}
                    
                    <span
                        style={{
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '2px',
                            padding: '1px 2px',
                            cursor: 'pointer',
                            display: 'inline-block'
                        }}
                        onClick={(e) => handleHighlightClick(e, leaf.componentId)}
                    >
                        {element}
                    </span>
                </span>
            );
        }
        
        return <span {...attributes}>{element}</span>;
    };
    // Add these helper functions before the return statement
const getDimensionColor = (dimension) => {
    // Generate consistent colors for each dimension
    const colors = [
        '#ff4d4f', '#1890ff', '#52c41a', '#faad14', 
        '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'
    ];
    const hash = dimension.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
};

const handleDimensionClick = (intent, componentId) => {
    console.log('Dimension clicked:', intent.dimension, 'for component:', componentId);
    // You can add logic here to show intent options or perform other actions
    message.info(`Clicked dimension: ${intent.dimension}`);
};

    // Handle keyboard shortcuts
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

    // Save draft function
    const handleSaveDraft = async () => {
        const draftLatest = originalText; // Use the original text with updates

        try {
            await axios.post(`http://localhost:3001/sessiondata/${globalTaskId}/drafts/latest.md`, {
                content: draftLatest,
            });
            message.success('Draft saved successfully.');
        } catch (error) {
            console.error('Error saving draft:', error);
            message.error('Failed to save draft. Please try again.');
        }
    };

    const handleCombinedResult = async () => {
        try {
            // Fetch current intents from session data
            const response = await axios.get(`http://localhost:3001/sessiondata/${globalTaskId}/intents/current.json`);
            const currentIntents = response.data;

            // Ensure commonComponents is an array
            if (!Array.isArray(commonComponents)) {
                throw new Error('commonComponents is not an array');
            }

            console.log('Link Results:', linkResults);
            console.log('Current Intents:', currentIntents);

            // Process linkResults, commonComponents, and currentIntents
            combinedResult = commonComponents.map(component => {
                // Find all linkResults related to this component
                const linkedIntents = linkResults
                    .filter(link => link.component_id === component.id)
                    .map(link => {
                        // Find the corresponding intent in currentIntents
                        const intent = currentIntents.find(intent => {
                            const normalizedDimension = intent.dimension.trim().toLowerCase();
                            const normalizedIntentDimension = link.intent_dimension.trim().toLowerCase();
                            return normalizedDimension === normalizedIntentDimension;
                        });

                        // Reconstruct the intent data
                        return intent ? {
                            dimension: intent.dimension,
                            current_value: intent.current_value || 'N/A',
                            other_values: intent.other_values || []
                        } : null;
                    })
                    .filter(Boolean); // Remove null values

                // Combine component details with its linked intents
                return {
                    id: component.id,
                    title: component.title,
                    content: component.content,
                    linkedIntents
                };
            });

            console.log('Combined Result:', combinedResult);
            setCombinedResults(combinedResult); // Store in state
        } catch (error) {
            console.error('Error processing combined result:', error);
        }
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100vh',
                background: '#f5f5f5',
                position: 'relative',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>Email Draft Editor</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button>Regenerate Draft</Button>
                    <Button
                        type="primary"
                        onClick={handleSaveDraft}
                    >
                        Save Draft
                    </Button>
                    <Button onClick={handleExtractComponents} loading={loading}>
                        Generate Components
                    </Button>
                    <Button onClick={removeAllHighlighting}>
                        Clear Highlighting
                    </Button>
                </div>
            </div>
            
            <Card
                size="small"
                style={{
                    height: '100%',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                }}
                bodyStyle={{
                    padding: 0,
                    height: '100%',
                }}
            >
                {contentLoaded ? (
                    <div>
                    <Row style={{ height: '80%', borderBottom: '1px solid #d9d9d9'}}>
                        <Col span={18}>
                            <div 
                                ref={editorRef}
                                style={{
                                    background: '#fff',
                                    height: '100%',
                                    position: 'relative',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Slate
                                    key={editorKey}
                                    editor={editor}
                                    initialValue={value}
                                    onChange={(newValue) => setValue(newValue)}
                                >
                                    <Toolbar />
                                    <div style={{ flex: 1, overflow: 'auto' }}>
                                        <Editable
                                            renderElement={renderElement}
                                            renderLeaf={renderLeaf}
                                            onKeyDown={handleKeyDown}
                                            placeholder={loading ? 'Loading...' : 'Start typing...'}
                                            style={{
                                                padding: '16px',
                                                minHeight: '500px',
                                                outline: 'none',
                                                lineHeight: '2.0',
                                            }}
                                        />
                                    </div>
                                </Slate>
                                
                                {/* Floating Toolbar */}
                                {floatingToolbar.visible && (
                                    <FloatingToolbar
                                        component={floatingToolbar.component}
                                        onReplace={handleComponentReplace}
                                        onClose={closeFloatingToolbar}
                                        position={floatingToolbar.position}
                                    />
                                )}
                            </div>
                        </Col>
                        
                        <Col span={6}>
                            <div 
                                style={{
                                    padding: '16px',
                                    height: '100%',
                                    borderLeft: '1px solid #f0f0f0',
                                    background: '#fff',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <div style={{ 
                                    fontWeight: 'bold', 
                                    marginBottom: '16px',
                                    fontSize: '14px',
                                    color: '#333'
                                }}>
                                    Email Components ({components.length})
                                </div>
                                
                                <div style={{ flex: 1, overflowY: 'auto' }}>
                                    {components.length === 0 ? (
                                        <div style={{ 
                                            color: '#999', 
                                            fontStyle: 'italic',
                                            textAlign: 'center',
                                            marginTop: '20px',
                                            fontSize: '13px'
                                        }}>
                                            Click "Generate Components" to analyze email structure
                                        </div>
                                    ) : (
                                        components.map((component, index) => (
                                            <div
                                                key={component.id}
                                                style={{
                                                    marginBottom: '8px',
                                                    cursor: 'pointer',
                                                    padding: '12px',
                                                    backgroundColor: selectedComponentId === component.id ? '#e6f7ff' : 'white',
                                                    border: selectedComponentId === component.id ? '1px solid #1890ff' : '1px solid #e8e8e8',
                                                    borderRadius: '4px',
                                                    transition: 'all 0.2s',
                                                }}
                                                onClick={() => handleComponentSelect(component)}
                                            >
                                                <div style={{ 
                                                    display: 'flex', 
                                                    alignItems: 'center',
                                                    marginBottom: '6px'
                                                }}>
                                                    <Button 
                                                        size="small" 
                                                        type={selectedComponentId === component.id ? 'primary' : 'default'}
                                                        style={{ 
                                                            marginRight: '8px',
                                                            minWidth: '24px',
                                                            height: '24px',
                                                            padding: '0',
                                                            fontSize: '12px',
                                                        }}
                                                    >
                                                        {index + 1}
                                                    </Button>
                                                    <div style={{ 
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        color: selectedComponentId === component.id ? '#1890ff' : '#333',
                                                        lineHeight: '1.3'
                                                    }}>
                                                        {component.title}
                                                    </div>
                                                </div>
                                                
                                                {/* <div style={{
                                                    fontSize: '11px',
                                                    color: '#666',
                                                    lineHeight: '1.3',
                                                    marginLeft: '32px',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                }}>
                                                    {component.content}
                                                </div> */}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </Col>
                    </Row>
                    <Row style={{ height: '20%' }}>
                        <Col span={24}>
                        <div style={{padding: '16px'}}>
                            <p style={{fontWeight: 'bold', fontSize: '14px'}}>Intents</p> 
                            <Button>Apply to Selected Component</Button>
                            <Button>Cancel</Button>
                        </div>
                        <div className='intentCards'>
                            <Flex wrap gap="small">
                                {Array.from({ length: 5 }, (_, i) => (
                                 <Card title="Card title" key={i}>
                                 <Radio.Group
                                     style={{display: 'flex',flexDirection: 'column',gap: 8}}
                                     value={value}
                                     options={[
                                         { value: 1, label: 'Option A' },
                                         { value: 2, label: 'Option B' },
                                         { value: 3, label: 'Option C' }
                                     ]}
                                     ></Radio.Group>
                                 </Card>
                                ))}
                            </Flex>
                           
                        </div>
                        </Col>
                    </Row>
                    </div>
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
    );
};

export default EmailEditor;
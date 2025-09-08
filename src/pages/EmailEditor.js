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
    const [previewContent, setPreviewContent] = useState('');
    

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

        // 1. 新增：清除所有标记的函数
    const clearAllMarkers = () => {
        const cleanValue = value.map(node => ({
            ...node,
            children: node.children.map(child => {
                if (typeof child === 'string') {
                    return child;
                }
                // 移除所有标记，只保留文本和基本格式
                const { highlight, componentId, hasDimensions, linkedIntents, ...cleanChild } = child;
                return cleanChild;
            })
        }));
        
        setValue(cleanValue);
        setEditorKey(prev => prev + 1);
    };
    // Extract components using the component extractor
    const handleExtractComponents = async () => {
        try {
            setLoading(true);
            // 清除之前的所有dimension和highlight标记
            clearAllMarkers();
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
            setSelectedComponentId(null); // 清除选中状态
            setCombinedResults([]); // 清除之前的combined results
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

    // 改进的文本查找函数，支持精确匹配和跨段落搜索
    const findTextInEditor = (searchText, editorValue) => {
        if (!searchText || !editorValue) return null;

        // 构建完整的文本内容和位置映射
        let fullText = '';
        let nodeMap = [];
        let currentPos = 0;
        
        editorValue.forEach((node, nodeIndex) => {
            const nodeText = getNodeText(null, node);
            const nodeStart = currentPos;
            const nodeEnd = currentPos + nodeText.length;
            
            nodeMap.push({
                nodeIndex,
                nodeText,
                start: nodeStart,
                end: nodeEnd,
                node
            });
            
            fullText += nodeText;
            currentPos = nodeEnd;
            
            // 段落间添加分隔符
            if (nodeIndex < editorValue.length - 1) {
                fullText += '\n\n';
                currentPos += 2;
            }
        });
        
        // 更精确的文本标准化
        const normalizeForSearch = (text) => {
            return text
                .replace(/[\r\n]+/g, ' ')  // 换行转空格
                .replace(/\s+/g, ' ')      // 多空格转单空格
                .trim();
        };
        
        const searchNormalized = normalizeForSearch(searchText).toLowerCase();
        const fullNormalized = normalizeForSearch(fullText).toLowerCase();
        
        console.log('Searching for:', searchNormalized);
        console.log('In text:', fullNormalized.substring(0, 200) + '...');
        
        // 精确匹配
        let index = fullNormalized.indexOf(searchNormalized);
        
        // 如果精确匹配失败，尝试更宽松的匹配
        if (index === -1) {
            // 移除标点符号再试
            const searchClean = searchNormalized.replace(/[^\w\s]/g, '');
            const fullClean = fullNormalized.replace(/[^\w\s]/g, '');
            index = fullClean.indexOf(searchClean);
            
            if (index !== -1) {
                // 映射回原始位置
                let charCount = 0;
                for (let i = 0; i < fullNormalized.length; i++) {
                    if (fullNormalized[i].match(/[\w\s]/)) {
                        if (charCount === index) {
                            index = i;
                            break;
                        }
                        charCount++;
                    }
                }
            }
        }
        
        if (index === -1) {
            console.log('Text not found');
            return null;
        }
        
        const endIndex = index + searchNormalized.length;
        console.log('Found match at normalized position:', index, 'to', endIndex);
        
        return {
            start: index,
            end: endIndex,
            fullText: fullNormalized,
            originalText: fullText,
            nodeMap,
            originalSearchText: searchText
        };
    };

    const applyHighlightingToValue = (editorValue, componentContent, componentId) => {
        console.log('Applying highlighting for component:', componentId);
        console.log('Component content:', componentContent);
        
        // 获取该component的linkedIntents
        const combinedResult = combinedResults.find(result => result.id === componentId);
        const linkedIntents = combinedResult?.linkedIntents || [];
        
        // 清除所有highlight属性，保留dimension相关属性
        const cleanValue = editorValue.map(node => ({
            ...node,
            children: node.children.map(child => {
                if (typeof child === 'string') {
                    return child;
                }
                const { highlight, ...cleanChild } = child;
                return cleanChild;
            })
        }));
    
        const position = findTextInEditor(componentContent, cleanValue);
        if (!position) {
            console.log('Position not found, returning clean value');
            return cleanValue;
        }
    
        console.log('Found position:', position);
        
        // 使用新的nodeMap进行精确位置映射
        const { nodeMap, originalText } = position;
        const highlightStart = position.start;
        const highlightEnd = position.end;
        
        // 将标准化位置映射回原始文本位置
        const mapNormalizedToOriginal = (normalizedPos) => {
            let originalPos = 0;
            let normalizedCount = 0;
            
            for (let i = 0; i < originalText.length; i++) {
                const char = originalText[i];
                const normalizedChar = char.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
                
                if (normalizedCount === normalizedPos) {
                    return originalPos;
                }
                
                if (normalizedChar && normalizedChar !== ' ' || (normalizedChar === ' ' && position.fullText[normalizedCount] === ' ')) {
                    normalizedCount++;
                }
                originalPos++;
            }
            return originalPos;
        };
        
        const originalStart = mapNormalizedToOriginal(highlightStart);
        const originalEnd = mapNormalizedToOriginal(highlightEnd);
        
        console.log('Mapped positions - original:', originalStart, 'to', originalEnd);
        
        // 找到受影响的节点
        let currentPos = 0;
        const affectedNodes = [];
        
        nodeMap.forEach(nodeInfo => {
            const nodeStart = nodeInfo.start;
            const nodeEnd = nodeInfo.end;
            
            // 检查是否与高亮区域重叠
            if (!(nodeEnd <= originalStart || nodeStart >= originalEnd)) {
                const overlapStart = Math.max(nodeStart, originalStart);
                const overlapEnd = Math.min(nodeEnd, originalEnd);
                
                affectedNodes.push({
                    ...nodeInfo,
                    overlapStart: overlapStart - nodeStart,
                    overlapEnd: overlapEnd - nodeStart
                });
            }
        });
        
        console.log('Affected nodes:', affectedNodes);
        
        if (affectedNodes.length === 0) {
            return cleanValue;
        }
        
        // 应用高亮到受影响的节点
        const newValue = cleanValue.map((node, nodeIndex) => {
            const affectedNode = affectedNodes.find(n => n.nodeIndex === nodeIndex);
            if (!affectedNode) {
                return node;
            }
            
            const { nodeText, overlapStart, overlapEnd } = affectedNode;
            
            // 确保边界有效
            const validStart = Math.max(0, Math.min(overlapStart, nodeText.length));
            const validEnd = Math.max(validStart, Math.min(overlapEnd, nodeText.length));
            
            console.log(`Node ${nodeIndex}: highlighting from ${validStart} to ${validEnd} in "${nodeText}"`);
            
            // 分割文本
            const beforeText = nodeText.substring(0, validStart);
            const highlightText = nodeText.substring(validStart, validEnd);
            const afterText = nodeText.substring(validEnd);
            
            const newChildren = [];
            
            // 保留现有属性的辅助函数
            const preserveExistingProps = (text) => {
                const existingChild = node.children.find(child => 
                    child.text && child.text.includes(text)
                );
                return existingChild ? {
                    hasDimensions: existingChild.hasDimensions,
                    linkedIntents: existingChild.linkedIntents,
                    componentId: existingChild.componentId
                } : {};
            };
            
            if (beforeText) {
                newChildren.push({ 
                    text: beforeText,
                    ...preserveExistingProps(beforeText)
                });
            }
            
            if (highlightText) {
                // 判断是否为第一个文本节点（用于显示dimension圆圈）
                const isFirstTextNode = validStart === 0 && affectedNode === affectedNodes[0];
                
                newChildren.push({ 
                    text: highlightText, 
                    highlight: true, 
                    componentId: componentId,
                    hasDimensions: linkedIntents.length > 0,
                    linkedIntents: linkedIntents,
                    isFirstTextNode: isFirstTextNode,
                    ...preserveExistingProps(highlightText)
                });
            }
            
            if (afterText) {
                newChildren.push({ 
                    text: afterText,
                    ...preserveExistingProps(afterText)
                });
            }
            
            return {
                ...node,
                children: newChildren.length > 0 ? newChildren : [{ text: nodeText }]
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

    const removeAllHighlighting = () => {
        const cleanValue = value.map(node => ({
            ...node,
            children: node.children.map(child => {
                // 只移除highlight属性，保留dimension相关属性
                const { highlight, ...cleanChild } = child;
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

// New function to apply dimension markers to all components at once
const applyAllDimensions = () => {
    if (!combinedResults || combinedResults.length === 0) {
        console.log('No combined results available');
        return;
    }

    let newValue = [...value];
    
    // Apply dimensions for each component
    combinedResults.forEach(component => {
        if (component.linkedIntents && component.linkedIntents.length > 0) {
            newValue = applyDimensionsToValue(newValue, component.content, component.id, component.linkedIntents);
        }
    });
    
    setValue(newValue);
    setEditorKey(prev => prev + 1);
};

// Modified function to apply dimensions without removing existing ones
const applyDimensionsToValue = (editorValue, componentContent, componentId, linkedIntents) => {
    console.log('Applying dimensions for component:', componentId);
    console.log('Component content:', componentContent);
    
    const position = findTextInEditor(componentContent, editorValue);
    if (!position) {
        console.log('Position not found for component:', componentId);
        return editorValue;
    }

    console.log('Found position:', position);

    // Build position mapping: from normalized text position to actual node positions
    let currentNormalizedPos = 0;
    let nodePositions = [];
    
    editorValue.forEach((node, nodeIndex) => {
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
        if (nodeIndex < editorValue.length - 1) {
            currentNormalizedPos += 1; // Space between paragraphs
        }
    });

    // Find nodes that need dimension markers
    const highlightStart = position.start;
    const highlightEnd = position.end;
    
    const affectedNodes = nodePositions.filter(pos => 
        !(pos.normalizedEnd <= highlightStart || pos.normalizedStart >= highlightEnd)
    );

    if (affectedNodes.length === 0) {
        return editorValue;
    }

    // Apply dimension markers to affected nodes
    const newValue = editorValue.map((node, nodeIndex) => {
        const nodePos = nodePositions.find(pos => pos.nodeIndex === nodeIndex);
        if (!nodePos || !affectedNodes.includes(nodePos)) {
            return node;
        }

        // Calculate highlight range within current node
        const nodeStart = Math.max(0, highlightStart - nodePos.normalizedStart);
        const nodeEnd = Math.min(nodePos.normalizedText.length, highlightEnd - nodePos.normalizedStart);

        if (nodeStart >= nodeEnd) {
            return node;
        }

        // Map to original text positions
        const originalText = nodePos.originalText;
        let originalStart = 0;
        let originalEnd = originalText.length;

        // For partial matches, estimate positions
        if (nodeStart > 0 || nodeEnd < nodePos.normalizedText.length) {
            const startRatio = nodeStart / nodePos.normalizedText.length;
            const endRatio = nodeEnd / nodePos.normalizedText.length;
            
            originalStart = Math.floor(originalText.length * startRatio);
            originalEnd = Math.ceil(originalText.length * endRatio);
        }

        // Ensure valid boundaries
        originalStart = Math.max(0, Math.min(originalStart, originalText.length));
        originalEnd = Math.max(originalStart, Math.min(originalEnd, originalText.length));

        // Split text and apply dimension markers
        const beforeText = originalText.substring(0, originalStart);
        const dimensionText = originalText.substring(originalStart, originalEnd);
        const afterText = originalText.substring(originalEnd);

        const newChildren = [];
        if (beforeText) {
            newChildren.push({ text: beforeText });
        }
        if (dimensionText) {
            newChildren.push({ 
                text: dimensionText, 
                hasDimensions: true, 
                componentId: componentId,
                linkedIntents: linkedIntents
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

    return newValue;
};
// 2. 新增：为所有components初始化dimension标记的函数
const initializeAllDimensions = () => {
    if (!combinedResults || combinedResults.length === 0) {
        console.log('No combined results available');
        return;
    }

    let newValue = [...value];
    
    // 为每个component添加dimension标记
    combinedResults.forEach(component => {
        if (component.linkedIntents && component.linkedIntents.length > 0) {
            newValue = addDimensionsToValue(newValue, component.content, component.id, component.linkedIntents);
        }
    });
    
    setValue(newValue);
    setEditorKey(prev => prev + 1);
};

// 3. 新增：为特定component内容添加dimension标记的函数
const addDimensionsToValue = (editorValue, componentContent, componentId, linkedIntents) => {
    const position = findTextInEditor(componentContent, editorValue);
    if (!position) {
        console.log('Position not found for component:', componentId);
        return editorValue;
    }

    // 使用新的精确位置映射
    const { nodeMap, originalText } = position;
    const highlightStart = position.start;
    const highlightEnd = position.end;
    
    // 将标准化位置映射回原始文本位置
    const mapNormalizedToOriginal = (normalizedPos) => {
        let originalPos = 0;
        let normalizedCount = 0;
        
        for (let i = 0; i < originalText.length; i++) {
            const char = originalText[i];
            const normalizedChar = char.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');
            
            if (normalizedCount === normalizedPos) {
                return originalPos;
            }
            
            if (normalizedChar && normalizedChar !== ' ' || (normalizedChar === ' ' && position.fullText[normalizedCount] === ' ')) {
                normalizedCount++;
            }
            originalPos++;
        }
        return originalPos;
    };
    
    const originalStart = mapNormalizedToOriginal(highlightStart);
    const originalEnd = mapNormalizedToOriginal(highlightEnd);
    
    // 找到受影响的节点
    const affectedNodes = [];
    
    nodeMap.forEach(nodeInfo => {
        const nodeStart = nodeInfo.start;
        const nodeEnd = nodeInfo.end;
        
        if (!(nodeEnd <= originalStart || nodeStart >= originalEnd)) {
            const overlapStart = Math.max(nodeStart, originalStart);
            const overlapEnd = Math.min(nodeEnd, originalEnd);
            
            affectedNodes.push({
                ...nodeInfo,
                overlapStart: overlapStart - nodeStart,
                overlapEnd: overlapEnd - nodeStart
            });
        }
    });

    if (affectedNodes.length === 0) {
        return editorValue;
    }

    // 为受影响的节点添加dimension标记
    const newValue = editorValue.map((node, nodeIndex) => {
        const affectedNode = affectedNodes.find(n => n.nodeIndex === nodeIndex);
        if (!affectedNode) {
            return node;
        }
        
        const { nodeText, overlapStart, overlapEnd } = affectedNode;
        
        // 确保边界有效
        const validStart = Math.max(0, Math.min(overlapStart, nodeText.length));
        const validEnd = Math.max(validStart, Math.min(overlapEnd, nodeText.length));
        
        // 分割文本并添加dimension标记
        const beforeText = nodeText.substring(0, validStart);
        const dimensionText = nodeText.substring(validStart, validEnd);
        const afterText = nodeText.substring(validEnd);

        const newChildren = [];
        if (beforeText) {
            newChildren.push({ text: beforeText });
        }
        if (dimensionText) {
            // 判断是否为第一个文本节点（用于显示dimension圆圈）
            const isFirstTextNode = validStart === 0 && affectedNode === affectedNodes[0];
            
            newChildren.push({ 
                text: dimensionText,
                hasDimensions: true,
                componentId: componentId,
                linkedIntents: linkedIntents,
                isFirstTextNode: isFirstTextNode
            });
        }
        if (afterText) {
            newChildren.push({ text: afterText });
        }

        return {
            ...node,
            children: newChildren.length > 0 ? newChildren : [{ text: nodeText }]
        };
    });

    return newValue;
};
    // Color palette for dimension circles
    const colorPalette = ['#ff7875', '#ff9c6e', '#ffc069', '#d3f261', '#ffd666', '#fff566', '#95de64', '#5cdbd3', '#b37feb', '#ff85c0','#ffa39e','#ffbb96','#ffd591','#eaff8f','#ffe58f','#fffb8f','#b7eb8f','#87e8de','#d3adf7','#ffadd2'];
    
    // Track dimension-to-color mapping to prevent duplicates
    const dimensionColorMapRef = useRef(new Map());
    
    // Helper function to get unique dimension color from palette
    const getDimensionColor = (dimension) => {
        if (dimensionColorMapRef.current.has(dimension)) {
            return dimensionColorMapRef.current.get(dimension);
        }
        
        const usedColors = new Set(dimensionColorMapRef.current.values());
        const availableColor = colorPalette.find(color => !usedColors.has(color)) || colorPalette[0];
        
        dimensionColorMapRef.current.set(dimension, availableColor);
        return availableColor;
    };

    // 4. 修改后的renderLeaf函数 - 始终显示dimension圆圈
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
        
        // 检查是否有dimension标记，无论是否高亮都显示圆圈
        const hasDimensions = leaf.hasDimensions && leaf.linkedIntents && leaf.linkedIntents.length > 0;
        const isHighlighted = leaf.highlight;
        
        if (hasDimensions || isHighlighted) {
            // 获取dimension信息
            let dimensions = [];
            if (leaf.linkedIntents) {
                dimensions = leaf.linkedIntents;
            } else if (leaf.componentId) {
                // 如果没有直接的linkedIntents，从combinedResults中查找
                const combinedResult = combinedResults.find(result => result.id === leaf.componentId);
                dimensions = combinedResult?.linkedIntents || [];
            }
            
            // 根据是否高亮设置不同的文本样式
            const textStyle = isHighlighted ? {
                backgroundColor: '#fff3cd',
                border: '1px solid #ffc107',
                borderRadius: '2px',
                padding: '1px 2px',
                cursor: 'pointer'
            } : {
                cursor: 'pointer'
            };
            
            element = (
                <span style={{ position: 'relative' }}>
                    {/* 始终显示dimension圆圈 */}
                    {dimensions.length > 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '-12px',
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
                                    title={`${intent.dimension}: ${intent.current_value}`}
                                />
                            ))}
                        </div>
                    )}
                    
                    <span
                        {...attributes}
                        style={textStyle}
                        onClick={isHighlighted ? (e) => handleHighlightClick(e, leaf.componentId) : undefined}
                    >
                        {element}
                    </span>
                </span>
            );
        }
        
        return <span {...attributes}>{element}</span>;
    };




    const handleDimensionClick = (intent, componentId) => {
        console.log('Dimension clicked:', intent.dimension, 'for component:', componentId);
        
        // 查找对应的组件
        const component = components.find(c => c.id === componentId);
        if (!component) {
            console.log('Component not found:', componentId);
            return;
        }

        // 检查当前组件是否已经被选中和高亮
        const isCurrentlySelected = selectedComponentId === componentId;
        const isCurrentlyHighlighted = value.some(node => 
            node.children.some(child => 
                child.highlight && child.componentId === componentId
            )
        );

        // 如果已经选中且高亮，则不执行任何操作
        if (isCurrentlySelected && isCurrentlyHighlighted) {
            console.log('Component already selected and highlighted, no action needed');
            return;
        }

        // 选中对应的组件
        console.log('Selecting component:', component.id);
        setSelectedComponentId(component.id);
        
        // 高亮对应的内容
        console.log('Highlighting component content:', component.content);
        applyHighlighting(component.content, component.id);
        
        // 可选：显示提示信息
        message.info(`Selected dimension: ${intent.dimension}`);
    };

    // Handle applying preview content to selected component
    const handleApplyToSelectedComponent = (intentSelected) => {
        if (!selectedComponentId || !previewContent) {
            message.warning('No component selected or no preview content available');
            return;
        }

        // Find the selected component
        const selectedComponent = components.find(comp => comp.id === selectedComponentId);
        if (!selectedComponent) {
            message.error('Selected component not found');
            return;
        }

        console.log('Applying preview content:', previewContent);
        console.log('To component:', selectedComponent);
        console.log('With intent selected:', intentSelected);

        // Find the component text in the current editor value
        const position = findTextInEditor(selectedComponent.content, value);
        if (!position) {
            message.error('Could not locate component in editor');
            return;
        }

        // Simply replace the component content using a more direct approach
        const combinedResult = combinedResults.find(result => result.id === selectedComponentId);
        let linkedIntents = combinedResult?.linkedIntents || [];
        
        // Update linkedIntents with new intentSelected values if provided
        if (intentSelected) {
            linkedIntents = linkedIntents.map(intent => 
                intent.dimension === intentSelected.dimension 
                    ? {
                        ...intent,
                        current_value: intentSelected.current_value,
                        other_values: intentSelected.other_values
                    }
                    : intent
            );
        }
        
        // Update the editor value directly
        const newValue = value.map(node => {
            const nodeText = getNodeText(null, node);
            if (nodeText.includes(selectedComponent.content)) {
                // Replace the component content in this node
                const updatedText = nodeText.replace(selectedComponent.content, previewContent);
                return {
                    ...node,
                    children: [{
                        text: updatedText,
                        highlight: true,
                        componentId: selectedComponentId,
                        hasDimensions: linkedIntents.length > 0,
                        linkedIntents: linkedIntents
                    }]
                };
            }
            return node;
        });
        
        setValue(newValue);
        setEditorKey(prev => prev + 1);

        // Update component states
        setComponents(prevComponents => 
            prevComponents.map(comp => 
                comp.id === selectedComponentId ? { ...comp, content: previewContent } : comp
            )
        );

        // Update combinedResults with new content and updated linkedIntents
        setCombinedResults(prevResults => 
            prevResults.map(comp => 
                comp.id === selectedComponentId 
                    ? { 
                        ...comp, 
                        content: previewContent,
                        linkedIntents: linkedIntents
                    } 
                    : comp
            )
        );

        // Update originalText
        const updatedText = originalText.replace(selectedComponent.content, previewContent);
        setOriginalText(updatedText);
        
        // Save updated content to sessionData
        const saveDraft = async () => {
            try {
                await axios.post(`http://localhost:3001/sessiondata/${globalTaskId}/drafts/latest.md`, {
                    content: updatedText,
                });
                console.log('Draft saved to sessionData');
            } catch (error) {
                console.error('Error saving draft to sessionData:', error);
            }
        };
        saveDraft();
        
        // Clear preview content
        setPreviewContent('');
        
        message.success('Component content updated successfully');
    };

    // Add state update logic and debugging logs to handleRadioChange
    const handleRadioChange = async (dimension, newValue) => {
        try {
            console.log('Radio change detected:', { dimension, newValue });
    
            const selectedComponent = combinedResults.find(component => component.id === selectedComponentId);
            if (!selectedComponent) {
                console.error('No selected component found');
                return;
            }
    
            // Find the intent being changed
            const targetIntent = selectedComponent.linkedIntents.find(intent => intent.dimension === dimension);
            if (!targetIntent) {
                console.error('Target intent not found');
                return;
            }
    
            // Construct INTENT_SELECTED with the new value as current_value
            // and all other options (including the previous current_value) as other_values
            const allValues = [targetIntent.current_value, ...targetIntent.other_values];
            const otherValues = allValues.filter(value => value !== newValue);
    
            const intentSelected = {
                dimension,
                current_value: newValue,
                other_values: otherValues
            };
    
            // Construct INTENT_OTHERS from other intents of the same component
            const intentOthers = selectedComponent.linkedIntents
                .filter(intent => intent.dimension !== dimension)
                .map(intent => ({
                    dimension: intent.dimension,
                    current_value: intent.current_value
                }));
    
            console.log('INTENT_SELECTED:', intentSelected);
            console.log('INTENT_OTHERS:', intentOthers);
    
            // Update state to reflect the new selection
            setCombinedResults(prevResults => {
                return prevResults.map(component => {
                    if (component.id === selectedComponentId) {
                        return {
                            ...component,
                            linkedIntents: component.linkedIntents.map(intent => {
                                if (intent.dimension === dimension) {
                                    // Preserve the original order by swapping values instead of reordering
                                    const newOtherValues = [...intent.other_values];
                                    const oldCurrentValue = intent.current_value;
                                    
                                    // Find the index of the new value in other_values
                                    const newValueIndex = newOtherValues.indexOf(newValue);
                                    
                                    if (newValueIndex !== -1) {
                                        // Replace the new value with the old current value
                                        newOtherValues[newValueIndex] = oldCurrentValue;
                                    } else {
                                        // If new value is not in other_values, add old current value to the end
                                        newOtherValues.push(oldCurrentValue);
                                    }
                                    
                                    return {
                                        ...intent,
                                        current_value: newValue,
                                        other_values: newOtherValues
                                    };
                                }
                                return intent;
                            })
                        };
                    }
                    return component;
                });
            });
    
            // Call the API with the correct data structure
            const response = await axios.post('http://localhost:3001/intent-change-rewriter', {
                userName: globalUsername,
                taskId: globalTaskId,
                userTask,
                factorChoices: selectedComponent.linkedIntents,
                draftLatest: originalText,
                componentCurrent: selectedComponent.content,
                intentSelected,
                intentOthers
            });
    
            if (response.data && response.data.component_variations) {
                console.log('Component variations received:', response.data.component_variations);
                // Find the content that matches the selected intent value
                const matchingVariation = response.data.component_variations.find(
                    variation => variation.intent_value === newValue
                );
                console.log('Matching variation:', matchingVariation);
                if (matchingVariation) {
                    setPreviewContent(matchingVariation.content);
                }
                // Handle the response as needed
            }
        } catch (error) {
            console.error('Error calling /intent-change-rewriter:', error);
            message.error('Failed to process intent change');
        }
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
             // 初始化所有dimension标记
            setTimeout(() => {
                if (combinedResult.length > 0) {
                    initializeAllDimensionsWithResults(combinedResult);
                }
            }, 100);
        } catch (error) {
            console.error('Error processing combined result:', error);
        }
    };

    // 新增：使用传入的results初始化dimension标记
    const initializeAllDimensionsWithResults = (results) => {
        if (!results || results.length === 0) {
            console.log('No results provided');
            return;
        }

        let newValue = [...value];
        
        // 为每个component添加dimension标记
        results.forEach(component => {
            if (component.linkedIntents && component.linkedIntents.length > 0) {
                newValue = addDimensionsToValue(newValue, component.content, component.id, component.linkedIntents);
            }
        });
        
        setValue(newValue);
        setEditorKey(prev => prev + 1);
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
                    <Button type="primary">Generate Anchors</Button>
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
                    overflow: 'auto'
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
                                                    borderLeft: selectedComponentId === component.id ? '4px solid #1890ff' : '1px solid #e8e8e8',
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
                                                    {/* <Button 
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
                                                    </Button> */}
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
                    <Row style={{ height: '20%', overflow: 'auto' ,width:'100%'}}>
                        <Col span={24}>
                        <div style={{padding: '16px', display: 'flex'}}>
                            <div style={{fontWeight: 'bold', fontSize: '16px', marginRight: '16px'}}>Intents</div> 
                            <Button 
                                size="small" 
                                color="primary" 
                                variant="outlined" 
                                style={{marginRight:'16px'}}
                                onClick={handleApplyToSelectedComponent}
                                disabled={!selectedComponentId || !previewContent}
                            >
                                Apply to Selected Component
                            </Button>
                            
                        </div>
                        <div className='intentModificationPreview' style={{padding:'8px',margin:'0 16px', width:'100%', border:'1px solid #f0f0f0', backgroundColor:'#fafafa', borderRadius:'8px'}}>
                            <p style={{fontWeight: '600'}}>Modification Preview:</p>
                            <span className="intentModificationPreviewContent">{previewContent}</span>

                        </div>
                        <div className='intentCards' style={{padding:'8px 16px'}}>
                            <Flex wrap gap="small">
                                {selectedComponentId && combinedResults.length > 0 ? (
                                    combinedResults
                                        .find(component => component.id === selectedComponentId)?.linkedIntents
                                        .map((intent, i) => (
                                            <Card 
                                                title={
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        
                                                        {intent.dimension}
                                                    </div>
                                                }
                                                key={i}
                                                style={{ borderTop: `6px solid ${getDimensionColor(intent.dimension)}` }}
                                                onClick={(e) => {
                                                    e.stopPropagation(); // 阻止卡片点击事件影响其他组件
                                                }}
                                            >
                                                <Radio.Group
                                                    style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                                                    value={intent.current_value}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handleRadioChange(intent.dimension, e.target.value);
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    <Radio value={intent.current_value}>{intent.current_value}</Radio>
                                                    {intent.other_values.map((value, index) => (
                                                        <Radio key={index} value={value}>{value}</Radio>
                                                    ))}
                                                </Radio.Group>
                                            </Card>
                                        ))
                                ) : (
                                    <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
                                        No intents available. Select a component to view its intents.
                                    </div>
                                )}
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
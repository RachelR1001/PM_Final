import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createEditor, Editor, Transforms, Range, Text } from 'slate';
import { Slate, Editable, withReact, useSlate, ReactEditor } from 'slate-react';
import { Card, Typography, message, Button, Row, Col, Tooltip, Tag } from 'antd';
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

    // Find text positions in the editor for highlighting
    const findTextInEditor = (searchText) => {
        const fullText = value
            .map(node => getNodeText(editor, node))
            .join('\n\n');
        
        const index = fullText.toLowerCase().indexOf(searchText.toLowerCase());
        if (index === -1) return null;
        
        return {
            start: index,
            end: index + searchText.length,
            fullText
        };
    };

    // Apply highlighting to editor content - 修复后的版本
    const applyHighlighting = (componentContent, componentId) => {
        // 首先完全清除所有高亮
        const cleanValue = value.map(node => ({
            ...node,
            children: node.children.map(child => {
                // 移除所有高亮相关的属性
                const { highlight, componentId: oldComponentId, ...cleanChild } = child;
                return cleanChild;
            })
        }));

        const position = findTextInEditor(componentContent);
        if (!position) {
            setValue(cleanValue);
            setEditorKey(prev => prev + 1);
            return;
        }

        // 在清理后的内容上应用新的高亮
        let currentPos = 0;
        const newValue = cleanValue.map(node => {
            const nodeText = getNodeText(editor, node);
            const nodeStart = currentPos;
            const nodeEnd = currentPos + nodeText.length + 2; // +2 for paragraph breaks
            
            if (nodeStart <= position.start && position.end <= nodeEnd) {
                // This node contains the text to highlight
                const relativeStart = position.start - nodeStart;
                const relativeEnd = position.end - nodeStart;
                
                const beforeText = nodeText.substring(0, relativeStart);
                const highlightText = nodeText.substring(relativeStart, relativeEnd);
                const afterText = nodeText.substring(relativeEnd);
                
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
                
                currentPos = nodeEnd;
                return {
                    ...node,
                    children: newChildren.length > 0 ? newChildren : [{ text: nodeText }]
                };
            }
            
            currentPos = nodeEnd;
            return node;
        });
        
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
        
        // Apply highlighting style
        if (leaf.highlight) {
            element = (
                <span
                    style={{
                        backgroundColor: '#fff3cd',
                        border: '1px solid #ffc107',
                        borderRadius: '2px',
                        padding: '1px 2px',
                        cursor: 'pointer',
                    }}
                    onClick={(e) => handleHighlightClick(e, leaf.componentId)}
                >
                    {element}
                </span>
            );
        }
        
        return <span {...attributes}>{element}</span>;
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
                    <Row style={{ height: '100%' }}>
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
                                                lineHeight: '1.6',
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
                                    background: '#fafafa',
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
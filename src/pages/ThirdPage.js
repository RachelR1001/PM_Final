import React, { useMemo, useState, useEffect } from 'react';
import { createEditor, Editor, Transforms, Text } from 'slate';
import { Slate, Editable, withReact, useSlate } from 'slate-react';
import { Row, Col, Card, Typography, Tag } from 'antd';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const { Title, Text: AntText } = Typography;

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
    const { userName, userTask, taskId } = location.state || {};

    const editor = useMemo(() => withReact(createEditor()), []);
    
    // 设置一个稳定的初始值
    const initialValue = useMemo(() => [
        {
            type: 'paragraph',
            children: [{ text: 'Loading content...' }],
        },
    ], []);

    const [value, setValue] = useState(initialValue);
    const [loading, setLoading] = useState(true);
    const [contentLoaded, setContentLoaded] = useState(false);

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

    return (
        <div style={{ padding: '16px', background: '#f5f5f5', minHeight: '100vh' }}>
            <Row gutter={16}>
                {/* 左侧信息面板 - 4份 */}
                <Col span={4}>
                    <Card 
                        title="Task Information" 
                        size="small"
                        style={{ 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            height: 'fit-content'
                        }}
                    >
                        <div style={{ marginBottom: '16px' }}>
                            <AntText strong>User Name:</AntText>
                            <div style={{ marginTop: '4px' }}>
                                <Tag color="blue">{userName || 'N/A'}</Tag>
                            </div>
                        </div>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <AntText strong>Task ID:</AntText>
                            <div style={{ marginTop: '4px' }}>
                                <Tag color="green">{taskId || 'N/A'}</Tag>
                            </div>
                        </div>
                        
                        <div>
                            <AntText strong>User Task:</AntText>
                            <div style={{ 
                                marginTop: '8px',
                                padding: '12px',
                                background: '#f8f9fa',
                                borderRadius: '6px',
                                fontSize: '14px',
                                lineHeight: '1.5',
                                wordBreak: 'break-word'
                            }}>
                                {userTask || 'No task description available'}
                            </div>
                        </div>
                    </Card>
                </Col>
                
                {/* 右侧编辑器 - 20份 */}
                <Col span={20}>
                    <Card 
                        title="Email Draft Editor" 
                        size="small"
                        style={{ 
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                        bodyStyle={{ padding: 0 }}
                    >
                        {contentLoaded ? (
                            <div style={{
                                background: '#fff',
                                overflow: 'hidden',
                            }}>
                                <Slate
                                    editor={editor}
                                    initialValue={value}
                                    onValueChange={(newValue) => setValue(newValue)}
                                >
                                    <Toolbar />
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
        </div>
    );
};

// 辅助函数 - 切换文本格式
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

export default ThirdPage;
import React, { useState, useEffect, useRef } from 'react';
import { Row, Col, Button, Tooltip, Spin, Menu, Modal, Radio, Input } from 'antd';
import { SolutionOutlined, MailOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useDrag, useDrop } from 'react-dnd';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemTypes = {
    EMAIL_COMPONENT: 'emailComponent',
};

const DraggableComponent = ({ component, onRightClick }) => {
    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.EMAIL_COMPONENT,
        item: { component },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    return (
        <div
            ref={drag}
            style={{
                marginBottom: 10,
                padding: 8,
                border: '1px solid transparent',
                cursor: 'move',
                opacity: isDragging ? 0.6 : 1,
                transition: 'border-color 0.3s',
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#e8e8e8';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
            }}
            onContextMenu={(e) => {
                e.preventDefault(); 
                onRightClick(component, e); 
            }}
        >
            <Tooltip title={component.title}>
                <div>
                    <span style={{ color: '#999', marginRight: 8 }}>{component.title}</span>
                    <span>{component.tag}</span>
                </div>
            </Tooltip>
        </div>
    );
};

const DropZone = ({ components, setComponents, otherComponents, setOtherComponents, onComponentRightClick }) => {
    const ref = useRef(null);
    const [highlightIndex, setHighlightIndex] = useState(null);

    const [, drop] = useDrop({
        accept: ItemTypes.EMAIL_COMPONENT,
        drop: (item, monitor) => {
            const clientOffset = monitor.getClientOffset();
            const nodes = ref.current.childNodes;
            let insertIndex = components.length;
            for (let i = 0; i < nodes.length; i++) {
                const rect = nodes[i].getBoundingClientRect();
                if (clientOffset.y < rect.top + rect.height / 2) {
                    insertIndex = i;
                    break;
                }
            }
            const newComponents = [...components];
            newComponents.splice(insertIndex, 0, item.component);
            setComponents(newComponents);
            const newOtherComponents = otherComponents.filter((c) => c!== item.component);
            setOtherComponents(newOtherComponents);
            setHighlightIndex(null);
        },
        hover: (item, monitor) => {
            if (!ref.current) return;
            const clientOffset = monitor.getClientOffset();
            const nodes = ref.current.childNodes;
            let insertIndex = components.length;
            for (let i = 0; i < nodes.length; i++) {
                const rect = nodes[i].getBoundingClientRect();
                if (clientOffset.y < rect.top + rect.height / 2) {
                    insertIndex = i;
                    break;
                }
            }
            setHighlightIndex(insertIndex);
        },
        collect: (monitor) => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
        }),
    });

    return (
        <div ref={(node) => {
            ref.current = node;
            drop(node);
        }}>
            {components.map((component, index) => {
                const isHighlighted = index === highlightIndex;
                return (
                    <React.Fragment key={index}>
                        {isHighlighted && (
                            <div style={{ borderTop: '2px solid blue', margin: '5px 0' }} />
                        )}
                        <DraggableComponent
                            component={component}
                            onRightClick={onComponentRightClick}
                        />
                    </React.Fragment>
                );
            })}
            {highlightIndex === components.length && (
                <div style={{ borderTop: '2px solid blue', margin: '5px 0' }} />
            )}
        </div>
    );
};

const ThirdPage = () => {
    const location = useLocation();
    const { userInput, finalEmail, selectedOptions } = location.state || {};
    const [structuredComponents, setStructuredComponents] = useState([]);
    const [suggestedComponents, setSuggestedComponents] = useState([]);
    const [showStructured, setShowStructured] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const hasFetched = useRef(false); 
    const [contextMenuVisible, setContextMenuVisible] = useState(false);
    const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
    const [selectedComponent, setSelectedComponent] = useState(null);
    const [adjustResponse, setAdjustResponse] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [isModalLoading, setIsModalLoading] = useState(false); 
    const [selectedOption, setSelectedOption] = useState(null); 

    const extractEmailBody = (fullEmail) => {
        const start = fullEmail.indexOf('---') + 3;
        const end = fullEmail.lastIndexOf('---');
        return fullEmail.slice(start, end).trim();
    };
    const emailBody = extractEmailBody(finalEmail);

    const buildAnalysisPrompt = (emailContent) => `
What different components are included in this email? Please identify and list each distinct component in sequential order, ensuring that each component represents a single, continuous part of the email. For each component, provide a descriptive name followed by the associated original text slice. Split the components into reasonable and fine-grained parts, ensuring that even closely related ideas or sentences are separated into distinct components if they serve different purposes.

"""
${emailContent}
"""

Output format (do not include any other text or explanations):
1. Component Name: "Component Content"
2. Component Name: "Component Content"
...
`;

    const buildSuggestionPrompt = (userInput, structuredComponents, selectedOptions) => {
        const structuredText = structuredComponents.map((component) => `${component.title}: ${component.tag}`).join('\n');
        const factorsText = selectedOptions
           ? Object.entries(selectedOptions).map(([factor, option]) => `* ${factor}: ${option}`).join('\n')
            : '';

        return `You are an email writing assistant.

    The user's writing task is: ${userInput}

    The factors that the user selected might affect the tone of the email drafting: 
    ${factorsText}

    There is a baseline email generation which includes different components:
    """
    ${structuredText}
    """
    Based on your understanding, list potential new email components in the **EXACT FORMAT** below (no extra text, only numbered list; exactly,one line per component):
    1. Subject Line: "Change in Plans …"  
    2. Opening Gratitude: "I hope you're doing well …"  
    (If no components are needed, reply with "NA" exactly.)
    `;
    };

    useEffect(() => {
        if (emailBody &&!hasFetched.current) {
            hasFetched.current = true; 
            setIsAnalyzing(true);
            const analysisPrompt = buildAnalysisPrompt(emailBody);
            fetch('http://localhost:3001/analyze-email-structure', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ prompt: analysisPrompt })
            })
               .then(res => {
                    if (!res.ok) {
                        throw new Error(`Server error: ${res.status}`);
                    }
                    return res.json();
                })
               .then(data => {
                    setIsAnalyzing(false);
                    if (Array.isArray(data)) {
                        setStructuredComponents(data);
                        const suggestionPrompt = buildSuggestionPrompt(userInput, data, selectedOptions);
                        setIsSuggesting(true);
                        fetch('http://localhost:3001/suggest-email-components', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({ prompt: suggestionPrompt })
                        })
                           .then(suggestionRes => {
                                if (!suggestionRes.ok) {
                                    throw new Error(`Server error: ${suggestionRes.status}`);
                                }
                                return suggestionRes.json();
                            })
                           .then(suggestionData => {
                                if (Array.isArray(suggestionData) && suggestionData.length > 0) {
                                    setSuggestedComponents(suggestionData);
                                    setIsSuggesting(false);
                                } else {
                                    console.warn('Suggestion response is empty or invalid:', suggestionData);
                                    setSuggestedComponents([]);
                                }
                            })
                           .catch(suggestionError => {
                                console.error('Suggestion request failed:', suggestionError);
                                setSuggestedComponents([]);
                            });
                    } else {
                        console.error('Unexpected response format:', data);
                        setStructuredComponents([]);
                    }
                })
               .catch(error => {
                    setIsAnalyzing(false);
                    console.error('结构分析失败:', error);
                    setStructuredComponents([]);
                });
        }
    }, [emailBody, userInput, selectedOptions]);

    const buildAdjustPrompt = (userInput, factorsText, structuredText, component) => {
        const factorListTemplate = `
• Relationship type
    ◦ Supervisor and Student
    ◦ Friends and family
    ◦ Etc.
• Familiarity
    ◦ Familiar
        ▪ Knows each other and establishes some intimacy
        ▪ Knows each other but unfamiliar
    ◦ Strangers
• Power, resource, status, hierarchy difference
    ◦ Receiver is higher
    ◦ Equal
    ◦ Receiver is lower
• Needs for Maintaining relationship
    ◦ Get far away
    ◦ Remain the same 
    ◦ Get closer
• Culture
    ◦ Direct Western Culture
    ◦ Indirect Eastern Culture
• Personality traits
    ◦ Introverted
    ◦ Extroverted
• Promptness
    ◦ Urgent
    ◦ Non-urgent
• You want the receiver to feel you are
    ◦ Gratitude / Appreciation 🙏
    ◦ Excitement / Enthusiasm 🎉
    ◦ Apology / Regret 😔
    ◦ Frustration / Disappointment 😤
    ◦ Concern / Empathy 😨
    ◦ Neutral Emotion ⚪
• You want to avoid the receiver from feeling you are
    ◦ Avoid Disrespectful / Aggressive 😡
    ◦ Avoid Condescending / Patronizing 🙄
    ◦ Avoid Dismissive / Uncaring 😒
    ◦ Avoid Confusing / Unclear 😕
    ◦ Avoid Annoyed / Irritated 😤
    ◦ NA ⚪
• The mistake is more on which side?
    ◦ Our side
    ◦ Receiver's side
    ◦ It’s not whose mistake
• Occasion
    ◦ Formal: On behalf of an organization or writing for a formal event. Formal notification or announcement.
    ◦ Personal
• Avoid negative consequence
    ◦ Avoid being harsh
    ◦ Avoid breaking relationships
    ◦ Avoid being criticized by the receiver
    ◦ [To AI Helper: If you choose this factor as one of the most important factors, please generate several potential consequences which user may want to avoid in the given context, instead of directly using the given example]
• Balance competing factors
    ◦ Show apology vs. clearly state my request
    ◦ Clearly state my request but avoid hurting future relationships
    ◦ [To AI Helper: If you choose this factor as one of the most important factors, please generate several potential competing factors which user may want to avoid in the given context, instead of directly using the given example. Please start with “Avoid xxxx”, highlight it is avoid something.]
`;
        const adjustInstructionTemplate = `
There are 3 different kinds of revision can be made:
1. Choose from some given options, like Dear xxx or Hi xxx;
2. Need further user information, e.g. in the component named Reason for Decision, user might want to identify a personalized reason.
3. Need tone adjustment. If a component can neither be adjusted through choosing from a predefined format list nor receive further user input, they may benefit from a further tone adjustment.
Now please go through each component listed above, identify which exact minor revision can be made on the top of existing baseline.
If it belongs to “Choose from some given options”, then brainstorm some other options that user may want to select;
output format:
{
Type: "Choose from some given options",
Options: [
"Hi Mr. Tom,",
"Hello Mr. Tom,",
"Dear [First Name],"
]
}

If it belongs to “Need further user information”, then you do not need to take actions, just assign this label is fine.

output format:
{
Type: "Need further user information"
}

If it belongs to “Need tone adjustment”, then you firstly read the entire factor list and Your task is to provide one potential back-up factor and its options and option snippet from the factor list for users to select which exact tone they want to use in expressing this component:

output format:
{
Type: "Tone adjustment",
Factor: "Familiarity",
Reason: "This factor most affects the tone of the ​Expression of Gratitude because the level of familiarity influences how formal or personal the gratitude is expressed. Since the user has already indicated that the receiver is higher in hierarchy and the goal is to maintain or even strengthen the relationship, the tone should remain respectful but can vary in warmth and personalization based on familiarity.",
Options: [
{
"option": "Familiar (Knows each other and establishes some intimacy)",
"snippet": "I want to start by expressing my heartfelt gratitude for the opportunity to join your team and for the trust you’ve placed in me. Your belief in my potential means a great deal to me, and I’m truly honored to have been considered for this role."
},
{
"option": "Knows each other but unfamiliar (Professional acquaintance)",
"snippet": "I’d like to begin by expressing my sincere gratitude for the opportunity to join your team and for the trust you’ve placed in me. I deeply appreciate the time and effort you and your team have invested in this process."
},
{
"option": "Strangers (Little to no prior interaction)",
"snippet": "I want to take a moment to express my sincere gratitude for the opportunity to join your team and for the trust you’ve placed in me. It’s been a privilege to be considered for this role, and I truly value the chance to engage with your organization"
}
]
}
`;
        return `You are an email writing assistant.

The user's writing task is: ${userInput}

${factorListTemplate}

The factors that the user selected might affect the tone of the email drafting: 
${factorsText}

There is a baseline email generation which includes different components:
"""
${structuredText}
"""

The selected baseline component is:
- Title: ${component.title}
- Content: ${component.tag}

${adjustInstructionTemplate}
ONLY return a single-line JSON object, no code fences, no markdown.
For example:
{"Type":"Need further user information"}
`;
    };

    const handleComponentRightClick = (component, e) => {
        setSelectedComponent(component);
        setContextMenuPosition({ x: e.clientX, y: e.clientY });
        setContextMenuVisible(true);
    };

    const handleAdjustClick = async () => {
        setContextMenuVisible(false);
        setModalVisible(true);
        setIsModalLoading(true); 
        setSelectedOption(null); 

        const factorsText = selectedOptions 
            ? Object.entries(selectedOptions).map(([factor, option]) => `* ${factor}: ${option}`).join('\n') 
            : '';
        const structuredText = structuredComponents.map(c => `${c.title}: ${c.tag}`).join('\n');
        const prompt = buildAdjustPrompt(userInput, factorsText, structuredText, selectedComponent);

        try {
            const response = await fetch('http://localhost:3001/adjust-component', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            if (response.ok) {
                const data = await response.json();
                setAdjustResponse(data);
            } else {
                console.error('调整请求失败:', response.statusText);
            }
        } catch (error) {
            console.error('调整请求出错:', error);
        } finally {
            setIsModalLoading(false); 
        }
    };

    const handleConfirm = () => {
        if (selectedOption) {
            const newStructuredComponents = structuredComponents.map((component) => {
                if (component === selectedComponent) {
                    return {
                        ...component,
                        tag: selectedOption.snippet
                    };
                }
                return component;
            });
            setStructuredComponents(newStructuredComponents);
        }
        setModalVisible(false);
    };

    const handleCancel = () => {
        setModalVisible(false);
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Row className="page">
                <Col span={6} className="leftContainer">
                    <div className="emailTaskContent">
                        <div className="containerTitle">
                            <SolutionOutlined />
                            <span style={{ marginLeft: '4px' }}>My Email Task</span>
                        </div>
                        <p>{userInput}</p>
                        <div className="selectedFactors">
                            <h3>Selected Factors</h3>
                            {selectedOptions && Object.entries(selectedOptions).map(([factor, option], i) => (
                                <p key={i}><strong>{factor}:</strong> {option}</p>
                            ))}
                        </div>
                    </div>
                </Col>
                <Col span={showStructured ? 12 : 18} className="emailContainer">
                    <Button
                        type="primary"
                        onClick={() => setShowStructured(!showStructured)}
                        style={{ marginBottom: 16, marginLeft: 8 }}
                    >
                        {showStructured ? 'View Plain Text' : 'View Structured Components'}
                    </Button>

                    {isAnalyzing ? (
                        <Spin tip="Analyzing email structure..." size="large">
                            <div style={{ minHeight: 200 }} />
                        </Spin>
                    ) : showStructured ? (
                        <div className="structured-view">
                            <h3>Email Components (Drag to Rearrange)</h3>
                            <DropZone
                                components={structuredComponents}
                                setComponents={setStructuredComponents}
                                otherComponents={suggestedComponents}
                                setOtherComponents={setSuggestedComponents}
                                onComponentRightClick={handleComponentRightClick}
                            />
                        </div>
                    ) : (
                        <div className="emailTaskContent">
                            <div className="containerTitle">
                                <MailOutlined />
                                <span style={{ marginLeft: '4px' }}>Final Email Draft</span>
                            </div>
                            <div
                                className="emailDraft"
                                dangerouslySetInnerHTML={{ __html: emailBody.replace(/\n/g, '<br>') }}
                            />
                        </div>
                    )}
                </Col>
                {showStructured && (
                    <Col span={6} className="rightContainer">
                        {isSuggesting ? (
                            <Spin tip="Suggesting email components..." size="large">
                                <div style={{ minHeight: 200 }} />
                            </Spin>
                        ) : (
                            <>
                                <h3>Suggested Email Components</h3>
                                <DropZone
                                    components={suggestedComponents}
                                    setComponents={setSuggestedComponents}
                                    otherComponents={structuredComponents}
                                    setOtherComponents={setStructuredComponents}
                                    onComponentRightClick={handleComponentRightClick}
                                />
                            </>
                        )}
                    </Col>
                )}
            </Row>
            <Menu
                visible={contextMenuVisible}
                style={{
                    position: 'absolute',
                    left: contextMenuPosition.x,
                    top: contextMenuPosition.y,
                }}
                onClick={handleAdjustClick}
            >
                <Menu.Item key="adjust">Adjust</Menu.Item>
            </Menu>
            <Modal
                title="Adjust Component"
                visible={modalVisible}
                onCancel={handleCancel}
                footer={[
                    <Button key="cancel" onClick={handleCancel}>
                        取消
                    </Button>,
                    <Button key="confirm" type="primary" onClick={handleConfirm} disabled={!selectedOption}>
                        确认
                    </Button>
                ]}
            >
                {isModalLoading ? (
                    <Spin tip="正在请求数据..." size="large">
                        <div style={{ minHeight: 100 }} />
                    </Spin>
                ) : adjustResponse && (
                    <div style={{ padding: 20 }}>
                        {adjustResponse.Type === 'Choose from some given options' && (
                            <div>
                                <p>选择格式选项：</p>
                                <Radio.Group
                                    value={selectedOption ? selectedOption.option : null}
                                    onChange={(e) => {
                                        const selected = adjustResponse.Options.find(
                                            (option) => option === e.target.value
                                        );
                                        setSelectedOption({ option: selected, snippet: selected });
                                    }}
                                >
                                    {adjustResponse.Options.map((option) => (
                                        <Radio key={option} value={option}>
                                            {option}
                                        </Radio>
                                    ))}
                                </Radio.Group>
                            </div>
                        )}

                        {adjustResponse.Type === 'Need further user information' && (
                            <Input.TextArea
                                placeholder="请输入补充信息"
                                rows={4}
                                onChange={(e) => {
                                    setSelectedOption({ snippet: e.target.value });
                                }}
                            />
                        )}

                        {adjustResponse.Type === 'Tone adjustment' && (
                            <div>
                                <p>相关因素: {adjustResponse.Factor}</p>
                                <p>调整理由: {adjustResponse.Reason}</p>
                                <p>选择语气选项：</p>
                                <Radio.Group
                                    value={selectedOption ? selectedOption.option : null}
                                    onChange={(e) => {
                                        const selected = adjustResponse.Options.find(
                                            (optionObj) => optionObj.option === e.target.value
                                        );
                                        setSelectedOption(selected);
                                    }}
                                >
                                    {adjustResponse.Options.map(({ option, snippet }) => (
                                        <div key={option} style={{ marginBottom: 12 }}>
                                            <Radio value={option}>{option}</Radio>
                                            <p style={{ marginLeft: 24, color: '#666', fontSize: 14 }}>
                                                {snippet}
                                            </p>
                                        </div>
                                    ))}
                                </Radio.Group>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
        </DndProvider>
    );
};

export default ThirdPage;    
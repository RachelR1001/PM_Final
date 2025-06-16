import React, { useState, useEffect } from 'react';
import { Button, Row, Col, Tag, Space, Typography, Spin, Card, message, Radio } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { SolutionOutlined, SettingOutlined } from '@ant-design/icons';
import { useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { DndProvider } from 'react-dnd';

const ItemTypes = {
    TAG_GROUP: 'tagGroup',
};
const { Text, Link } = Typography;

const DraggableTagGroup = ({ group, onSelect }) => {
    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.TAG_GROUP,
        item: { group },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    return (
        <Card
            ref={drag}
            style={{
                marginBottom: 20,
                cursor: 'move',
                opacity: isDragging? 0.5 : 1
            }}
        >
            <h3>{group.title}</h3>
            {group.tags.map((tag) => (
                <Tag
                    key={tag}
                    onClick={() => onSelect(group.title, tag)}
                >
                    {tag}
                </Tag>
            ))}
        </Card>
    );
};

const DropZone = ({ onDrop, maxCount, allTagResponses, initialGroups, selectedOptions, setSelectedOptions }) => {
    const [collectedGroups, setCollectedGroups] = useState(initialGroups || []);

    const [, drop] = useDrop({
        accept: ItemTypes.TAG_GROUP,
        canDrop: (item) => collectedGroups.length < maxCount,
        drop: (item) => {
            const { group } = item;
            if (!collectedGroups.some((col) => col.title === group.title)) {
                const newCollectedGroups = [...collectedGroups, group];
                setCollectedGroups(newCollectedGroups);
                const newSelectedOptions = { ...selectedOptions };
                newSelectedOptions[group.title] = group.tags[0];
                setSelectedOptions(newSelectedOptions);
                onDrop(group);
            }
        },
    });

    const handleRemoveGroup = (groupToRemove) => {
        const newCollectedGroups = collectedGroups.filter(group => group.title!== groupToRemove.title);
        setCollectedGroups(newCollectedGroups);
        const newSelectedOptions = { ...selectedOptions };
        delete newSelectedOptions[groupToRemove.title];
        setSelectedOptions(newSelectedOptions);
        onDrop(null, groupToRemove);
    };

    const handleOptionChange = (e, groupTitle) => {
        const newSelectedOptions = { ...selectedOptions };
        newSelectedOptions[groupTitle] = e.target.value;
        setSelectedOptions(newSelectedOptions);
    };

    return (
        <div
            className="dropZone"
            ref={drop}
            style={{
                border: '2px dashed #ccc',
                padding: 10,
                minHeight: 100,
                marginTop: 8
            }}
        >
            {collectedGroups.map((group, index) => (
                <Card
                    key={index}
                    style={{ marginBottom: 20 }}
                    extra={<Button onClick={() => handleRemoveGroup(group)}>Remove</Button>}
                >
                    <h3>{group.title}</h3>
                    <Radio.Group
                        value={selectedOptions[group.title]}
                        onChange={(e) => handleOptionChange(e, group.title)}
                    >
                        {group.tags.map((tag) => (
                            <Radio key={tag} value={tag}>
                                {tag}
                                <p style={{ marginLeft: 20 }}>
                                    {allTagResponses[`${group.title}-${tag}`]? `"${allTagResponses[`${group.title}-${tag}`]}"` : 'Loading...'}
                                </p>
                            </Radio>
                        ))}
                    </Radio.Group>
                </Card>
            ))}
        </div>
    );
};

const SecondPage = () => {
    const location = useLocation();
    const { userInput } = location.state || {};
    const [formData, setFormData] = useState({});
    const [textInfo, setTextInfo] = useState({});
    const [generatedTexts, setGeneratedTexts] = useState({});
    const [isGlobalLoading, setIsGlobalLoading] = useState(true);
    const [allTagResponses, setAllTagResponses] = useState({});
    const [recommendedFactors, setRecommendedFactors] = useState([]);
    const navigate = useNavigate();
    const [selectedOptions, setSelectedOptions] = useState(() => {
        return recommendedFactors.reduce((acc, group) => {
            acc[group.title] = group.tags[0];
            return acc;
        }, {});
    });

    const tagGroups = [
        {
            title: 'Relationship type',
            tags: ['Supervisor and Student', 'Friends and family', 'Etc.']
        },
        {
            title: 'Familiarity',
            tags: [
                'Familiar',
                'Knows each other and establishes some intimacy',
                'Knows each other but unfamiliar',
                'Strangers'
            ]
        },
        {
            title: 'Power, resource, status, hierarchy difference',
            tags: ['Receiver is higher', 'Equal', 'Receiver is lower']
        },
        {
            title: 'Needs for Maintaining relationship',
            tags: ['Get far away', 'Remain the same', 'Get closer']
        },
        {
            title: 'Culture',
            tags: ['Direct Western Culture', 'Indirect Eastern Culture']
        },
        {
            title: 'Personality traits',
            tags: ['Introverted', 'Extroverted']
        },
        {
            title: 'Promptness',
            tags: ['Urgent', 'Non-urgent']
        },
        {
            title: 'You want the receiver to feel you are',
            tags: [
                'Gratitude / Appreciation 🙏',
                'Excitement / Enthusiasm 🎉',
                'Apology / Regret 😔',
                'Frustration / Disappointment 😤',
                'Concern / Empathy 😨',
                'Neutral Emotion ⚪'
            ]
        },
        {
            title: 'You want to avoid the receiver from feeling you are',
            tags: [
                'Avoid Disrespectful / Aggressive 😡',
                'Avoid Condescending / Patronizing 🙄',
                'Avoid Dismissive / Uncaring 😒',
                'Avoid Confusing / Unclear 😕',
                'Avoid Annoyed / Irritated 😤',
                'NA ⚪'
            ]
        },
        {
            title: 'The mistake is more on which side?',
            tags: ['Our side', 'Receiver\'s side', 'It’s not whose mistake']
        },
        {
            title: 'Occasion',
            tags: ['Formal: On behalf of an organization or writing for a formal event. Formal notification or announcement.', 'Personal']
        },
        {
            title: 'Avoid negative consequence',
            tags: [
                'Avoid being harsh',
                'Avoid breaking relationships',
                'Avoid being criticized by the receiver',
                '[To AI Helper: If you choose this factor as one of the most important factors, please generate several potential consequences which user may want to avoid in the given context, instead of directly using the given example]'
            ]
        },
        {
            title: 'Balance competing factors',
            tags: [
                'Show apology vs. clearly state my request',
                'Clearly state my request but avoid hurting future relationships',
                '[To AI Helper: If you choose this factor as one of the most important factors, please generate several potential competing factors which user may want to avoid in the given context, instead of directly using the given example. Please start with “Avoid xxxx”, highlight it is avoid something.]'
            ]
        }
    ];

    const generateSinglePrompt = (optionKey, optionLabel, optionValue) => {
        return `User want to write an email: ${userInput}
The factors might affect the tone of your drafting: 
${optionLabel}+${optionValue};

Generate One concise email sentence example that strictly reflect the tone factor. Each example should:
1. Be a single sentence fragment (no complete sentences)
2. Use "..." to omit non-essential parts
3. Focus on the key phrase that embodies the Lower tone
4. Avoid mentioning other options

Structure requirements:
• No section headers
• Separate examples with line breaks
• No explanations or additional text
`;
    };

    const sendSingleRequest = async (optionKey, optionLabel, optionValue) => {
        try {
            const response = await fetch('http://localhost:3001/generate-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: generateSinglePrompt(optionKey, optionLabel, optionValue)
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`单个请求出错: ${errorData.error}`);
                return null;
            }

            const data = await response.json();
            return data.text;
        } catch (err) {
            console.error('单个请求出错:', err);
            return null;
        }
    };

    const BATCH_SIZE = 6;
    const fetchAllTags = async () => {
        const allRequests = [];
        for (const group of tagGroups) {
            for (const tag of group.tags) {
                const optionKey = `${group.title}-${tag}`;
                allRequests.push(sendSingleRequest(optionKey, group.title, tag).then(response => ({ optionKey, response })));
            }
        }

        const responses = {};
        for (let i = 0; i < allRequests.length; i += BATCH_SIZE) {
            const batch = allRequests.slice(i, i + BATCH_SIZE);
            try {
                const results = await Promise.all(batch);
                results.forEach(result => {
                    if (result.response) {
                        responses[result.optionKey] = result.response;
                    }
                });
            } catch (err) {
                console.error('批量请求出错:', err);
            }
        }
        setAllTagResponses(responses);
    };

    const generateRecommendationPrompt = () => {
        return `You are an email writing assistant.
The user's writing task is: ${userInput}
There are several factors that may affect which tone you should use to help the user draft this email. Please first read the entire factor list, then **strictly select exactly three** most important factors you want to ask participants to choose from.
The factor list:
“””
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
“””
Output:
The three most important factors to consider for drafting this email are:
1. **Factor 1 Title**
2. **Factor 2 Title**
3. **Factor 3 Title**

By prioritizing these factors, the email can balance honesty about the decision with humility, clarity, and a focus on preserving mutual respect.`;
    };

    const fetchRecommendedFactors = async () => {
        try {
            const response = await fetch('http://localhost:3001/generate-recommended-factors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: generateRecommendationPrompt()
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`获取推荐因素出错: ${errorData.error}`);
                message.error('获取推荐因素失败，请稍后重试');
                return;
            }

            const recommended = await response.json();
            console.log('后端返回的推荐因素:', recommended);
            if (recommended.length === 0) {
                console.error('推荐因素为空');
                message.error('获取的推荐因素为空，请检查服务端配置');
            }
            setRecommendedFactors(recommended);
            const newSelectedOptions = recommended.reduce((acc, group) => {
                acc[group.title] = group.tags[0];
                return acc;
            }, {});
            setSelectedOptions(newSelectedOptions);
        } catch (err) {
            console.error('获取推荐因素出错:', err);
            message.error('获取推荐因素失败，请稍后重试');
        }
    };

    useEffect(() => {
        if (userInput) {
            Promise.all([fetchAllTags(), fetchRecommendedFactors()])
               .then(() => {
                    setIsGlobalLoading(false);
                })
               .catch(err => {
                    console.error('请求出错:', err);
                    setIsGlobalLoading(false);
                    message.error('请求出错，请稍后重试');
                });
        }
    }, [userInput]);

    const handleSelectTag = (groupTitle, tagValue) => {
        const optionKey = `${groupTitle}-${tagValue}`;
        setFormData({ [optionKey]: tagValue });
        setTextInfo({ [optionKey]: `Selected Tone Tag: ${tagValue}` });
        setGeneratedTexts({ [optionKey]: allTagResponses[optionKey] });
    };

    const generateFinalPrompt = () => {
        let allFactorsText = '';
        tagGroups.forEach(group => {
            allFactorsText += `${group.title}\n`;
            group.tags.forEach(tag => {
                allFactorsText += `${tag}\n`;
            });
            allFactorsText += '\n';
        });

        let selectedFactorsText = '';
        recommendedFactors.forEach(group => {
            const selectedOption = selectedOptions[group.title];
            selectedFactorsText += `* ${group.title}: ${selectedOption}\n`;
        });

        let representativeSnippetsText = '';
        recommendedFactors.forEach(group => {
            const selectedOption = selectedOptions[group.title];
            const optionKey = `${group.title}-${selectedOption}`;
            const snippet = allTagResponses[optionKey];
            if (snippet) {
                representativeSnippetsText += `* ${snippet}\n`;
            }
        });

        return `You are an email writing assistant.

The user's writing task is: ${userInput}

The factors might affect the tone of your drafting: 
${allFactorsText}
The user selected:
${selectedFactorsText}

Here are some representative snippets help you to get a better sense of what kind of tone may be suitable. However, you do not necessarily take all of them in the final generation.

Representative snippets:
${representativeSnippetsText}

The length of this email should be: Medium.`;
    };

    const sendFinalRequest = async () => {
        const finalPrompt = generateFinalPrompt();
        setIsGlobalLoading(true);
        try {
            const response = await fetch('http://localhost:3001/generate-final-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error(`发送最终请求出错: ${errorData.error}`);
                message.error('生成最终邮件失败，请稍后重试');
                return;
            }

            const data = await response.json();
            const finalEmail = data.text;

            const toneFactors = [];
            const allSelectedGroups = recommendedFactors;
            allSelectedGroups.forEach(group => {
                const selectedOption = selectedOptions[group.title];
                toneFactors.push({ groupTitle: group.title, tag: selectedOption });
            });
            const logData = {
                userInput,
                prompt: finalPrompt,
                toneFactors,
                finalEmail
            };

            await fetch('http://localhost:3001/save-log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData)
            });

            navigate('/third', { state: { userInput, formData, finalEmail, selectedOptions } });
        } catch (err) {
            console.error('发送最终请求出错:', err);
            message.error('生成最终邮件失败，请稍后重试');
        } finally {
            setIsGlobalLoading(false);
        }
    };

    const handleTagDrop = (addedGroup, removedGroup) => {
        if (addedGroup) {
            const newRecommendedFactors = [...recommendedFactors, addedGroup];
            setRecommendedFactors(newRecommendedFactors);
            const newSelectedOptions = { ...selectedOptions };
            newSelectedOptions[addedGroup.title] = addedGroup.tags[0];
            setSelectedOptions(newSelectedOptions);
        }
        if (removedGroup) {
            const newRecommendedFactors = recommendedFactors.filter(group => group.title!== removedGroup.title);
            setRecommendedFactors(newRecommendedFactors);
            const newSelectedOptions = { ...selectedOptions };
            delete newSelectedOptions[removedGroup.title];
            setSelectedOptions(newSelectedOptions);
        }
    };

    const handleSubmit = () => {
        sendFinalRequest();
    };

    const getAvailableTagGroups = () => {
        const selectedTitles = recommendedFactors.map(group => group.title);
        return tagGroups.filter(group =>!selectedTitles.includes(group.title));
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Spin spinning={isGlobalLoading}>
                <Row className="page">
                    <Col span={4} className="leftContainer">
                        <div className="emailTaskContent">
                            <div className="containerTitle">
                                <SolutionOutlined />
                                <span style={{ marginLeft: '4px' }}>My Email Task</span>
                            </div>
                            <p>{userInput}</p>
                        </div>
                    </Col>

                    <Col span={12} className="centerContainer">
                        <div className="dragContainer">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                The following are the system-recommended top three factors. If you need to adjust them, you can drag and modify from the factor list on the right.
                                </div>
                                <Button type="primary" onClick={handleSubmit} style={{ float: 'right', margin: '20px 24px' }} disabled={recommendedFactors.length === 0}>
                                    Generate Final Email
                                </Button>
                            </div>
                            {!isGlobalLoading && (
                                <DropZone
                                    onDrop={handleTagDrop}
                                    maxCount={3}
                                    allTagResponses={allTagResponses}
                                    initialGroups={recommendedFactors}
                                    selectedOptions={selectedOptions}
                                    setSelectedOptions={setSelectedOptions}
                                />
                            )}
                        </div>
                    </Col>

                    <Col span={8} className="rightContainer">
                        <div className="emailTaskContent">
                            <div className="containerTitle">
                                <SettingOutlined />
                                <span style={{ marginLeft: '4px' }}>Tone Setting</span>
                            </div>
                            {getAvailableTagGroups().map((group, index) => (
                                <DraggableTagGroup
                                    key={index}
                                    group={group}
                                    onSelect={handleSelectTag}
                                />
                            ))}
                        </div>
                    </Col>
                </Row>
            </Spin>
        </DndProvider>
    );
};

export default SecondPage;    
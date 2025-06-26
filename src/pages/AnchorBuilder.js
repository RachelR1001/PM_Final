import React, { useState } from 'react';
import { Card, Input, Row, Col, Button, message, Radio } from 'antd';
import { useLocation } from 'react-router-dom';
import axios from 'axios';

const AnchorBuilder = () => {
    const location = useLocation();
    const { anchorContent } = location.state || {};
    const [personaTitle, setPersonaTitle] = useState('');
    const [personaDescription, setPersonaDescription] = useState('');
    const [situationTitle, setSituationTitle] = useState('');
    const [situationDescription, setSituationDescription] = useState('');
    const [isEditingPersona, setIsEditingPersona] = useState(false);
    const [isEditingSituation, setIsEditingSituation] = useState(false);
    const [selectedAnchorType, setSelectedAnchorType] = useState('persona');
    const [editorPrompt, setEditorPrompt] = useState('');

    // Parse the anchorContent into persona and situation anchors
    React.useEffect(() => {
        if (anchorContent) {
            try {
                // Remove Markdown-style code block delimiters
                const sanitizedContent = anchorContent.replace(/```json|```/g, '');
                const parsedContent = JSON.parse(sanitizedContent);
                setPersonaTitle(parsedContent.persona?.title || 'Persona Anchor');
                setPersonaDescription(parsedContent.persona?.description || '');
                setSituationTitle(parsedContent.situation?.title || 'Situation Anchor');
                setSituationDescription(parsedContent.situation?.description || '');
            } catch (error) {
                console.error('Failed to parse anchor content:', error);
                message.error('Failed to load anchor content.');
            }
        }
    }, [anchorContent]);

    const handleSavePersona = async () => {
        const { userName, taskId } = location.state || {}; // 从 location.state 获取 userName 和 taskId

        if (!userName || !taskId) {
            message.error('Missing userName or taskId. Please try again.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/update-anchor', {
                type: 'persona',
                title: personaTitle,
                description: personaDescription,
                userName, // 添加 userName
                taskId,   // 添加 taskId
            });

            if (response.status === 200) {
                message.success('Persona Anchor saved successfully!');
                setIsEditingPersona(false);
            } else {
                throw new Error('Failed to save Persona Anchor');
            }
        } catch (error) {
            console.error('Error saving Persona Anchor:', error);
            message.error('Failed to save Persona Anchor. Please try again.');
        }
    };

    const handleSaveSituation = async () => {
        const { userName, taskId } = location.state || {}; // 从 location.state 获取 userName 和 taskId

        if (!userName || !taskId) {
            message.error('Missing userName or taskId. Please try again.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/update-anchor', {
                type: 'situation',
                title: situationTitle,
                description: situationDescription,
                userName, // 添加 userName
                taskId,   // 添加 taskId
            });

            if (response.status === 200) {
                message.success('Situation Anchor saved successfully!');
                setIsEditingSituation(false);
            } else {
                throw new Error('Failed to save Situation Anchor');
            }
        } catch (error) {
            console.error('Error saving Situation Anchor:', error);
            message.error('Failed to save Situation Anchor. Please try again.');
        }
    };

    const handleRegenerateAnchor = async () => {
        const { userName, taskId } = location.state || {}; // Get userName and taskId from location.state

        if (!userName || !taskId) {
            message.error('Missing userName or taskId. Please try again.');
            return;
        }

        if (!editorPrompt.trim()) {
            message.error('Please input your instruction prompts.');
            return;
        }

        try {
            const response = await axios.post('http://localhost:3001/api/regenerate-anchor', {
                userName,
                taskId,
                anchorType: selectedAnchorType,
                userPrompt: editorPrompt,
            });

            if (response.status === 200) {
                message.success(`${selectedAnchorType} Anchor regenerated successfully!`);
                const updatedAnchor = response.data.updatedAnchor;
                if (selectedAnchorType === 'persona') {
                    setPersonaTitle(updatedAnchor.title);
                    setPersonaDescription(updatedAnchor.description);
                } else {
                    setSituationTitle(updatedAnchor.title);
                    setSituationDescription(updatedAnchor.description);
                }
            } else {
                throw new Error('Failed to regenerate anchor');
            }
        } catch (error) {
            console.error('Error regenerating anchor:', error);
            message.error('Failed to regenerate anchor. Please try again.');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <Row gutter={[16, 16]}>
                <Col span={24}>
                    <Card bordered style={{ width: '100%' }} title="Persona Anchor">
                        {isEditingPersona ? (
                            <>
                                <Input
                                    value={personaTitle}
                                    onChange={(e) => setPersonaTitle(e.target.value)}
                                    placeholder="Enter Persona Title"
                                    style={{ marginBottom: '10px' }}
                                />
                                <Input.TextArea
                                    value={personaDescription}
                                    onChange={(e) => setPersonaDescription(e.target.value)}
                                    rows={6}
                                    placeholder="Enter Persona Description"
                                />
                            </>
                        ) : (
                            <>
                                <h3>{personaTitle || 'No title available.'}</h3>
                                <p>{personaDescription || 'No description available.'}</p>
                            </>
                        )}
                        <div style={{ marginTop: '10px' }}>
                            {isEditingPersona ? (
                                <Button type="primary" onClick={handleSavePersona}>
                                    Save
                                </Button>
                            ) : (
                                <Button onClick={() => setIsEditingPersona(true)}>Edit</Button>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
                <Col span={24}>
                    <Card bordered style={{ width: '100%' }} title="Situation Anchor">
                        {isEditingSituation ? (
                            <>
                                <Input
                                    value={situationTitle}
                                    onChange={(e) => setSituationTitle(e.target.value)}
                                    placeholder="Enter Situation Title"
                                    style={{ marginBottom: '10px' }}
                                />
                                <Input.TextArea
                                    value={situationDescription}
                                    onChange={(e) => setSituationDescription(e.target.value)}
                                    rows={6}
                                    placeholder="Enter Situation Description"
                                />
                            </>
                        ) : (
                            <>
                                <h3>{situationTitle || 'No title available.'}</h3>
                                <p>{situationDescription || 'No description available.'}</p>
                            </>
                        )}
                        <div style={{ marginTop: '10px' }}>
                            {isEditingSituation ? (
                                <Button type="primary" onClick={handleSaveSituation}>
                                    Save
                                </Button>
                            ) : (
                                <Button onClick={() => setIsEditingSituation(true)}>Edit</Button>
                            )}
                        </div>
                    </Card>
                </Col>
            </Row>
            <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
                <Col span={24}>
                    <Card bordered style={{ width: '100%' }} title="Anchor Editor">
                        <div>
                            <Radio.Group
                                value={selectedAnchorType}
                                onChange={(e) => setSelectedAnchorType(e.target.value)}
                                style={{ marginBottom: '10px' }}
                            >
                                <Radio value="persona">Persona Anchor</Radio>
                                <Radio value="situation">Situation Anchor</Radio>
                            </Radio.Group>
                            <Input.TextArea
                                value={editorPrompt}
                                onChange={(e) => setEditorPrompt(e.target.value)}
                                rows={4}
                                placeholder="Please input your instruction prompts to regenerate selected anchor"
                                style={{ marginBottom: '10px' }}
                            />
                            <Button type="primary" onClick={handleRegenerateAnchor}>
                                Regenerate
                            </Button>
                        </div>
                    </Card>
                </Col>
            </Row>
        </div>
    );
};

export default AnchorBuilder;

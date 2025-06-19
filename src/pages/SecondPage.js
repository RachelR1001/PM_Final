import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Radio, Checkbox, Spin, message, Tag, Button, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const { Text } = Typography;

const SecondPage = () => {
    const location = useLocation();
    const { userTask, userName, taskId } = location.state || {};
    console.log('userName:', userName); // 检查 userName 是否正确传递
    console.log('userTask:', userTask); // 检查 userTask 是否正确传递
    console.log('taskId:', taskId); // 检查 taskId 是否正确传递
    const [factors, setFactors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedCards, setSelectedCards] = useState([]); // 存储多选的卡片
    const [selectedOptions, setSelectedOptions] = useState({}); // 存储每个卡片内的单选选项
    const [snippets, setSnippets] = useState({}); // 存储每个卡片的 snippet
    const [loadingSnippets, setLoadingSnippets] = useState({}); // 存储每个卡片的加载状态
    const [generatingEmail, setGeneratingEmail] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        console.log('userTask:', userTask); // 检查 userTask 是否有值
        const fetchRankedFactors = async () => {
            try {
                const response = await axios.post('http://localhost:3001/rank-and-revise-factors', {
                    userTask, // 使用从 FirstPage 传递过来的 userTask
                });
                setFactors(response.data);
            } catch (error) {
                console.error('获取 ranked factors 出错:', error);
                message.error('获取 ranked factors 出错，请稍后重试');
            } finally {
                setLoading(false);
            }
        };

        if (userTask) {
            fetchRankedFactors();
        } else {
            message.error('userTask 未传递，请检查 FirstPage 的跳转逻辑');
            setLoading(false);
        }
    }, [userTask]);

    const handleCardSelect = (factorId) => {
        setSelectedCards((prevSelectedCards) => {
            if (prevSelectedCards.includes(factorId)) {
                return prevSelectedCards.filter((id) => id !== factorId);
            } else {
                return [...prevSelectedCards, factorId];
            }
        });
    };

    const handleOptionChange = async (factorId, option) => {
        setSelectedOptions((prevSelectedOptions) => ({
            ...prevSelectedOptions,
            [factorId]: option,
        }));

        // 设置当前卡片的加载状态为 true
        setLoadingSnippets((prevLoadingSnippets) => ({
            ...prevLoadingSnippets,
            [factorId]: true,
        }));

        // 发送请求获取 snippet
        try {
            const response = await axios.post('http://localhost:3001/generate-snippet', {
                userTask,
                factorName: factors.find((factor) => factor.id === factorId)?.title || '',
                factorOption: option,
            });

            if (response.data && response.data.snippet) {
                setSnippets((prevSnippets) => ({
                    ...prevSnippets,
                    [factorId]: response.data.snippet,
                }));
            } else {
                message.error('未能生成 snippet，请稍后重试');
            }
        } catch (error) {
            console.error('生成 snippet 出错:', error);
            message.error('生成 snippet 出错，请稍后重试');
        } finally {
            // 设置当前卡片的加载状态为 false
            setLoadingSnippets((prevLoadingSnippets) => ({
                ...prevLoadingSnippets,
                [factorId]: false,
            }));
        }
    };

    const getTagColor = (index) => {
        if (index < 4) return { color: 'green', text: 'Highly Recommend' };
        if (index >= factors.length - 3) return { color: 'yellow', text: 'Low Recommend' };
        return { color: 'blue', text: 'Recommend' };
    };

    const handleGenerateEmail = async () => {
        setGeneratingEmail(true);

        try {
            // Step 1: 将选中的 factors 和 options 写入后端
            const factorChoices = selectedCards.map((factorId) => ({
                id: factorId,
                title: factors.find((factor) => factor.id === factorId)?.title || '',
                options: [selectedOptions[factorId]],
            }));

            await axios.post('http://localhost:3001/save-factor-choices', {
                userName,
                factorChoices,
                taskId,
            });

            // Step 2: 调用 Intent Analyzer
            const intentResponse = await axios.post('http://localhost:3001/analyze-intent', {
                userName,
                userTask,
                factorChoices,
                taskId,
            });

            if (!intentResponse.data || !Array.isArray(intentResponse.data)) {
                throw new Error('Intent Analyzer 返回数据格式错误');
            }

            // Step 3: 调用 First-Draft Composer
            const draftResponse = await axios.post('http://localhost:3001/generate-first-draft', {
                userName,
                userTask,
                factorChoices,
                intents: intentResponse.data,
                taskId,
            });

            if (!draftResponse.data || !draftResponse.data.draft) {
                throw new Error('First-Draft Composer 返回数据格式错误');
            }

            // 确保所有请求完成后再跳转
            navigate('/third', {
                state: {
                    taskId,
                    userTask,
                    userName
                },
            });

            message.success('Email draft generated successfully!');
        } catch (error) {
            console.error('生成邮件时出错:', error);
            message.error('生成邮件时出错，请稍后重试');
        } finally {
            setGeneratingEmail(false);
        }
    };

    // 检查是否满足激活按钮的条件
    const isButtonDisabled = () => {
        if (selectedCards.length < 3) return true; // 至少选择三个卡片
        for (const cardId of selectedCards) {
            if (!selectedOptions[cardId]) return true; // 每个选中的卡片必须有选中的选项
        }
        return false;
    };

    return (
        <Spin spinning={loading || generatingEmail} tip="Loading...">
            <div style={{ height: '100vh' }}>
                <Row gutter={[16, 16]} style={{ height: '100vh', overflow: 'hidden' }}>
                    {/* 左侧栅格 */}
                    <Col span={4} style={{ borderRight: '1px solid #e9e9e9', padding: '16px' }}>
                        <h3>User Information:</h3>
                        <p style={{ wordBreak: 'break-word' }}>Name: {userName || 'No name provided'}</p>
                        <h3>Your Email Task:</h3>
                        <p style={{ wordBreak: 'break-word' }}>{userTask || 'No task provided'}</p>
                    </Col>

                    {/* 右侧栅格 */}
                    <Col span={20} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        {/* 顶部固定部分 */}
                        <div
                            style={{
                                padding: '16px',
                                background: '#fff',
                                borderBottom: '1px solid #e9e9e9',
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                            }}
                        >
                            <p style={{ marginBottom: '8px' }}>
                                Please select at least 3 factors and its option to generate an email draft
                            </p>
                            <Button
                                type="primary"
                                disabled={isButtonDisabled()} // 根据条件激活按钮
                                onClick={handleGenerateEmail}
                            >
                                Generate Email
                            </Button>
                        </div>

                        {/* 下半部分卡片网格系统 */}
                        <div
                            style={{
                                flex: 1,
                                overflowY: 'auto',
                                padding: '16px',
                                background: '#f5f5f5',
                            }}
                        >
                            <Row gutter={[16, 16]}>
                                {factors.map((factor, index) => {
                                    const tagInfo = getTagColor(index);
                                    return (
                                        <Col span={12} key={factor.id}> {/* 双行显示 */}
                                            <Card
                                                bordered
                                                style={{
                                                    borderColor: selectedCards.includes(factor.id) ? '#1890ff' : '#f0f0f0',
                                                }}
                                                title={
                                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                                        <Checkbox
                                                            checked={selectedCards.includes(factor.id)}
                                                            onChange={() => handleCardSelect(factor.id)}
                                                            style={{ marginRight: 8 }}
                                                        />
                                                        <div style={{ fontSize: '14px', wordBreak: 'break-word', flex: 1 }}>
                                                            {factor.title}
                                                        </div>
                                                        <Tag color={tagInfo.color}>{tagInfo.text}</Tag>
                                                    </div>
                                                }
                                            >
                                                <Radio.Group
                                                    onChange={(e) => handleOptionChange(factor.id, e.target.value)}
                                                    value={selectedOptions[factor.id]}
                                                    disabled={!selectedCards.includes(factor.id)} // 禁用未选中的卡片内的选项
                                                >
                                                    {factor.options.map((option) => (
                                                        <Radio key={option} value={option}>
                                                            {option}
                                                        </Radio>
                                                    ))}
                                                </Radio.Group>
                                                {loadingSnippets[factor.id] ? (
                                                    <Spin
                                                        tip="loading the snippet"
                                                        style={{ display: 'block', marginTop: '8px' }}
                                                    />
                                                ) : (
                                                    snippets[factor.id] && (
                                                        <Text type="secondary" style={{ display: 'block', marginTop: '8px' }}>
                                                            Snippet: "{snippets[factor.id]}"
                                                        </Text>
                                                    )
                                                )}
                                            </Card>
                                        </Col>
                                    );
                                })}
                            </Row>
                        </div>
                    </Col>
                </Row>
            </div>
        </Spin>
    );
};

export default SecondPage;
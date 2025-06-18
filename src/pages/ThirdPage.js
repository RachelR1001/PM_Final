import React, { useEffect, useState } from 'react';
import { Row, Col, Spin, message } from 'antd';
import { useLocation } from 'react-router-dom';
import SlateEditor from './SlateEditor';
import axios from 'axios';

const ThirdPage = () => {
    const location = useLocation();
    const { taskId, userTask } = location.state || {};

    const [factorChoices, setFactorChoices] = useState([]);
    const [intentCurrent, setIntentCurrent] = useState([]);
    const [draft, setDraft] = useState([
        {
            type: 'paragraph',
            children: [{ text: 'Loading content...' }],
        },
    ]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 从后端获取 factors/choices.json
                const factorResponse = await axios.get(`http://localhost:3001/sessiondata/${taskId}/factors/choices.json`);
                setFactorChoices(factorResponse.data);

                // 从后端获取 intents/current.json
                const intentResponse = await axios.get(`http://localhost:3001/sessiondata/${taskId}/intents/current.json`);
                setIntentCurrent(intentResponse.data);

                // 从后端获取 drafts/latest.md
                const draftResponse = await axios.get(`http://localhost:3001/sessiondata/${taskId}/drafts/latest.md`);
                const draftContent = draftResponse.data || 'No content available.';

                // 将 draftContent 转换为 Slate.js 格式
                const slateContent = draftContent
                    .split('\n\n') // 按段落分割
                    .map((paragraph) => ({
                        type: 'paragraph',
                        children: [{ text: paragraph.trim() }],
                    }));

                setDraft(slateContent);
            } catch (error) {
                console.error('加载数据失败:', error);
                message.error('加载数据失败，请稍后重试');
                // 设置默认值以防止 Slate 报错
                setDraft([
                    {
                        type: 'paragraph',
                        children: [{ text: 'No content available.' }],
                    },
                ]);
            } finally {
                setLoading(false);
            }
        };

        if (taskId) {
            fetchData();
        } else {
            message.error('taskId 未传递，请检查 SecondPage 的跳转逻辑');
            setLoading(false);
        }
    }, [taskId]);

    return (
        <Spin spinning={loading}>
            <Row gutter={[16, 16]} style={{ height: '100vh', overflow: 'hidden' }}>
                {/* 左侧栅格 */}
                <Col span={4} style={{ borderRight: '1px solid #e9e9e9', padding: '16px' }}>
                    <h3>Task Information:</h3>
                    <p><strong>Task ID:</strong> {taskId}</p>
                    <p><strong>User Task:</strong> {userTask}</p>
                    <h3>Selected Factors:</h3>
                    <ul>
                        {factorChoices.map((factor, index) => (
                            <li key={index}>
                                <strong>{factor.title}:</strong> {factor.options.join(', ')}
                            </li>
                        ))}
                    </ul>
                </Col>

                {/* 中间栅格 */}
                <Col span={16} style={{ padding: '16px', background: '#f5f5f5' }}>
                    <h3>Email Draft:</h3>
                    <SlateEditor initialContent={draft} />
                </Col>

                {/* 右侧栅格 */}
                <Col span={4} style={{ borderLeft: '1px solid #e9e9e9', padding: '16px' }}>
                    <h3>Intent Analysis:</h3>
                    <ul>
                        {intentCurrent.map((intent, index) => (
                            <li key={index}>
                                <strong>{intent.dimension}:</strong> {intent.value}
                            </li>
                        ))}
                    </ul>
                </Col>
            </Row>
        </Spin>
    );
};

export default ThirdPage;    
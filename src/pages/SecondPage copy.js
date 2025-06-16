import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Radio, Row, Col } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { SolutionOutlined, SettingOutlined } from '@ant-design/icons';

const SecondPage = () => {
    const location = useLocation();
    const { userInput } = location.state || {};
    const [formData, setFormData] = useState({
        option1: 'Lower'
    });
    const [textInfo, setTextInfo] = useState({});
    const [generatedTexts, setGeneratedTexts] = useState({
        option1: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

    const generatePrompt = (optionKey, optionLabel) => {
        const optionValue = formData[optionKey];
        return `User want to write an email: ${userInput}
The factors might affect the tone of your drafting: 
${optionLabel}+${optionValue};

To clarify the tone that the user want, please generate some representative email slices for different options of this factor, so that user can judge which one he wants to select. 
Notice that, the representative email slice could be one most representative sentence which represent what the tone would be if user select this option; or even not entire sentence for user quick reading. Using ... to skip the not important parts in that sentence, if necessary.`;
    };

    const sendRequest = async (optionKey, optionLabel) => {
        setLoading(true);
        setError(null);
        const prompt = generatePrompt(optionKey, optionLabel);
        try {
            const response = await fetch('http://localhost:3002/generate-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '请求后端服务器失败');
            }
            
            const data = await response.json();
            setGeneratedTexts(prevTexts => ({
                ...prevTexts,
                [optionKey]: data.text
            }));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (name, value, optionLabel) => {
        setFormData({...formData, [name]: value });
        setTextInfo({...textInfo, [name]: `你选择了 ${value}` });
        sendRequest(name, optionLabel);
    };

    const handleSubmit = () => {
        navigate('/third', { state: { userInput, formData } });
    };

    const powerDynamic = (e) => {
        const value = e.target.value;
        const optionLabel = 'How do you place your power dynamic?';
        handleChange('option1', value, optionLabel);
    };

    useEffect(() => {
        if (userInput) { // 确保有用户输入
            const optionKey = 'option1';
            const optionLabel = 'How do you place your power dynamic?';
            sendRequest(optionKey, optionLabel);
        }
    }, []);

    return (
        <Row className="page">
            <Col span={6} className="leftContainer">
                <div className="emailTaskContent">
                    <div className="containerTitle">
                        <SolutionOutlined className="containerTitle_icon" />
                        <span>My Email Task</span>
                    </div>
                    <p className='containerPara'>{userInput}</p>
                </div>
            </Col>
            <Col span={18} className='rightContainer'>
                <div className="emailTaskContent">
                    <div className="containerTitle">
                        <SettingOutlined className="containerTitle_icon" />
                        <span>Tone Setting</span>
                    </div>
                </div>
                <div>
                    <Form layout="vertical">
                        <Form.Item name="radio-group1" label="1. How do you place your power dynamic?">
                            <Radio.Group defaultValue="Lower" onChange={powerDynamic}>
                                <Radio value="Lower">Lower</Radio>
                                <Radio value="Equal">Equal</Radio>
                                <Radio value="Higher">Higher</Radio>
                            </Radio.Group>
                            {textInfo.option1 && <p>{textInfo.option1}</p>}
                            {loading && <p>正在加载生成的文本...</p>}
                            {error && <p style={{ color:'red' }}>错误: {error}</p>}
                            {generatedTexts.option1 && (
                                <div style={{ marginTop: '10px' }}>
                                    <h4>生成的文本</h4>
                                    <p>{generatedTexts.option1}</p>
                                </div>
                            )}
                        </Form.Item>
                        <Button 
                            type="primary" 
                            onClick={handleSubmit} 
                            style={{ float: 'right' }}
                            disabled={!generatedTexts.option1}
                        >
                            提交
                        </Button>
                    </Form>
                </div>
            </Col>
        </Row>
    );
};

export default SecondPage;
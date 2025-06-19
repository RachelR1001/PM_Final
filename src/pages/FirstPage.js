// src/components/ChatPage.jsx
import React, { useState } from 'react';
import { Row, Col, Input } from 'antd';
import styles from "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import avatarImg from '../Avatar.png'; // 引入图片
import avatarImg_u from '../Avatar_u.png'; // 引入图片
import axios from 'axios';

import {
    MainContainer,
    ChatContainer,
    Avatar,
    MessageList,
    Message,
    MessageInput
} from "@chatscope/chat-ui-kit-react";
import { useNavigate } from 'react-router-dom';

const FirstPage = () => {
    const [userInput, setUserInput] = useState('');
    const [userName, setUserName] = useState(''); // 新增 UserName 状态
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [messages, setMessages] = useState([
        {
            direction: 'incoming',
            message: ' 🤖Hi, I am email writing assistant. I can help you to draft an email with appropriate tone. Just tell me what you want to write today.',
            sentTime: '',
            position: 'single',
            sender: 'AI Bot',
            avatarSrc: avatarImg
        }
    ]);
    const navigate = useNavigate();

    const handleSend = async () => {
        console.log('userInput:', userInput); // 检查 userInput 是否有值
        console.log('userName:', userName); // 检查 userName 是否有值
        if (userInput.trim() !== '' && userName.trim() !== '') {
            // 添加用户消息到消息列表
            setMessages(prevMessages => [
                ...prevMessages,
                {
                    direction: 'outgoing',
                    message: userInput,
                    sentTime: '',
                    position: 'single',
                    sender: 'User',
                    avatarSrc: avatarImg_u // 替换为用户头像的 URL
                }
            ]);

            try {
                // 调用后端 API 创建 Session 数据（后端会生成 taskId）
                const response = await axios.post('http://localhost:3001/create-session', {
                    userName,
                    userInput,
                });
                console.log('Session 数据创建成功:', response.data);
                
                // 从后端响应中获取 taskId
                const taskId = response.data.taskId;
                console.log('Generated taskId:', taskId);

                setIsAnalyzing(true);
                setTimeout(() => {
                    setIsAnalyzing(false);
                    navigate('/second', { state: { userTask: userInput, userName, taskId } }); // 传递从后端获取的 taskId
                }, 5000); // 模拟分析时间为 5 秒
            } catch (error) {
                console.error('创建 Session 数据时出错:', error);
                setIsAnalyzing(false);
            }
        } else {
            console.error('userInput 或 userName 为空，无法发送');
        }
    };

    return (
        <div className="firstPage">
            <MainContainer style={{ width: '100%' }}>
                <Row style={{ height: '100%' }}>
                    {/* 左侧栅格 */}
                    <Col span={4} style={{ borderRight: '1px solid #e9e9e9', padding: '16px' }}>
                        <h3>User Information</h3>
                        <Input
                            placeholder="Enter your name"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            style={{ marginBottom: '16px' }}
                        />
                    </Col>

                    {/* 右侧栅格 */}
                    <Col span={20} style={{ height: '100%' }}>
                        <ChatContainer className="rightContainer" style={{ padding: '24px 0' }}>
                            <MessageList>
                                {messages.map((msg, index) => (
                                    <Message
                                        key={index}
                                        model={{
                                            ...msg,
                                        }}
                                    >
                                        <Avatar
                                            name={msg.sender}
                                            src={msg.avatarSrc} // 动态设置 src 属性
                                        />
                                    </Message>
                                ))}
                                {isAnalyzing && (
                                    <Message
                                        model={{
                                            direction: 'incoming',
                                            message: 'Analyzing...',
                                            sentTime: '',
                                            position: 'single',
                                            sender: 'AI Bot',
                                        }}
                                    >
                                        <Avatar
                                            name="AI Bot"
                                            src={avatarImg}
                                        />
                                    </Message>
                                )}
                            </MessageList>
                            <MessageInput
                                placeholder="Please input your task here..."
                                onChange={(innerHtml, textContent) => setUserInput(textContent)}
                                onSend={handleSend} // 调用 handleSend 方法
                                attachButton={false}
                            />
                        </ChatContainer>
                    </Col>
                </Row>
            </MainContainer>
        </div>
    );
};

export default FirstPage;
// src/components/ChatPage.jsx
import React, { useState } from 'react';
import styles from "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import avatarImg from '../Avatar.png'; // 引入图片
import avatarImg_u from '../Avatar_u.png'; // 引入图片

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

    const handleSend = () => {
        if (userInput.trim()!== '') {
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
            setIsAnalyzing(true);
            setTimeout(() => {
                setIsAnalyzing(false);
                navigate('/second', { state: { userInput } });
            }, 5000); // 模拟分析时间为 5 秒
        }
    };

    return (
        <div className="firstPage">
            <MainContainer>
                <ChatContainer style={{ padding: '24px 0' }}>
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
                        onSend={handleSend}
                        attachButton={false}
                    />
                </ChatContainer>
            </MainContainer>
        </div>
    );
};

export default FirstPage;
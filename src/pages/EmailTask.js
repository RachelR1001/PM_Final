// src/components/ChatPage.jsx
import React, { useState, useEffect } from 'react';
import { Space, Button, Input, Checkbox, Card, Collapse, Row, Col, Radio, Tag, Spin } from 'antd';
import {
    SendOutlined
  } from '@ant-design/icons';
import styles from "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import avatarImg from '../Avatar.png'; // 引入图片
import avatarImg_u from '../avatarUser.png'; // 引入图片
import axios from 'axios';

import {
    MainContainer,
    ChatContainer,
    Avatar,
    MessageList,
    Message,
    MessageInput
} from "@chatscope/chat-ui-kit-react";
import { useNavigate, useLocation } from 'react-router-dom';
// Import the global context hook
import { useGlobalContext } from '../App';

const FirstPage = () => {
    const [userInput, setUserInput] = useState('');
    const [localUserName, setLocalUserName] = useState(localStorage.getItem('username') || ''); // Renamed to avoid conflict
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [messages, setMessages] = useState([]);
    const navigate = useNavigate();

    const [value, setValue] = useState('');
    const [showChat, setShowChat] = useState(false);

    // const location = useLocation();
    // const { userName = localUserName, taskId = '', created_iso = '' } = location.state || {};
    // Get the global state from the context
    const { globalState } = useGlobalContext();
    const { username: globalUsername, taskId: globalTaskId } = globalState;

    // Use the global state directly
    const [userTask, setUserTask] = useState('');

    // useEffect(() => {
    //     if (location.state) {
    //         console.log('Received data:', { userName, taskId, created_iso });
    //         // 同步更新 localStorage
    //         if (userName) {
    //             localStorage.setItem('username', userName);
    //             setLocalUserName(userName);
    //         }
    //     } else {
    //         // 如果 location.state 丢失，从 localStorage 恢复
    //         const storedUsername = localStorage.getItem('username');
    //         if (storedUsername) {
    //             setLocalUserName(storedUsername);
    //         }
    //     }
    // }, [location.state, userName]);

    // const [userTask, setUserTask] = useState(''); // Add a state variable for userTask

    const handleSendAsync = () => {
      if (value.trim()) {
        setMessages([...messages, { sender: 'User', message: value, avatarSrc: avatarImg_u }]);
        setValue('');
        setShowChat(true);
        setUserTask(value); // Store in local state
      }
    };

    const handleMultipleChange = (factorId, option, factorOptions) => {
        // Add safety checks for undefined option
        if (!option || option.value === undefined) {
            console.warn('Invalid option passed to handleMultipleChange:', option);
            return;
        }

        setSelectedValues(prev => {
            // Ensure factorOptions exists and has at least one valid option
            const validFactorOptions = factorOptions?.filter(opt => opt && opt.value !== undefined) || [];
            if (validFactorOptions.length === 0) {
                console.warn('No valid factor options available for factorId:', factorId);
                return prev;
            }

            const currentValues = prev[factorId] || [validFactorOptions[0].value];
            
            // Check if the option value is already selected
            const isSelected = currentValues.includes(option.value);
            
            let newValues;
            if (isSelected) {
                // Remove the option if it's already selected
                newValues = currentValues.filter(v => v !== option.value);
            } else {
                // Add the option if it's not selected
                newValues = [...currentValues, option.value];
            }

            // Ensure the first option remains selected unless explicitly deselected
            if (!newValues.includes(validFactorOptions[0].value)) {
                newValues.unshift(validFactorOptions[0].value);
            }

            return { ...prev, [factorId]: newValues };
        });
    };

    const [loading, setLoading] = useState(false);

    const handleGenerateDraft = async () => {
      setLoading(true); // Start loading
      try {
        console.log('Selected Values:', selectedValues);
        const factorChoices = Object.entries(selectedValues).reduce((acc, [factorId, selectedOption]) => {
          const factor = Object.values(factorData).flat().find(f => f.id === factorId);
          if (factor) {
            acc[factorId] = {
              id: factor.id,
              select_type: factor.select_type,
              source: factor.source,
              title: factor.title,
              Category: factor.Category,
              options: Array.isArray(selectedOption) ? selectedOption.map(value => ({ value, type: 'user-defined' })) : [{ value: selectedOption, type: 'user-defined' }]
            };
          }
          return acc;
        }, {});

        // Save factor choices
        await axios.post(`http://localhost:3001/save-factor-choices`, {
          userName: globalUsername,
          factorChoices,
          taskId: globalTaskId
        });

        const response = await axios.post('http://localhost:3001/generate-first-draft', {
          userTask,
          factorChoices
        });

        if (response.status === 200) {
          // Save the draft content to latest.md
          await axios.post(`http://localhost:3001/sessiondata/${globalTaskId}/drafts/latest.md`, {
            content: response.data.draft
          });

          // Call the component extractor endpoint
          const componentResponse = await axios.post('http://localhost:3001/component-extractor', {
              taskId: globalTaskId,
              userName: globalUsername
          });

          if (componentResponse.status === 200) {
              console.log('Component Extractor Response:', componentResponse.data);
              navigate('/emailEditor', { state: { draftContent: response.data.draft, components: componentResponse.data.components } });
          } else {
              console.error('Failed to extract components:', componentResponse.data.error);
          }
          setLoading(false); // End loading
        } else {
          console.error('Failed to generate draft:', response.data.error);
          setLoading(false); // End loading on error
        }
      } catch (error) {
        console.error('Error generating draft:', error);
        setLoading(false); // End loading on error
      }
    };

    const { TextArea } = Input;

    const [factorData, setFactorData] = useState([]);
    const [selectedValues, setSelectedValues] = useState({}); // To track selected values for each factor

    useEffect(() => {
        // Fetch the factor list JSON dynamically
        axios.get('/data/PredefinedData/factor_list.json')
            .then(response => {
                const groupedData = response.data.reduce((acc, item) => {
                    if (!acc[item.Category]) {
                        acc[item.Category] = [];
                    }
                    acc[item.Category].push(item);
                    return acc;
                }, {});
                setFactorData(groupedData);
            })
            .catch(error => console.error('Error fetching factor list:', error));
    }, []);

    const handleSingleChange = (factorId, value) => {
        setSelectedValues(prev => ({ ...prev, [factorId]: value }));
    };

    return (
        <Spin spinning={loading} tip="Generating draft...">
            <div className="firstPage">
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh - 112px', backgroundColor: '#F8FAFC' }}>
                    {!showChat ? (
                        <div className="firstPage-content" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', position: 'absolute', top: '50%', transform: 'translateY(-50%)' }}>
                            <p className="firstPage-content-text">🤖Hi, I am email writing assistant.</p>
                            <p className="firstPage-content-text-sub">What can I help with?</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                              <TextArea
                                value={value}
                                onChange={e => setValue(e.target.value)}
                                placeholder="Please input your Email task here..."
                                autoSize={{ minRows: 2, maxRows: 6 }}
                                style={{
                                  width: '90%',
                                  minHeight: '82px',
                                  borderRadius: '48px',
                                  border: '2px solid var(--Color-2, #475569)',
                                  background: '#FFF',
                                  display: 'flex',
                                  padding: '8px 16px',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  alignSelf: 'stretch',
                                }}
                              />
                              <Button size="large" type="primary" shape="circle" icon={<SendOutlined />} onClick={handleSendAsync} disabled={!value.trim()}></Button>
                            </div>
                        </div>
                    ) : (
                        <div className="chatContainer" style={{ padding: '24px 24px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: '100vh - 112px' }}>
                            <div className="ChatMessage_User" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <img src={avatarImg_u} alt="avatar" style={{ marginRight: '8px', width: '40px', height: '40px' }} />
                                <div className="ChatMessage_User_Content">
                                    <p className="ChatMessage_User_Content_Label" style={{ color: '#000', fontSize: '16px', fontWeight: 'bold' }}>You</p>
                                    <div className="ChatMessage_User_Content_Text">
                                        {messages[messages.length - 1]?.message}
                                    </div>
                                </div>
                            </div>
                            <div className="ChatMessage_Assistant" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                                <img src={avatarImg} alt="avatar" style={{ marginRight: '8px', alignSelf: 'flex-start' }} />
                                <div className="ChatMessage_Assistant_Content">
                                <p className="ChatMessage_User_Content_Label" style={{ color: '#000', fontSize: '16px', fontWeight: 'bold' }}>PersonaMail Bot</p>
                                    <div className="ChatMessage_Assistant_Content_Text">
                                    Please select the following factors that you think are most important in setting the tone of this email.
                                    </div>
                                    <div className="ChatMessage_Assistant_Content_Factors" style={{ width: '100%' }}>
                                        <Row gutter={[16, 16]} justify="space-between" style={{ width: '100%' }}>
                                            {Object.entries(factorData).map(([category, factors]) => (
                                                <Col span={12} key={category}>
                                                    <Card title={category} variant="borderless">
                                                        <Collapse defaultActiveKey={factors.length > 0 ? [factors[0].id] : []} collapsible="icon">
                                                            {factors.map(factor => {
                                                                // Ensure factor.options exists and filter out invalid options
                                                                const validOptions = factor.options?.filter(option => option && option.value !== undefined) || [];
                                                                
                                                                return (
                                                                    <Collapse.Panel
                                                                        header={
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                    <Checkbox style={{ marginRight: '8px' }} defaultChecked={factors[0]?.id === factor.id} />
                                                                                    {factor.title}
                                                                                </div>
                                                                                <div style={{ maxWidth: '150px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#4096ff', fontSize: '12px' }}>
                                                                                    {factor.select_type === 'single'
                                                                                        ? selectedValues[factor.id] || (validOptions.length > 0 ? validOptions[0].value : 'N/A')
                                                                                        : (selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A'])).length > 1
                                                                                            ? `${(selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A']))[0]}...`
                                                                                            : (selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A']))[0]}
                                                                                </div>
                                                                            </div>
                                                                        }
                                                                        key={factor.id}
                                                                    >
                                                                        <div>
                                                                            {factor.select_type === 'single' ? (
                                                                                <Radio.Group
                                                                                    onChange={e => handleSingleChange(factor.id, e.target.value)}
                                                                                    value={selectedValues[factor.id] || (validOptions.length > 0 ? validOptions[0].value : '')}
                                                                                >
                                                                                    {validOptions.map(option => (
                                                                                        <Radio key={option.value} value={option.value}>
                                                                                            {option.value}
                                                                                        </Radio>
                                                                                    ))}
                                                                                </Radio.Group>
                                                                            ) : (
                                                                                <div>
                                                                                    {validOptions.length > 0 ? (
                                                                                        validOptions.map(option => (
                                                                                            <Tag.CheckableTag
                                                                                                key={option.value}
                                                                                                checked={
                                                                                                    selectedValues[factor.id]?.length > 0
                                                                                                        ? selectedValues[factor.id].includes(option.value)
                                                                                                        : option.value === validOptions[0].value
                                                                                                }
                                                                                                onChange={() => handleMultipleChange(factor.id, option, validOptions)}
                                                                                            >
                                                                                                {option.value}
                                                                                            </Tag.CheckableTag>
                                                                                        ))
                                                                                    ) : (
                                                                                        <div>No options available</div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
                                                                                <Input.TextArea
                                                                                    placeholder="Enter your options here..."
                                                                                    autoSize={{ minRows: 1, maxRows: 3 }}
                                                                                    value={selectedValues[`input_${factor.id}`] || ''}
                                                                                    onChange={e => setSelectedValues(prev => ({ ...prev, [`input_${factor.id}`]: e.target.value }))}
                                                                                    style={{ marginRight: '8px', flex: 1 }}
                                                                                />
                                                                                <Button
                                                                                    type="primary"
                                                                                    disabled={!selectedValues[`input_${factor.id}`]?.trim()}
                                                                                    onClick={() => {
                                                                                        const newOptionValue = selectedValues[`input_${factor.id}`].trim();
                                                                                        const newOption = { value: newOptionValue, type: 'user-defined' };
                                                                                        
                                                                                        // Clear the input
                                                                                        setSelectedValues(prev => ({ ...prev, [`input_${factor.id}`]: '' }));
                                                                                        
                                                                                        // Add the new option to factor data
                                                                                        setFactorData(prev => {
                                                                                            const updatedFactors = { ...prev };
                                                                                            const factorIndex = updatedFactors[category].findIndex(f => f.id === factor.id);
                                                                                            if (factorIndex !== -1) {
                                                                                                const existingOptions = updatedFactors[category][factorIndex].options?.map(option => option.value) || [];
                                                                                                if (!existingOptions.includes(newOption.value)) {
                                                                                                    if (!updatedFactors[category][factorIndex].options) {
                                                                                                        updatedFactors[category][factorIndex].options = [];
                                                                                                    }
                                                                                                    updatedFactors[category][factorIndex].options.push(newOption);
                                                                                                }
                                                                                            }
                                                                                            return updatedFactors;
                                                                                        });
                                                                                        
                                                                                        // Update selected values
                                                                                        setSelectedValues(prev => {
                                                                                            if (factor.select_type === 'single') {
                                                                                                return { ...prev, [factor.id]: newOption.value };
                                                                                            } else {
                                                                                                const currentValues = prev[factor.id] || [];
                                                                                                return { ...prev, [factor.id]: [...currentValues, newOption.value] };
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    Add
                                                                                </Button>
                                                                            </div>
                                                                        </div>
                                                                    </Collapse.Panel>
                                                                );
                                                            })}
                                                        </Collapse>
                                                    </Card>
                                                </Col>
                                            ))}
                                        </Row>
                                    </div>
                                </div>
                            </div>
                            <Button 
                            type="primary" 
                            onClick={handleGenerateDraft} 
                            size="large"
                            style={{
                                margin: '0 auto',
                                display: 'block',
                                marginTop: '16px',
                            }}
                            >
                            Generate Email Draft
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Spin>
    );
};

export default FirstPage;
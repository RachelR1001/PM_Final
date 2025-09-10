// src/components/ChatPage.jsx
import React, { useState, useEffect } from 'react';
import { Space, Button, Input, Checkbox, Card, Collapse, Row, Col, Radio, Tag, Spin, Flex } from 'antd';
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

    // Get the global state from the context
    const { globalState } = useGlobalContext();
    const { username: globalUsername, taskId: globalTaskId } = globalState;

    // Use the global state directly
    const [userTask, setUserTask] = useState('');

    const handleSendAsync = async () => {
      if (value.trim()) {
        setMessages([...messages, { sender: 'User', message: value, avatarSrc: avatarImg_u }]);
        setValue('');
        setShowChat(true);
        setUserTask(value); // Store in local state
        setHasAppliedAnchors(false); // Reset anchor state for new task
        
        // Update meta/task.json with original_task
        try {
          await axios.post(`http://localhost:3001/update-task-meta`, {
            userName: globalUsername,
            taskId: globalTaskId,
            originalTask: value
          });
        } catch (error) {
          console.error('Error updating task meta:', error);
        }
        
        // Check for anchor files
        await checkAndLoadAnchors();
      }
    };

    const checkAndLoadAnchors = async () => {
      try {
        // Reset anchor states first
        setShowAnchors(false);
        setAnchorData({ persona: [], situation: [] });
        setSelectedPersona(null);
        setSelectedSituation(null);
        setHasAppliedAnchors(false);
        
        const personaFiles = await getFilesFromDirectory('PersonaAnchor');
        const situationFiles = await getFilesFromDirectory('SituationAnchor');
        
        const personaAnchors = [];
        const situationAnchors = [];
        
        for (const file of personaFiles) {
          if (file.endsWith('.json')) {
            try {
              const jsonResponse = await fetch(`http://localhost:3001/user-data/${globalUsername}/PersonaAnchor/${file}`);
              if (jsonResponse.ok) {
                const jsonData = await jsonResponse.json();
                const imageFile = personaFiles.find(f => f.startsWith(file.replace('.json', '')) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')));
                personaAnchors.push({
                  ...jsonData,
                  image: imageFile ? `http://localhost:3001/user-data/${globalUsername}/PersonaAnchor/${imageFile}` : null
                });
              }
            } catch (error) {
              console.error('Error loading persona file:', error);
            }
          }
        }
        
        for (const file of situationFiles) {
          if (file.endsWith('.json')) {
            try {
              const jsonResponse = await fetch(`http://localhost:3001/user-data/${globalUsername}/SituationAnchor/${file}`);
              if (jsonResponse.ok) {
                const jsonData = await jsonResponse.json();
                const imageFile = situationFiles.find(f => f.startsWith(file.replace('.json', '')) && (f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg')));
                situationAnchors.push({
                  ...jsonData,
                  image: imageFile ? `http://localhost:3001/user-data/${globalUsername}/SituationAnchor/${imageFile}` : null
                });
              }
            } catch (error) {
              console.error('Error loading situation file:', error);
            }
          }
        }
        
        if (personaAnchors.length > 0 || situationAnchors.length > 0) {
          setAnchorData({ persona: personaAnchors, situation: situationAnchors });
          setShowAnchors(true);
          setAnchorsApplied(false);
          setAnchorsSkipped(false);
          setApplyingAnchors(false);
        } else {
          // No anchors found, show assistant directly
          setAnchorsApplied(true);
        }
      } catch (error) {
        console.error('Error checking anchor files:', error);
      }
    };
    
    const getFilesFromDirectory = async (folderName) => {
      try {
        const response = await fetch(`http://localhost:3001/list-directory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: globalUsername, folderName })
        });
        if (response.ok) {
          const data = await response.json();
          return data.files || [];
        }
      } catch (error) {
        console.error('Error listing directory:', error);
      }
      return [];
    };

    const [factorData, setFactorData] = useState([]);
    const [selectedValues, setSelectedValues] = useState({}); // To track selected values for each factor
    const [selectedFactors, setSelectedFactors] = useState({}); // To track which factors are selected
    const [anchorData, setAnchorData] = useState({ persona: [], situation: [] });
    const [showAnchors, setShowAnchors] = useState(false);
    const [selectedPersona, setSelectedPersona] = useState(null);
    const [selectedSituation, setSelectedSituation] = useState(null);
    const [anchorsApplied, setAnchorsApplied] = useState(false);
    const [anchorsSkipped, setAnchorsSkipped] = useState(false);
    const [applyingAnchors, setApplyingAnchors] = useState(false);
    const [hasAppliedAnchors, setHasAppliedAnchors] = useState(false);
    const [editingOption, setEditingOption] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Reset anchor states when username changes
    useEffect(() => {
        setShowAnchors(false);
        setAnchorData({ persona: [], situation: [] });
        setSelectedPersona(null);
        setSelectedSituation(null);
        setAnchorsApplied(false);
        setAnchorsSkipped(false);
        setApplyingAnchors(false);
        setHasAppliedAnchors(false);
    }, [globalUsername]);

    // Initialize default selections when factorData is loaded
    useEffect(() => {
        if (Object.keys(factorData).length > 0) {
            const defaultSelectedFactors = {};
            const defaultSelectedValues = {};
            
            Object.entries(factorData).forEach(([category, factors]) => {
                // Default select the first factor in each category
                if (factors.length > 0) {
                    const firstFactor = factors[0];
                    defaultSelectedFactors[firstFactor.id] = true;
                    
                    // Set default option for the selected factor
                    if (firstFactor.options && firstFactor.options.length > 0) {
                        const validOptions = firstFactor.options.filter(option => option && option.value !== undefined);
                        if (validOptions.length > 0) {
                            if (firstFactor.select_type === 'single') {
                                defaultSelectedValues[firstFactor.id] = validOptions[0].value;
                            } else {
                                defaultSelectedValues[firstFactor.id] = [validOptions[0].value];
                            }
                        }
                    }
                }
            });
            
            setSelectedFactors(defaultSelectedFactors);
            setSelectedValues(defaultSelectedValues);
        }
    }, [factorData]);

    // Handle factor checkbox change
    const handleFactorChange = (factorId, checked) => {
        setSelectedFactors(prev => {
            const newSelectedFactors = { ...prev, [factorId]: checked };
            
            // If unchecking a factor, remove its selected values
            if (!checked) {
                setSelectedValues(prevValues => {
                    const newValues = { ...prevValues };
                    delete newValues[factorId];
                    return newValues;
                });
            } else {
                // If checking a factor, set default option
                const factor = Object.values(factorData).flat().find(f => f.id === factorId);
                if (factor && factor.options && factor.options.length > 0) {
                    const validOptions = factor.options.filter(option => option && option.value !== undefined);
                    if (validOptions.length > 0) {
                        setSelectedValues(prevValues => ({
                            ...prevValues,
                            [factorId]: factor.select_type === 'single' 
                                ? validOptions[0].value 
                                : [validOptions[0].value]
                        }));
                    }
                }
            }
            
            return newSelectedFactors;
        });
    };

    const handleMultipleChange = (factorId, option, factorOptions) => {
        // Add safety checks for undefined option
        if (!option || option.value === undefined) {
            console.warn('Invalid option passed to handleMultipleChange:', option);
            return;
        }

        // Only allow changes if the factor is selected
        if (!selectedFactors[factorId]) {
            return;
        }

        setSelectedValues(prev => {
            // Ensure factorOptions exists and has at least one valid option
            const validFactorOptions = factorOptions?.filter(opt => opt && opt.value !== undefined) || [];
            if (validFactorOptions.length === 0) {
                console.warn('No valid factor options available for factorId:', factorId);
                return prev;
            }

            const currentValues = prev[factorId] || [];
            
            // Check if the option value is already selected
            const isSelected = currentValues.includes(option.value);
            
            let newValues;
            if (isSelected) {
                // Remove the option if it's already selected
                newValues = currentValues.filter(v => v !== option.value);
                // Ensure at least one option is selected
                if (newValues.length === 0) {
                    newValues = [validFactorOptions[0].value];
                }
            } else {
                // Add the option if it's not selected
                newValues = [...currentValues, option.value];
            }

            return { ...prev, [factorId]: newValues };
        });
    };

    const handleSingleChange = (factorId, value) => {
        // Only allow changes if the factor is selected
        if (!selectedFactors[factorId]) {
            return;
        }
        setSelectedValues(prev => ({ ...prev, [factorId]: value }));
    };

    const [loading, setLoading] = useState(false);

    const handleApplyAnchors = async () => {
        setApplyingAnchors(true);
        try {
            const promises = [];
            
            // Call persona anchor adaptation if persona is selected
            if (selectedPersona !== null && anchorData.persona[selectedPersona]) {
                const personaPromise = axios.post('http://localhost:3001/persona-anchor-adaptation', {
                    userName: globalUsername,
                    userTask: userTask,
                    selectedAnchor: anchorData.persona[selectedPersona]
                });
                promises.push(personaPromise);
            }
            
            // Call situation anchor adaptation if situation is selected
            if (selectedSituation !== null && anchorData.situation[selectedSituation]) {
                const situationPromise = axios.post('http://localhost:3001/situation-anchor-adaptation', {
                    userName: globalUsername,
                    userTask: userTask,
                    selectedAnchor: anchorData.situation[selectedSituation]
                });
                promises.push(situationPromise);
            }
            
            // Wait for all adaptation requests to complete
            const responses = await Promise.all(promises);
            
            console.log('Anchor adaptation responses:', responses.map(r => r.data));
            
            // Process responses and add to factorData
            const newFactors = [];
            const newSelectedFactors = {};
            const newSelectedValues = {};
            
            responses.forEach(response => {
                if (response.data.adaptedFactors) {
                    response.data.adaptedFactors.forEach(factor => {
                        newFactors.push(factor);
                        newSelectedFactors[factor.id] = true;
                        if (factor.options && factor.options.length > 0) {
                            const validOptions = factor.options.filter(option => option && option.value !== undefined);
                            if (validOptions.length > 0) {
                                newSelectedValues[factor.id] = factor.select_type === 'single' 
                                    ? validOptions[0].value 
                                    : [validOptions[0].value];
                            }
                        }
                    });
                }
            });
            
            // Update factorData with new factors
            if (newFactors.length > 0) {
                setFactorData(prev => {
                    const updated = { ...prev };
                    newFactors.forEach(factor => {
                        if (!updated[factor.Category]) {
                            updated[factor.Category] = [];
                        }
                        updated[factor.Category].push(factor);
                    });
                    return updated;
                });
                
                // Update selected factors and values
                setSelectedFactors(prev => ({ ...prev, ...newSelectedFactors }));
                setSelectedValues(prev => ({ ...prev, ...newSelectedValues }));
            }
            
            // Show assistant after applying anchors
            setAnchorsApplied(true);
            setHasAppliedAnchors(true);
        } catch (error) {
            console.error('Error applying anchors:', error);
        } finally {
            setApplyingAnchors(false);
        }
    };
    
    const handleSkipAnchors = () => {
        setAnchorsSkipped(true);
        setAnchorsApplied(true);
    };

    const handleGenerateDraft = async () => {
      setLoading(true); // Start loading
      try {
        console.log('Selected Values:', selectedValues);
        console.log('Selected Factors:', selectedFactors);
        
        // Only include factor choices for selected factors
        const factorChoices = Object.entries(selectedValues).reduce((acc, [factorId, selectedOption]) => {
          // Only include if the factor is selected
          if (selectedFactors[factorId]) {
            const factor = Object.values(factorData).flat().find(f => f.id === factorId);
            if (factor) {
              acc[factorId] = {
                id: factor.id,
                select_type: factor.select_type,
                source: factor.source,
                title: factor.title,
                Category: factor.Category,
                options: Array.isArray(selectedOption) 
                  ? selectedOption.map(value => ({ value, type: 'user-defined' })) 
                  : [{ value: selectedOption, type: 'user-defined' }]
              };
            }
          }
          return acc;
        }, {});

        // Save factor choices
        await axios.post(`http://localhost:3001/save-factor-choices`, {
          userName: globalUsername,
          factorChoices,
          taskId: globalTaskId
        });

        // Choose endpoint based on whether anchors were applied
        const endpoint = hasAppliedAnchors ? 'generate-anchor-email-draft' : 'generate-first-draft';
        const requestData = hasAppliedAnchors 
          ? { userTask, factorChoices, userName: globalUsername }
          : { userTask, factorChoices };
        
        const response = await axios.post(`http://localhost:3001/${endpoint}`, requestData);

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
              navigate('/emailEditor', { state: { draftContent: response.data.draft, components: componentResponse.data.components, userTask, hasAppliedAnchors } });
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
                            {showAnchors && (anchorData.persona.length > 0 || anchorData.situation.length > 0) && (
                                <div className="ChatMessage_Anchors" style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '16px' }}>
                                    <img src={avatarImg} alt="avatar" style={{ marginRight: '8px', alignSelf: 'flex-start' }} />
                                    <div className="ChatMessage_Assistant_Content">
                                        <p className="ChatMessage_User_Content_Label" style={{ color: '#000', fontSize: '16px', fontWeight: 'bold' }}>PersonaMail Bot</p>
                                        <div className="ChatMessage_Assistant_Content_Text">
                                            Based on your email tasks and your historical data, I recommend that you can apply the following persona and situation anchors. You can choose one of Each Anchors that suits you from them or skip it directly.
                                        </div>
                                        <div className="ChatMessage_Assistant_Content_Anchors" style={{ marginTop: '8px' }}>
                                            {anchorData.persona.length > 0 && (
                                                <div className="ChatMessage_Assistant_Content_Anchors_Persona" style={{ marginBottom: '16px' }}>
                                                    <div style={{ fontWeight: 'bold', margin: '16px 0 8px 0' }}>Persona Anchors</div>
                                                    <Flex wrap="wrap" gap="small" style={{ maxWidth: '100%' }}>
                                                        {anchorData.persona.map((persona, index) => (
                                                            <Card 
                                                                key={index} 
                                                                style={{ 
                                                                    width: 'calc(33.33% - 8px)', 
                                                                    minWidth: '200px', 
                                                                    marginBottom: '8px',
                                                                    border: selectedPersona === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => setSelectedPersona(selectedPersona === index ? null : index)}
                                                            >
                                                                {persona.image && <img src={persona.image} alt="persona" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
                                                                <p style={{ fontWeight: 'bold', margin: '8px 0 4px 0' }}>{persona.title || 'Persona Anchor'}</p>
                                                                <p style={{ margin: '0' }}>{persona.description || persona.content}</p>
                                                            </Card>
                                                        ))}
                                                    </Flex>
                                                </div>
                                            )}
                                            {anchorData.situation.length > 0 && (
                                                <div className="ChatMessage_Assistant_Content_Anchors_Situation" style={{ marginBottom: '8px' }}>
                                                    <div style={{ fontWeight: 'bold', margin: '16px 0 8px 0' }}>Situation Anchors</div>
                                                    <Flex wrap="wrap" gap="small" style={{ maxWidth: '100%' }}>
                                                        {anchorData.situation.map((situation, index) => (
                                                            <Card 
                                                                key={index} 
                                                                style={{ 
                                                                    width: 'calc(33.33% - 8px)', 
                                                                    minWidth: '200px', 
                                                                    marginBottom: '8px',
                                                                    border: selectedSituation === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                                                                    cursor: 'pointer'
                                                                }}
                                                                onClick={() => setSelectedSituation(selectedSituation === index ? null : index)}
                                                            >
                                                                {situation.image && <img src={situation.image} alt="situation" style={{ width: '100%', height: '120px', objectFit: 'cover' }} />}
                                                                <p style={{ fontWeight: 'bold', margin: '8px 0 4px 0' }}>{situation.title || 'Situation Anchor'}</p>
                                                                <p style={{ margin: '0' }}>{situation.description || situation.content}</p>
                                                            </Card>
                                                        ))}
                                                    </Flex>
                                                </div>
                                            )}
                                           
                                        </div>
                                         <div style={{textAlign: 'left', marginTop: '8px'}}>
                                                <Button type="primary" style={{marginRight: '8px'}} onClick={handleApplyAnchors} disabled={anchorsSkipped || anchorsApplied || (selectedPersona === null && selectedSituation === null)} loading={applyingAnchors}>Apply Anchors</Button>
                                                <Button onClick={handleSkipAnchors} disabled={anchorsSkipped || anchorsApplied}>Skip</Button>
                                            </div>
                                    </div>
                                </div>
                            )}
                            {(anchorsApplied || (!showAnchors && anchorData.persona.length === 0 && anchorData.situation.length === 0)) && (
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
                                                        <Collapse 
                                                            defaultActiveKey={factors.length > 0 ? [factors[0].id] : []} 
                                                            collapsible="icon"
                                                        >
                                                            {factors.map((factor, index) => {
                                                                // Ensure factor.options exists and filter out invalid options
                                                                const validOptions = factor.options?.filter(option => option && option.value !== undefined) || [];
                                                                const isFactorSelected = selectedFactors[factor.id] || false;
                                                                
                                                                return (
                                                                    <Collapse.Panel
                                                                        header={
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                                                    <Checkbox 
                                                                                        style={{ marginRight: '8px' }} 
                                                                                        checked={isFactorSelected}
                                                                                        onChange={(e) => {
                                                                                            e.stopPropagation(); // Prevent collapse toggle
                                                                                            handleFactorChange(factor.id, e.target.checked);
                                                                                        }}
                                                                                    />
                                                                                    {factor.title}
                                                                                </div>
                                                                                <div style={{ 
                                                                                    maxWidth: '150px', 
                                                                                    textOverflow: 'ellipsis', 
                                                                                    overflow: 'hidden', 
                                                                                    whiteSpace: 'nowrap', 
                                                                                    color: isFactorSelected ? '#4096ff' : '#ccc', 
                                                                                    fontSize: '12px' 
                                                                                }}>
                                                                                    {isFactorSelected ? (
                                                                                        factor.select_type === 'single'
                                                                                            ? selectedValues[factor.id] || (validOptions.length > 0 ? validOptions[0].value : 'N/A')
                                                                                            : (selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A'])).length > 1
                                                                                                ? `${(selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A']))[0]}...`
                                                                                                : (selectedValues[factor.id] || (validOptions.length > 0 ? [validOptions[0].value] : ['N/A']))[0]
                                                                                    ) : 'Not selected'}
                                                                                </div>
                                                                            </div>
                                                                        }
                                                                        key={factor.id}
                                                                    >
                                                                        <div style={{ opacity: isFactorSelected ? 1 : 0.5 }}>
                                                                            {factor.select_type === 'single' ? (
                                                                                <Radio.Group
                                                                                    onChange={e => handleSingleChange(factor.id, e.target.value)}
                                                                                    value={selectedValues[factor.id] || (validOptions.length > 0 ? validOptions[0].value : '')}
                                                                                    disabled={!isFactorSelected}
                                                                                >
                                                                                    {validOptions.map(option => (
                                                                                        <Radio key={option.value} value={option.value}>
                                                                                            {option.value}
                                                                                        </Radio>
                                                                                    ))}
                                                                                </Radio.Group>
                                                                            ) : (
                                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                                                    {validOptions.length > 0 ? (
                                                                                        validOptions.map(option => {
                                                                                            const optionKey = `${factor.id}-${option.value}`;
                                                                                            const isEditing = editingOption === optionKey;
                                                                                            
                                                                                            return isEditing && option.type === 'adapted' ? (
                                                                                                <div key={optionKey} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                                    <Input
                                                                                                        size="small"
                                                                                                        value={editValue}
                                                                                                        onChange={e => setEditValue(e.target.value)}
                                                                                                        autoFocus
                                                                                                        style={{ minWidth: '400px', flex: 1 }}
                                                                                                    />
                                                                                                    <Button
                                                                                                        size="small"
                                                                                                        type="primary"
                                                                                                        onClick={() => {
                                                                                                            if (editValue.trim()) {
                                                                                                                setFactorData(prev => {
                                                                                                                    const updated = { ...prev };
                                                                                                                    const categoryFactors = updated[factor.Category];
                                                                                                                    const factorIndex = categoryFactors.findIndex(f => f.id === factor.id);
                                                                                                                    const optionIndex = categoryFactors[factorIndex].options.findIndex(opt => opt.value === option.value);
                                                                                                                    categoryFactors[factorIndex].options[optionIndex].value = editValue.trim();
                                                                                                                    return updated;
                                                                                                                });
                                                                                                                setSelectedValues(prev => {
                                                                                                                    const currentValues = prev[factor.id] || [];
                                                                                                                    const updatedValues = currentValues.map(v => v === option.value ? editValue.trim() : v);
                                                                                                                    return { ...prev, [factor.id]: updatedValues };
                                                                                                                });
                                                                                                            }
                                                                                                            setEditingOption(null);
                                                                                                            setEditValue('');
                                                                                                        }}
                                                                                                    >
                                                                                                        Save
                                                                                                    </Button>
                                                                                                </div>
                                                                                            ) : (
                                                                                                <div key={optionKey} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                                                    <Tag.CheckableTag
                                                                                                        checked={
                                                                                                            isFactorSelected && (
                                                                                                                selectedValues[factor.id]?.length > 0
                                                                                                                    ? selectedValues[factor.id].includes(option.value)
                                                                                                                    : option.value === validOptions[0].value
                                                                                                            )
                                                                                                        }
                                                                                                        onChange={() => handleMultipleChange(factor.id, option, validOptions)}
                                                                                                        style={{ 
                                                                                                            opacity: isFactorSelected ? 1 : 0.5,
                                                                                                            pointerEvents: isFactorSelected ? 'auto' : 'none',
                                                                                                            whiteSpace: 'normal',
                                                                                                            wordBreak: 'break-word',
                                                                                                            maxWidth: '100%'
                                                                                                        }}
                                                                                                    >
                                                                                                        {option.value}
                                                                                                    </Tag.CheckableTag>
                                                                                                    {option.type === 'adapted' && isFactorSelected && (
                                                                                                        <Button
                                                                                                            size="small"
                                                                                                            onClick={() => {
                                                                                                                setEditingOption(optionKey);
                                                                                                                setEditValue(option.value);
                                                                                                            }}
                                                                                                        >
                                                                                                            Edit
                                                                                                        </Button>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })
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
                                                                                    disabled={!isFactorSelected}
                                                                                />
                                                                                <Button
                                                                                    type="primary"
                                                                                    disabled={!isFactorSelected || !selectedValues[`input_${factor.id}`]?.trim()}
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
                            )}
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
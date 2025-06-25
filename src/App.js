// src/App.js
import React from 'react';
import { Breadcrumb, Layout, Menu, theme } from 'antd';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import FirstPage from './pages/FirstPage';
import SecondPage from './pages/SecondPage';
import ThirdPage from './pages/ThirdPage';
import FourthPage from './pages/AnchorBuilder';
import 'antd/dist/reset.css';
import './App.css'; // 引入自定义CSS文件
import logoImg from './Logo.png'; // 引入图片

const { Header, Content, Footer } = Layout;

const App = () => {
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    const location = useLocation();
    const getSelectedKey = () => {
        switch (location.pathname) {
            case '/':
                return '1';
            case '/second':
                return '2';
            case '/third':
                return '3';
            case '/fourth': 
                return '4';
            default:
                return '1';
        }
    };
    console.log(location.pathname)
    return (
            <Layout className="layout" theme="light">
                <Header className="header">
                    <div className="logo">
                        <img src={logoImg} alt="logo" /> Persona Mail
                    </div>
                    <div className="menu-container">
                        <Menu
                            theme="light"
                            mode="horizontal"
                            selectedKeys={[getSelectedKey()]}
                            key={location.pathname}
                            items={[
                                {
                                    key: '1',
                                    label: <Link to="/">Email Task</Link>,
                                },
                                {
                                    key: '2',
                                    label: <Link to="/second">Tone Setting</Link>,
                                },
                                {
                                    key: '3',
                                    label: <Link to="/third">Final Email</Link>,
                                },
                                {
                                    key: '4',
                                    label: <Link to="/forth">Anchor Builder</Link>,
                                },
                            ]}
                        />
                    </div>
                    
                </Header>
                <Content
                    className="content"
                    style={{
                        padding: '0 50px',
                        minHeight: 'calc(100vh - 130px)',
                        background: colorBgContainer,
                    }}
                >
                    <Routes>
                        <Route path="/" element={<FirstPage />} />
                        <Route path="/second" element={<SecondPage />} />
                        <Route path="/third" element={<ThirdPage />} />
                        <Route path="/fourth" element={<FourthPage />} />
                    </Routes>
                </Content>
                <Footer className="footer">Persona Mail Prototype @Synteraction Lab</Footer>
            </Layout>
    );
};

export default App;
import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Tabs, Select } from 'antd';
import { UserOutlined, LockOutlined, PhoneOutlined, SafetyOutlined, ShopOutlined, CrownOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Text } = Typography;

function Login({ onLogin }) {
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [activeTab, setActiveTab] = useState('password');
  const [stores, setStores] = useState([]);
  const [codePhone, setCodePhone] = useState(''); // 记录发送验证码的手机号

  // 加载门店列表
  useEffect(() => {
    api.get('/api/public/stores').then(res => {
      setStores(res.data.stores || []);
    }).catch(() => {});
  }, []);

  // 账号密码登录
  const onPasswordLogin = async (values) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', values);
      message.success('登录成功');
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      message.error(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 验证码登录
  const onCodeLogin = async (values) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/verify-code', values);
      message.success('登录成功');
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      message.error(err.response?.data?.error || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册
  const onRegister = async (values) => {
    setLoading(true);
    try {
      const res = await api.post('/api/auth/register', values);
      message.success('注册成功！已自动登录');
      onLogin(res.data.user, res.data.token);
    } catch (err) {
      message.error(err.response?.data?.error || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  // 发送验证码
  const sendCode = async (phone) => {
    if (!phone || !/^1\d{10}$/.test(phone)) {
      message.error('请输入正确的手机号');
      return;
    }
    setCodePhone(phone);
    setCodeLoading(true);
    try {
      await api.post('/api/auth/send-code', { phone });
      message.success('验证码已发送，请联系管理员获取');
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      message.error(err.response?.data?.error || '验证码发送失败');
    } finally {
      setCodeLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'password',
      label: '账号密码登录',
      children: (
        <Form onFinish={onPasswordLogin} size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名/手机号" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'code',
      label: '手机验证码登录',
      children: (
        <Form onFinish={onCodeLogin} size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号" maxLength={11} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.phone !== cur.phone}>
            {({ getFieldValue }) => {
              const phone = getFieldValue('phone');
              return (
                <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }]}>
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder="验证码"
                    maxLength={6}
                    suffix={
                      <Button
                        type="link"
                        size="small"
                        loading={codeLoading}
                        disabled={countdown > 0}
                        onClick={() => sendCode(phone)}
                        style={{ padding: 0 }}
                      >
                        {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                      </Button>
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      )
    },
    {
      key: 'register',
      label: '门店注册',
      children: (
        <Form onFinish={onRegister} size="large">
          <Form.Item name="phone" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '手机号格式不正确' }]}>
            <Input prefix={<PhoneOutlined />} placeholder="手机号（用于登录）" maxLength={11} />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.phone !== cur.phone}>
            {({ getFieldValue }) => {
              const phone = getFieldValue('phone');
              return (
                <Form.Item name="code" rules={[{ required: true, message: '请输入验证码' }]}>
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder="验证码"
                    maxLength={6}
                    suffix={
                      <Button
                        type="link"
                        size="small"
                        loading={codeLoading}
                        disabled={countdown > 0}
                        onClick={() => sendCode(phone)}
                        style={{ padding: 0 }}
                      >
                        {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
                      </Button>
                    }
                  />
                </Form.Item>
              );
            }}
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请设置密码' }, { min: 6, message: '密码至少6位' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="设置密码（至少6位）" />
          </Form.Item>
          <Form.Item name="store_name" rules={[{ required: true, message: '请选择所属门店' }]}>
            <Select prefix={<ShopOutlined />} placeholder="选择所属门店" showSearch>
              {stores.map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              注册并登录
            </Button>
          </Form.Item>
        </Form>
      )
    }
  ];

  return (
    <div className="login-container">
      {/* 品牌Logo - 居中放大 */}
      <div style={{ position: 'absolute', top: -113, left: '50%', transform: 'translateX(calc(-50% - 28px))', width: 440, textAlign: 'center' }}>
        <img src="/logo.png" alt="" style={{ height: 500 }} />
      </div>

      {/* 吉祥物装饰 - 水豚 */}
      <div className="mascot-capibara" style={{ position: 'absolute', bottom: 0, right: 50, opacity: 0.95 }}>
        <img 
          src="/mascot/11.png" 
          alt="" 
          style={{ width: 280, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))' }} 
        />
      </div>

      {/* 吉祥物装饰 - 熊猫（与水豚面对面） */}
      <div className="mascot-panda" style={{ position: 'absolute', bottom: 19, left: 3, opacity: 0.95, zIndex: 1000 }}>
        <img 
          src="/mascot/ims.webp" 
          alt="" 
          style={{ height: 400, filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.3))' }} 
        />
      </div>

      <Card className="login-card" style={{ background: 'transparent', backdropFilter: 'none', border: '2px solid rgba(255,255,255,0.3)', marginTop: 75 }}>
        <div style={{ textAlign: 'center', marginBottom: 20, paddingTop: -172 }}>
          <CrownOutlined style={{ fontSize: 48, color: '#FAAD14', marginBottom: 12 }} />
          <Title level={3} style={{ margin: '0 0 8px', color: '#fff' }}>员工荣辱榜</Title>
          <Text style={{ color: 'rgba(255,255,255,0.8)' }}>全员行为记录管理系统</Text>
          <div style={{ height: 24 }}></div>
        </div>
        <Tabs activeKey={activeTab} onChange={setActiveTab} centered items={tabItems} />
      </Card>
    </div>
  );
}

export default Login;

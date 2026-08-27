import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Button, Modal, Form, Input, message, theme, Typography } from 'antd';
import {
  CrownOutlined,
  TeamOutlined,
  FileTextOutlined,
  LogoutOutlined,
  KeyOutlined
} from '@ant-design/icons';
import api from '../api';

const { Header, Sider, Content } = AntLayout;
const { Text } = Typography;

function Layout({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { token: { colorBgContainer } } = theme.useToken();
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [changePwdForm] = Form.useForm();

  const handleChangePassword = async () => {
    try {
      const values = await changePwdForm.validateFields();
      await api.put('/api/users/change-password', {
        oldPassword: values.oldPassword,
        newPassword: values.newPassword
      });
      message.success('密码修改成功，请重新登录');
      setChangePwdVisible(false);
      changePwdForm.resetFields();
      onLogout();
    } catch (err) {
      message.error(err.response?.data?.error || '修改失败');
    }
  };

  const menuItems = [
    { key: '/', icon: <CrownOutlined />, label: '员工荣辱榜' },
    { key: '/records', icon: <FileTextOutlined />, label: '记录管理' },
    ...(user.role === 'admin' ? [{ key: '/users', icon: <TeamOutlined />, label: '用户管理' }] : [])
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ color: '#fff', fontSize: 18 }}>
            臻品足道荣辱榜
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text type="secondary">
              {user.role === 'admin' ? '总部管理员' : `门店: ${user.store_name}`}
            </Text>
            <Text>{user.username}</Text>
            <Button type="text" icon={<KeyOutlined />} onClick={() => setChangePwdVisible(true)}>
              修改密码
            </Button>
            <Button type="text" icon={<LogoutOutlined />} onClick={onLogout}>
              退出
            </Button>
          </div>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </AntLayout>

      {/* 修改密码弹窗 */}
      <Modal
        title="修改密码"
        open={changePwdVisible}
        onOk={handleChangePassword}
        onCancel={() => { setChangePwdVisible(false); changePwdForm.resetFields(); }}
        okText="确认修改"
      >
        <Form form={changePwdForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="oldPassword"
            label="原密码"
            rules={[{ required: true, message: '请输入原密码' }]}
          >
            <Input.Password placeholder="请输入原密码" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password placeholder="请输入新密码（至少6位）" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请确认新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  );
}

export default Layout;

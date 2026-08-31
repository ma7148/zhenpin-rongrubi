import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Typography, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title } = Typography;

function Users() {
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [storeModalVisible, setStoreModalVisible] = useState(false); // 创建门店弹窗
  const [editUser, setEditUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [form] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [storeForm] = Form.useForm(); // 门店表单

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.users);
    } catch (err) {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchStores = async () => {
    try {
      const res = await api.get('/api/stores');
      // 后端返回的是 {name, number} 对象数组，提取 name
      setStores(res.data.stores.map(s => s.name));
    } catch (err) { /* ignore */ }
  };

  useEffect(() => { fetchUsers(); fetchStores(); }, []);

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/api/users', values);
      message.success('创建成功');
      setModalVisible(false);
      setEditUser(null);
      form.resetFields();
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const handleEdit = async () => {
    try {
      const values = await form.validateFields();
      await api.put(`/api/users/${editUser.id}`, values);
      message.success('更新成功');
      setModalVisible(false);
      setEditUser(null);
      form.resetFields();
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.error || '更新失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/users/${id}`);
      message.success('删除成功');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  // 重置密码
  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields();
      await api.put(`/api/users/${resetUser.id}/reset-password`, { newPassword: values.newPassword });
      message.success(`已重置 ${resetUser.username} 的密码`);
      setResetModalVisible(false);
      setResetUser(null);
      resetForm.resetFields();
    } catch (err) {
      message.error(err.response?.data?.error || '重置失败');
    }
  };

  // 创建新门店
  const handleCreateStore = async () => {
    try {
      const values = await storeForm.validateFields();
      await api.post('/api/admin/stores', values);
      message.success('门店创建成功');
      setStoreModalVisible(false);
      storeForm.resetFields();
      fetchStores(); // 刷新门店列表
    } catch (err) {
      message.error(err.response?.data?.error || '创建失败');
    }
  };

  const openEdit = (record) => {
    setEditUser(record);
    form.setFieldsValue({
      role: record.role,
      store_name: record.store_name
    });
    setModalVisible(true);
  };

  const openResetPassword = (record) => {
    setResetUser(record);
    resetForm.resetFields();
    setResetModalVisible(true);
  };

  // 统计每个门店的账户数
  const storeAccountCount = {};
  users.forEach(u => {
    if (u.store_name && u.role === 'store') {
      storeAccountCount[u.store_name] = (storeAccountCount[u.store_name] || 0) + 1;
    }
  });

  const columns = [
    { title: '用户名/手机号', dataIndex: 'username', key: 'username' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => role === 'admin' ? <Tag color="red">总部管理员</Tag> : <Tag color="blue">门店账户</Tag>
    },
    {
      title: '门店',
      dataIndex: 'store_name',
      key: 'store_name',
      render: (v, record) => {
        if (!v) return <span style={{ color: '#999' }}>未分配</span>;
        const count = storeAccountCount[v] || 0;
        return (
          <span>
            <Tag color="green">{v}</Tag>
            {record.role === 'store' && (
              <span style={{ fontSize: 12, color: count >= 2 ? '#ff4d4f' : '#999' }}>
                ({count}/2)
              </span>
            )}
          </span>
        );
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space wrap>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetPassword(record)}
            disabled={record.username === 'admin'}>
            重置密码
          </Button>
          <Popconfirm title={`确定删除 ${record.username}？删除后该门店可注册新账户`} onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} disabled={record.username === 'admin'}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>用户管理</Title>
        <Space>
          <Button icon={<PlusOutlined />} onClick={() => { setStoreModalVisible(true); storeForm.resetFields(); }}>
            创建门店
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditUser(null); form.resetFields(); setModalVisible(true); }}>
            创建用户
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={users} rowKey="id" loading={loading} />

      {/* 编辑/创建弹窗 */}
      <Modal
        title={editUser ? `编辑用户 - ${editUser.username}` : '创建用户'}
        open={modalVisible}
        onOk={editUser ? handleEdit : handleAdd}
        onCancel={() => { setModalVisible(false); setEditUser(null); form.resetFields(); }}
      >
        <Form form={form} layout="vertical">
          {!editUser && (
            <>
              <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                <Input placeholder="登录用户名（或手机号）" />
              </Form.Item>
              <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少6位' }]}>
                <Input.Password placeholder="登录密码" />
              </Form.Item>
            </>
          )}
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色">
              <Select.Option value="admin">总部管理员</Select.Option>
              <Select.Option value="store">门店账户</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.role !== cur.role}>
            {({ getFieldValue }) =>
              getFieldValue('role') === 'store' ? (
                <Form.Item name="store_name" label="所属门店" rules={[{ required: true, message: '请选择门店' }]}>
                  <Select placeholder="选择门店" showSearch allowClear>
                    {stores.map(s => (
                      <Select.Option key={s} value={s}>{s}</Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* 重置密码弹窗 */}
      <Modal
        title={<span><LockOutlined /> 重置密码 - {resetUser?.username}</span>}
        open={resetModalVisible}
        onOk={handleResetPassword}
        onCancel={() => { setResetModalVisible(false); setResetUser(null); resetForm.resetFields(); }}
      >
        <Form form={resetForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' }
            ]}
          >
            <Input.Password placeholder="输入新密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建门店弹窗 */}
      <Modal
        title={<span><PlusOutlined /> 创建新门店</span>}
        open={storeModalVisible}
        onOk={handleCreateStore}
        onCancel={() => { setStoreModalVisible(false); storeForm.resetFields(); }}
      >
        <Form form={storeForm} layout="vertical">
          <Form.Item 
            name="store_name" 
            label="门店名称" 
            rules={[{ required: true, message: '请输入门店名称' }]}
          >
            <Input placeholder="例如：王府井店、光谷店" />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            提示：创建后该门店将出现在员工选择列表中，可用于注册分店账户。
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default Users;

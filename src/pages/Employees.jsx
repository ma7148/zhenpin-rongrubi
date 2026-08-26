import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, message, Typography, Space, Popconfirm, Upload, List, Tag, Card, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title, Text } = Typography;

function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [fileModalVisible, setFileModalVisible] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [currentEmployee, setCurrentEmployee] = useState(null);
  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [expandedRecords, setExpandedRecords] = useState({}); // 存储每个员工的明细

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/employees');
      setEmployees(res.data.employees);
    } catch (err) {
      message.error('获取员工列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const handleAdd = () => {
    setEditingEmployee(null);
    form.resetFields();
    if (user.role === 'store') {
      form.setFieldsValue({ store_name: user.store_name });
    }
    setModalVisible(true);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    form.setFieldsValue({
      ...employee,
      hire_date: employee.hire_date ? dayjs(employee.hire_date) : null
    });
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/employees/${id}`);
      message.success('删除成功');
      fetchEmployees();
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data = { ...values, hire_date: values.hire_date ? values.hire_date.format('YYYY-MM-DD') : null };

      if (editingEmployee) {
        await api.put(`/api/employees/${editingEmployee.id}`, data);
        message.success('更新成功');
      } else {
        await api.post('/api/employees', data);
        message.success('添加成功');
      }
      setModalVisible(false);
      fetchEmployees();
    } catch (err) {
      message.error(err.response?.data?.error || '操作失败');
    }
  };

  // 文件管理相关
  const openFileModal = async (employee) => {
    setCurrentEmployee(employee);
    setFileModalVisible(true);
    await fetchFiles(employee.id);
  };

  const fetchFiles = async (employeeId) => {
    setFilesLoading(true);
    try {
      const res = await api.get(`/api/files?employee_id=${employeeId}`);
      setFiles(res.data.files);
    } catch (err) {
      message.error('获取文件列表失败');
    } finally {
      setFilesLoading(false);
    }
  };

  const handleUpload = async (fileList) => {
    if (!currentEmployee) return;
    
    setUploading(true);
    const formData = new FormData();
    formData.append('employee_id', currentEmployee.id);
    fileList.forEach(file => {
      formData.append('files', file.originFileObj || file);
    });

    try {
      const res = await api.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(res.data.message);
      await fetchFiles(currentEmployee.id);
    } catch (err) {
      message.error(err.response?.data?.error || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (file) => {
    window.open(`/api/files/${file.id}/download`, '_blank');
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await api.delete(`/api/files/${fileId}`);
      message.success('删除成功');
      await fetchFiles(currentEmployee.id);
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const getFileIcon = (fileType) => {
    if (fileType.includes('pdf')) return <Tag color="red">PDF</Tag>;
    if (fileType.includes('word') || fileType.includes('document')) return <Tag color="blue">Word</Tag>;
    if (fileType.includes('excel') || fileType.includes('sheet')) return <Tag color="green">Excel</Tag>;
    if (fileType.includes('text')) return <Tag color="orange">文本</Tag>;
    return <Tag>文件</Tag>;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 展开行时加载员工的荣辱明细
  const handleExpand = async (expanded, record) => {
    if (expanded && !expandedRecords[record.id]) {
      try {
        const res = await api.get(`/api/records?employee_id=${record.id}`);
        setExpandedRecords(prev => ({ ...prev, [record.id]: res.data.records || [] }));
      } catch (err) {
        console.error('获取记录失败', err);
      }
    }
  };

  const expandedRowRender = (record) => {
    const records = expandedRecords[record.id] || [];
    if (records.length === 0) {
      return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>暂无荣辱记录</div>;
    }
    return (
      <div style={{ padding: '0 48px' }}>
        {records.map(rec => (
          <Card key={rec.id} size="small" style={{ marginBottom: 12 }}>
            <Row gutter={16} align="middle">
              <Col span={4}>
                <Tag color={rec.status === 'approved' ? 'green' : rec.status === 'pending' ? 'orange' : 'red'}>
                  {rec.status === 'approved' ? '已通过' : rec.status === 'pending' ? '待审核' : '已驳回'}
                </Tag>
              </Col>
              <Col span={4}><Text type="secondary">月份：</Text>{rec.month}</Col>
              <Col span={4}><Text type="secondary">门店：</Text>{rec.store_name}</Col>
              <Col span={4}><Text type="secondary">提交人：</Text>{rec.submitted_by_name}</Col>
              <Col span={4}><Text type="secondary">提交时间：</Text>{dayjs(rec.submitted_at).format('YYYY-MM-DD')}</Col>
            </Row>
            {rec.items && rec.items.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {rec.items.map((item, i) => (
                  <div key={i} style={{ padding: '8px 12px', marginBottom: 8, background: item.type === 'honor' ? '#f6ffed' : '#fff2f0', borderLeft: `3px solid ${item.type === 'honor' ? '#52c41a' : '#ff4d4f'}` }}>
                    <Row gutter={16}>
                      <Col span={2}>
                        <Tag color={item.type === 'honor' ? 'green' : 'red'}>
                          {item.type === 'honor' ? '荣' : '辱'}
                        </Tag>
                      </Col>
                      <Col span={6}><Text type="secondary">日期：</Text>{item.date}</Col>
                      <Col span={16}><strong>{item.title}</strong>{item.description && <div style={{ color: '#666', marginTop: 4 }}>{item.description}</div>}</Col>
                    </Row>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    );
  };

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '身份证号', dataIndex: 'id_number', key: 'id_number', render: (v) => v || '-' },
    { title: '所属门店', dataIndex: 'store_name', key: 'store_name' },
    {
      title: '入职日期',
      dataIndex: 'hire_date',
      key: 'hire_date',
      render: (date) => date ? dayjs(date).format('YYYY-MM-DD') : '-'
    },
    {
      title: '入职年限',
      dataIndex: 'work_years_text',
      key: 'work_years_text',
      render: (text) => text || '-'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<UploadOutlined />} onClick={() => openFileModal(record)}>
            文件
          </Button>
          {user.role === 'admin' && (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
              <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4}>员工管理</Title>
        {user.role === 'admin' && (
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加员工</Button>
        )}
      </div>

      <Table 
        columns={columns} 
        dataSource={employees} 
        rowKey="id" 
        loading={loading}
        expandable={{
          expandedRowRender,
          onExpand: handleExpand,
          rowExpandable: (record) => true
        }}
      />

      {/* 添加/编辑员工弹窗 */}
      <Modal
        title={editingEmployee ? '编辑员工' : '添加员工'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="id_number" label="身份证号（选填）">
            <Input placeholder="没有可不填" />
          </Form.Item>
          <Form.Item name="store_name" label="所属门店" rules={[{ required: true, message: '请输入所属门店' }]}>
            <Input disabled={user.role === 'store'} />
          </Form.Item>
          <Form.Item name="hire_date" label="入职日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 文件管理弹窗 */}
      <Modal
        title={currentEmployee ? `${currentEmployee.name} - 文件管理` : '文件管理'}
        open={fileModalVisible}
        onCancel={() => setFileModalVisible(false)}
        footer={null}
        width={700}
      >
        {currentEmployee && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Upload.Dragger
                multiple
                beforeUpload={() => false}
                onChange={({ fileList }) => {
                  if (fileList.length > 0) {
                    handleUpload(fileList);
                  }
                }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                disabled={uploading}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">
                  支持 PDF、Word、Excel、文本文件，单个文件不超过 50MB
                </p>
              </Upload.Dragger>
            </div>

            <div>
              <Text strong>已上传文件 ({files.length})</Text>
              {filesLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>加载中...</div>
              ) : files.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 20, color: '#888' }}>暂无文件</div>
              ) : (
                <List
                  dataSource={files}
                  renderItem={file => (
                    <List.Item
                      actions={[
                        <Button type="link" icon={<DownloadOutlined />} onClick={() => handleDownload(file)}>
                          下载
                        </Button>,
                        <Popconfirm title="确定删除该文件？" onConfirm={() => handleDeleteFile(file.id)}>
                          <Button type="link" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileOutlined style={{ fontSize: 24, color: '#1890ff' }} />}
                        title={file.original_name}
                        description={
                          <Space>
                            {getFileIcon(file.file_type)}
                            <Text type="secondary">{formatFileSize(file.file_size)}</Text>
                            <Text type="secondary">上传人: {file.uploaded_by_name}</Text>
                            <Text type="secondary">{dayjs(file.uploaded_at).format('YYYY-MM-DD HH:mm')}</Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Employees;

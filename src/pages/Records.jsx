import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, DatePicker,
  message, Card, Typography, Space, Tag, Popconfirm, Row, Col
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, ImportOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';
import ImportModal from '../components/ImportModal';

const { Title, Text } = Typography;
const { TextArea } = Input;

function Records({ user }) {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [form] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [items, setItems] = useState([]);
  const [filterStatus, setFilterStatus] = useState(null);
  const [filterMonth, setFilterMonth] = useState(null);
  const [filterStore, setFilterStore] = useState(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.append('status', filterStatus);
      if (filterMonth) params.append('month', filterMonth);
      if (user.role === 'admin' && filterStore) params.append('store_name', filterStore);
      const res = await api.get(`/api/records?${params.toString()}`);
      setRecords(res.data.records);
    } catch (err) {
      message.error('获取记录失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/api/employees');
      setEmployees(res.data.employees);
    } catch (err) {
      console.error('获取员工列表失败');
    }
  };

  const fetchStores = async () => {
    if (user.role === 'admin') {
      try {
        const res = await api.get('/api/stores');
        setStores(res.data.stores);
      } catch (err) {
        console.error('获取门店列表失败');
      }
    }
  };

  useEffect(() => { fetchRecords(); }, [filterStatus, filterMonth, filterStore]);
  useEffect(() => { fetchEmployees(); fetchStores(); }, []);

  const handleAddItem = () => {
    setItems([...items, { type: 'honor', title: '', description: '', date: dayjs() }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = typeof value === 'object' && value.format ? value.format('YYYY-MM-DD') : value;
    setItems(newItems);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.error('请至少添加一条记录');
        return;
      }
      for (let i = 0; i < items.length; i++) {
        if (!items[i].title) {
          message.error(`请填写第 ${i + 1} 条记录的标题`);
          return;
        }
      }

      await api.post('/api/records', {
        employee_id: values.employee_id,
        month: values.month,
        items
      });

      message.success('提交成功');
      setSubmitModalVisible(false);
      form.resetFields();
      setItems([]);
      fetchRecords();
    } catch (err) {
      message.error(err.response?.data?.error || '提交失败');
    }
  };

  const handleReview = async (record, status) => {
    try {
      const values = await reviewForm.validateFields();
      await api.put(`/api/records/${record.id}/review`, { status, review_note: values.review_note });
      message.success(status === 'approved' ? '已通过' : '已驳回');
      setReviewModalVisible(false);
      reviewForm.resetFields();
      fetchRecords();
    } catch (err) {
      message.error('操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/api/records/${id}`);
      message.success('删除成功');
      fetchRecords();
    } catch (err) {
      message.error(err.response?.data?.error || '删除失败');
    }
  };

  const openReviewModal = (record) => {
    setCurrentRecord(record);
    reviewForm.resetFields();
    setReviewModalVisible(true);
  };

  const openSubmitModal = () => {
    form.resetFields();
    setItems([]);
    setSubmitModalVisible(true);
  };

  const statusTag = (status) => {
    const map = {
      pending: { color: 'orange', text: '待审核' },
      approved: { color: 'green', text: '已通过' },
      rejected: { color: 'red', text: '已驳回' }
    };
    const s = map[status] || { color: 'default', text: status };
    return <Tag color={s.color}>{s.text}</Tag>;
  };

  const columns = [
    { title: '员工', dataIndex: 'employee_name', key: 'employee_name', width: 100 },
    { title: '门店', dataIndex: 'store_name', key: 'store_name', width: 120 },
    { title: '月份', dataIndex: 'month', key: 'month', width: 100 },
    {
      title: '荣',
      key: 'honor_count',
      width: 60,
      render: (_, record) => {
        const count = record.items?.filter(i => i.type === 'honor').length || 0;
        return <Tag color="green">{count}</Tag>;
      }
    },
    {
      title: '辱',
      key: 'shame_count',
      width: 60,
      render: (_, record) => {
        const count = record.items?.filter(i => i.type === 'shame').length || 0;
        return <Tag color="red">{count}</Tag>;
      }
    },
    { title: '提交人', dataIndex: 'submitted_by_name', key: 'submitted_by_name', width: 100 },
    {
      title: '提交时间',
      dataIndex: 'submitted_at',
      key: 'submitted_at',
      width: 160,
      render: (date) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80, render: (status) => statusTag(status) },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setCurrentRecord(record); }}>
            详情
          </Button>
          {user.role === 'admin' && record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => openReviewModal(record)}>
              审核
            </Button>
          )}
          {user.role === 'admin' && (
            <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger size="small">删除</Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select
              placeholder="状态筛选"
              allowClear
              style={{ width: 120 }}
              value={filterStatus}
              onChange={setFilterStatus}
              options={[
                { value: 'pending', label: '待审核' },
                { value: 'approved', label: '已通过' },
                { value: 'rejected', label: '已驳回' }
              ]}
            />
          </Col>
          <Col>
            <DatePicker
              picker="month"
              placeholder="选择月份"
              value={filterMonth ? dayjs(filterMonth) : null}
              onChange={(date) => setFilterMonth(date ? date.format('YYYY-MM') : null)}
            />
          </Col>
          {user.role === 'admin' && (
            <Col>
              <Select
                placeholder="门店筛选"
                allowClear
                style={{ width: 150 }}
                value={filterStore}
                onChange={setFilterStore}
                options={stores.map(s => ({ value: s, label: s }))}
              />
            </Col>
          )}
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Space>
              {user.role === 'admin' && (
                <Button icon={<ImportOutlined />} onClick={() => setImportModalVisible(true)}>
                  批量导入
                </Button>
              )}
              <Button type="primary" icon={<PlusOutlined />} onClick={openSubmitModal}>
                提交记录
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Table columns={columns} dataSource={records} rowKey="id" loading={loading} scroll={{ x: 1000 }} />

      {/* 详情弹窗 */}
      <Modal
        title={currentRecord && !reviewModalVisible ? `${currentRecord.employee_name} - ${currentRecord.month} 记录详情` : ''}
        open={!!currentRecord && !reviewModalVisible}
        onCancel={() => setCurrentRecord(null)}
        footer={<Button onClick={() => setCurrentRecord(null)}>关闭</Button>}
        width={640}
      >
        {currentRecord && (
          <div>
            <p><strong>门店：</strong>{currentRecord.store_name}</p>
            {currentRecord.id_number && <p><strong>身份证号：</strong>{currentRecord.id_number}</p>}
            <p><strong>状态：</strong>{statusTag(currentRecord.status)}</p>
            <p><strong>提交人：</strong>{currentRecord.submitted_by_name}</p>
            {currentRecord.review_note && <p><strong>审核备注：</strong>{currentRecord.review_note}</p>}
            <div style={{ marginTop: 16 }}>
              <Title level={5}>记录明细</Title>
              {currentRecord.items?.map((item, index) => (
                <Card key={index} size="small" style={{ marginBottom: 8 }} className={`record-item ${item.type}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Tag color={item.type === 'honor' ? 'green' : 'red'}>
                      {item.type === 'honor' ? '荣' : '辱'}
                    </Tag>
                    <Text type="secondary">{item.date}</Text>
                  </div>
                  <div style={{ marginTop: 8 }}><strong>{item.title}</strong></div>
                  {item.description && <div style={{ color: '#666', marginTop: 4 }}>{item.description}</div>}
                </Card>
              ))}
            </div>
          </div>
        )}
      </Modal>

      {/* 提交记录弹窗 */}
      <Modal
        title="提交月度记录"
        open={submitModalVisible}
        onOk={handleSubmit}
        onCancel={() => setSubmitModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employee_id" label="选择员工" rules={[{ required: true, message: '请选择员工' }]}>
                <Select
                  placeholder="选择员工"
                  showSearch
                  optionFilterProp="children"
                >
                  {employees.map(emp => (
                    <Select.Option key={emp.id} value={emp.id}>
                      {emp.name}{emp.id_number ? ` (${emp.id_number})` : ''} - {emp.store_name}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="month" label="月份" rules={[{ required: true, message: '请选择月份' }]}>
                <DatePicker picker="month" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text strong>记录明细</Text>
            <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAddItem}>
              添加条目
            </Button>
          </div>

          {items.map((item, index) => (
            <Card key={index} size="small" style={{ marginBottom: 8 }}>
              <Row gutter={8}>
                <Col span={4}>
                  <Select
                    value={item.type}
                    onChange={(value) => handleItemChange(index, 'type', value)}
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="honor">荣</Select.Option>
                    <Select.Option value="shame">辱</Select.Option>
                  </Select>
                </Col>
                <Col span={8}>
                  <Input
                    placeholder="标题"
                    value={item.title}
                    onChange={(e) => handleItemChange(index, 'title', e.target.value)}
                  />
                </Col>
                <Col span={8}>
                  <Input
                    placeholder="描述（可选）"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                  />
                </Col>
                <Col span={3}>
                  <DatePicker
                    value={item.date ? dayjs(item.date) : null}
                    onChange={(date) => handleItemChange(index, 'date', date)}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={1}>
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleRemoveItem(index)} />
                </Col>
              </Row>
            </Card>
          ))}

          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 20, color: '#888', border: '1px dashed #d9d9d9', borderRadius: 6 }}>
              点击"添加条目"按钮添加荣/辱记录
            </div>
          )}
        </div>
      </Modal>

      {/* 审核弹窗 */}
      <Modal
        title={`审核 - ${currentRecord?.employee_name} ${currentRecord?.month}`}
        open={reviewModalVisible}
        onCancel={() => setReviewModalVisible(false)}
        footer={null}
      >
        {currentRecord && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>门店：</strong>{currentRecord.store_name}</p>
              <p><strong>提交人：</strong>{currentRecord.submitted_by_name}</p>
              <p><strong>记录数：</strong>{currentRecord.items?.length || 0} 条</p>
              <div style={{ marginTop: 8 }}>
                {currentRecord.items?.map((item, i) => (
                  <Tag key={i} color={item.type === 'honor' ? 'green' : 'red'} style={{ marginBottom: 4 }}>
                    {item.type === 'honor' ? '荣' : '辱'} - {item.title}
                  </Tag>
                ))}
              </div>
            </div>
            <Form form={reviewForm} layout="vertical">
              <Form.Item name="review_note" label="审核备注">
                <TextArea rows={3} placeholder="可选填写审核备注" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" icon={<CheckOutlined />} onClick={() => handleReview(currentRecord, 'approved')}>
                    通过
                  </Button>
                  <Button danger icon={<CloseOutlined />} onClick={() => handleReview(currentRecord, 'rejected')}>
                    驳回
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 批量导入弹窗 */}
      <ImportModal
        visible={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onSuccess={() => { setImportModalVisible(false); fetchRecords(); }}
      />
    </div>
  );
}

export default Records;

import React, { useState, useEffect } from 'react';
import { Input, Select, Button, Card, Typography, Tag, Empty, Row, Col, DatePicker, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title, Text } = Typography;
const { Search } = Input;

function Query() {
  const [keyword, setKeyword] = useState('');
  const [searchType, setSearchType] = useState('name');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [monthFilter, setMonthFilter] = useState(null);
  const [stores, setStores] = useState([]);

  // 加载门店列表
  useEffect(() => {
    api.get('/api/stores').then(res => {
      setStores(res.data.stores || []);
    }).catch(() => {});
  }, []);

  // 门店选择后自动搜索
  const handleSearchWithStore = async (storeName) => {
    setLoading(true);
    try {
      const recParams = new URLSearchParams({ store_name: storeName });
      if (monthFilter) recParams.append('month', monthFilter);
      const recRes = await api.get(`/api/records?${recParams.toString()}`);
      setResults(recRes.data.records);
    } catch (err) {
      console.error('搜索失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (searchType === 'store' && !keyword) {
      message.warning('请选择门店');
      return;
    }
    if (searchType !== 'store' && !keyword.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }
    setLoading(true);
    try {
      if (searchType === 'name' || searchType === 'id_number') {
        // 先获取所有员工，再按关键词筛选
        const empRes = await api.get('/api/employees');
        const matchedEmps = empRes.data.employees.filter(emp => {
          if (searchType === 'name') return emp.name.includes(keyword);
          if (searchType === 'id_number') return emp.id_number && emp.id_number.includes(keyword);
          return false;
        });
        if (matchedEmps.length === 0) {
          setResults([]);
          setLoading(false);
          return;
        }
        const empIds = matchedEmps.map(e => e.id);
        const allRecords = [];
        for (const empId of empIds) {
          const recParams = new URLSearchParams({ employee_id: empId.toString() });
          if (monthFilter) recParams.append('month', monthFilter);
          const recRes = await api.get(`/api/records?${recParams.toString()}`);
          allRecords.push(...recRes.data.records);
        }
        setResults(allRecords);
      } else if (searchType === 'store') {
        const recParams = new URLSearchParams({ store_name: keyword });
        if (monthFilter) recParams.append('month', monthFilter);
        const recRes = await api.get(`/api/records?${recParams.toString()}`);
        setResults(recRes.data.records);
      }
    } catch (err) {
      console.error('搜索失败', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Title level={4}>查询记录</Title>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Select value={searchType} onChange={(v) => { setSearchType(v); setKeyword(''); }} style={{ width: 120 }}>
              <Select.Option value="name">按姓名</Select.Option>
              <Select.Option value="id_number">按身份证号</Select.Option>
              <Select.Option value="store">按门店</Select.Option>
            </Select>
          </Col>
          <Col flex="auto">
            {searchType === 'store' ? (
              <Select
                placeholder="选择门店"
                value={keyword || undefined}
                onChange={v => { setKeyword(v || ''); if (v) handleSearchWithStore(v); }}
                style={{ width: '100%' }}
                showSearch
                allowClear
              >
                {stores.map(s => (
                  <Select.Option key={s} value={s}>{s}</Select.Option>
                ))}
              </Select>
            ) : (
              <Search
                placeholder={
                  searchType === 'name' ? '输入员工姓名' :
                  searchType === 'id_number' ? '输入身份证号' :
                  '输入门店名称'
                }
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onSearch={handleSearch}
                loading={loading}
                enterButton
              />
            )}
          </Col>
          <Col>
            <DatePicker
              picker="month"
              placeholder="按月筛选"
              value={monthFilter ? dayjs(monthFilter) : null}
              onChange={(date) => setMonthFilter(date ? date.format('YYYY-MM') : null)}
            />
          </Col>
        </Row>
      </Card>

      {results !== null && (
        <div>
          <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
            共找到 {results.length} 条记录
          </Text>
          {results.length > 0 ? results.map(record => (
            <Card
              key={record.id}
              className="query-result-card"
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong>{record.employee_name}</strong>
                    {record.id_number && <Text type="secondary" style={{ marginLeft: 8 }}>{record.id_number}</Text>}
                  </span>
                  <span>
                    <Tag color={record.status === 'approved' ? 'green' : record.status === 'pending' ? 'orange' : 'red'}>
                      {record.status === 'approved' ? '已通过' : record.status === 'pending' ? '待审核' : '已驳回'}
                    </Tag>
                  </span>
                </div>
              }
              extra={<Text type="secondary">{record.month}</Text>}
            >
              <Row gutter={16}>
                <Col span={8}><Text type="secondary">门店：</Text>{record.store_name}</Col>
                <Col span={8}><Text type="secondary">提交人：</Text>{record.submitted_by_name}</Col>
                <Col span={8}><Text type="secondary">提交时间：</Text>{dayjs(record.submitted_at).format('YYYY-MM-DD')}</Col>
              </Row>
              <div style={{ marginTop: 16 }}>
                <Text strong>记录明细：</Text>
                <div style={{ marginTop: 8 }}>
                  {record.items?.map((item, i) => (
                    <Card key={i} size="small" style={{ marginBottom: 8 }} className={`record-item ${item.type}`}>
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
            </Card>
          )) : (
            <Card>
              <Empty description="未找到相关记录" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

export default Query;

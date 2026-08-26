import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  TeamOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ShopOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import api from '../api';

const { Title } = Typography;

function Dashboard() {
  const [stats, setStats] = useState({ totalEmployees: 0, pendingReviews: 0, approvedRecords: 0, totalStores: 0 });
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => {
    api.get('/api/stats').then(res => setStats(res.data));
    api.get('/api/records').then(res => setRecentRecords(res.data.records.slice(0, 5)));
  }, []);

  return (
    <div>
      <Title level={4}>仪表板</Title>
      <Row gutter={[16, 16]} className="dashboard-stats">
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="员工总数"
              value={stats.totalEmployees}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="待审核"
              value={stats.pendingReviews}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="已通过记录"
              value={stats.approvedRecords}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="stat-card">
            <Statistic
              title="门店数量"
              value={stats.totalStores}
              prefix={<ShopOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title="最近提交">
        {recentRecords.length > 0 ? (
          <div>
            {recentRecords.map(record => (
              <div key={record.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    <strong>{record.employee_name}</strong> - {record.month}
                  </span>
                  <span style={{ color: '#888' }}>{record.submitted_by_name}</span>
                </div>
                <div style={{ color: '#888', fontSize: 12, marginTop: 4 }}>
                  {record.store_name} | {record.items?.length || 0} 条记录 |{' '}
                  {record.status === 'pending' ? '待审核' : record.status === 'approved' ? '已通过' : '已驳回'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>暂无记录</div>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;

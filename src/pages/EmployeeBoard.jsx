import React, { useState, useEffect } from 'react';
import {
  Select, Input, Card, Typography, Tag, Empty, Row, Col,
  Modal, Button, Space, message, Badge, Statistic, Divider, Tooltip, AutoComplete, DatePicker
} from 'antd';
import {
  TrophyOutlined, StarFilled, FireOutlined,
  WarningOutlined, ThunderboltOutlined, CloseCircleOutlined,
  SearchOutlined, UserOutlined, EnvironmentOutlined,
  CalendarOutlined, FileTextOutlined, PlusOutlined,
  CheckCircleFilled, CloseCircleFilled, CrownOutlined,
  RocketOutlined, ThunderboltFilled, StarTwoTone, ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

const { Title, Text, Paragraph } = Typography;
const { Search } = Input;

function EmployeeBoard({ user }) {
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeNumbers, setStoreNumbers] = useState({});
  const [allRecords, setAllRecords] = useState([]);
  const [filterStore, setFilterStore] = useState(null);
  const [filterName, setFilterName] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeRecords, setEmployeeRecords] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferForm, setTransferForm] = useState({ to_store: '', transfer_date: dayjs(), reason: '' });

  // 加载员工、门店和所有记录
  useEffect(() => {
    api.get('/api/employees').then(res => setEmployees(res.data.employees || [])).catch(() => {});
    api.get('/api/stores').then(res => {
      const storeData = res.data.stores || [];
      setStores(storeData.map(s => s.name));
      setStoreNumbers(storeData.reduce((acc, s) => { acc[s.name] = s.number; return acc; }, {}));
    }).catch(() => {});
    api.get('/api/records?status=approved').then(res => setAllRecords(res.data.records || [])).catch(() => {});
  }, []);

  // 筛选员工（排除虚拟门店记录和未知员工）
  const filteredEmployees = employees.filter(emp => {
    if (emp.name.startsWith('[门店]')) return false; // 隐藏虚拟门店记录
    if (emp.name.startsWith('未知员工')) return false; // 隐藏未知员工
    if (filterStore && emp.store_name !== filterStore) return false;
    if (filterName && !emp.name.includes(filterName)) return false;
    return true;
  });

  // 按门店+姓名合并分组
  const storeStats = {};
  filteredEmployees.forEach(emp => {
    const key = emp.store_name;
    if (!storeStats[key]) storeStats[key] = { total: 0, employees: [], store_number: emp.store_number || null };
    // 查找是否已存在同名员工
    const existing = storeStats[key].employees.find(e => e.name === emp.name);
    if (existing) {
      // 合并：记录所有ID，取最早的提干日期
      if (!existing._ids) existing._ids = [existing.id];
      existing._ids.push(emp.id);
      if (dayjs(emp.promotion_date).isBefore(dayjs(existing.promotion_date))) {
        existing.promotion_date = emp.promotion_date;
      }
    } else {
      emp._ids = [emp.id];
      storeStats[key].employees.push(emp);
      storeStats[key].total++;
    }
  });

  // 按店家编号排序：NO1、NO2排最前，其余按编号升序，无编号的排最后，公司总部排最后
  const sortedStoreEntries = Object.entries(storeStats).sort(([, a], [, b]) => {
    const getNum = (sn, name) => {
      if (name === '公司总部') return 9999; // 公司总部排最后
      if (!sn) return 999; // 无编号的排倒数第二
      const n = parseInt(sn.replace('NO', ''));
      return isNaN(n) ? 999 : n;
    };
    return getNum(a.store_number, a.employees[0]?.store_name || '') - getNum(b.store_number, b.employees[0]?.store_name || '');
  });

  // 点击员工查看详细信息
  const handleEmployeeClick = async (emp) => {
    setSelectedEmployee(emp);
    setDetailVisible(true);
    setDetailLoading(true);
    const empIds = emp._ids || [emp.id];
    // 从已加载的所有记录中筛选
    const records = allRecords.filter(r => empIds.includes(r.employee_id));
    // 同时获取待审核的记录
    try {
      const allRes = await api.get('/api/records');
      const allRecs = allRes.data.records || [];
      const merged = [...records];
      allRecs.forEach(r => {
        if (empIds.includes(r.employee_id) && r.status !== 'approved' && !merged.find(m => m.id === r.id)) {
          merged.push(r);
        }
      });
      setEmployeeRecords(merged);
    } catch (err) {
      setEmployeeRecords(records);
    }
    // 加载调动历史
    try {
      const transRes = await api.get(`/api/employees/${emp.id}/transfers`);
      setTransfers(transRes.data.transfers || []);
    } catch (err) {
      setTransfers([]);
    } finally {
      setDetailLoading(false);
    }
  };

  // 门店调动
  const handleTransfer = async () => {
    if (!transferForm.to_store) {
      message.error('请选择目标门店');
      return;
    }
    try {
      await api.post(`/api/employees/${selectedEmployee.id}/transfer`, {
        to_store: transferForm.to_store,
        transfer_date: transferForm.transfer_date.format('YYYY-MM-DD'),
        reason: transferForm.reason
      });
      message.success('调动成功');
      setTransferModalVisible(false);
      // 重新加载员工列表
      const res = await api.get('/api/employees');
      setEmployees(res.data.employees || []);
      setSelectedEmployee({ ...selectedEmployee, store_name: transferForm.to_store });
    } catch (err) {
      message.error(err.response?.data?.error || '调动失败');
    }
  };

  // 设置总监
  const handleSetDirector = async (isDirector) => {
    try {
      await api.put(`/api/employees/${selectedEmployee.id}/set-director`, { is_director: isDirector });
      message.success(isDirector ? '已设为总监' : '已取消总监');
      setSelectedEmployee({ ...selectedEmployee, is_director: isDirector ? 1 : 0 });
      // 更新员工列表
      const res = await api.get('/api/employees');
      setEmployees(res.data.employees || []);
    } catch (err) {
      message.error('操作失败');
    }
  };

  // 统计荣辱数量
  const getHonorShameStats = () => {
    let honorCount = 0;
    let shameCount = 0;
    
    for (const rec of employeeRecords) {
      if (rec.status !== 'approved') continue;
      
      if (rec.items && rec.items.length > 0) {
        // 统计items中的荣誉/不足
        for (const item of rec.items) {
          if (item.type === 'honor') honorCount++;
          if (item.type === 'shame') shameCount++;
        }
      } else if (rec.review_note) {
        // 如果没有items但有review_note,将其计为荣誉(竞聘记录)
        honorCount++;
      }
    }
    
    return { honorCount, shameCount };
  };

  // 渲染荣誉条目（金色、奖杯、奖牌风格）
  const renderHonorItem = (item, index) => (
    <div
      key={`honor-${index}`}
      style={{
        background: 'linear-gradient(135deg, #fff7e6 0%, #fffbe6 50%, #fff9db 100%)',
        border: '1px solid #ffd591',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(250, 173, 20, 0.15)'
      }}
    >
      {/* 装饰背景 */}
      <div style={{
        position: 'absolute', top: -10, right: -10,
        fontSize: 60, opacity: 0.08, transform: 'rotate(15deg)'
      }}>
        
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            background: 'linear-gradient(135deg, #fa8c16, #faad14)',
            color: '#fff', borderRadius: 20, padding: '2px 12px',
            fontSize: 13, fontWeight: 'bold',
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <TrophyOutlined /> 荣
          </span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined /> {item.date}
          </Text>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#d46b08', marginBottom: 4 }}>
          {item.title}
        </div>
        {item.description && (
          <div style={{ fontSize: 13, color: '#8c6d3f', lineHeight: 1.6 }}>
            {item.description}
          </div>
        )}
      </div>
    </div>
  );

  // 渲染耻辱条目（红色、警告风格）
  const renderShameItem = (item, index) => (
    <div
      key={`shame-${index}`}
      style={{
        background: 'linear-gradient(135deg, #fff1f0 0%, #fff2f0 50%, #fff0f0 100%)',
        border: '1px solid #ffccc7',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(255, 77, 79, 0.1)'
      }}
    >
      {/* 装饰背景 */}
      <div style={{
        position: 'absolute', top: -10, right: -10,
        fontSize: 60, opacity: 0.08, transform: 'rotate(-15deg)'
      }}>
        ⚠️
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{
            background: 'linear-gradient(135deg, #cf1322, #f5222d)',
            color: '#fff', borderRadius: 20, padding: '2px 12px',
            fontSize: 13, fontWeight: 'bold',
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            <WarningOutlined /> 辱
          </span>
          <Text type="secondary" style={{ fontSize: 12 }}>
            <CalendarOutlined /> {item.date}
          </Text>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#cf1322', marginBottom: 4 }}>
          {item.title}
        </div>
        {item.description && (
          <div style={{ fontSize: 13, color: '#a8071a', lineHeight: 1.6 }}>
            {item.description}
          </div>
        )}
      </div>
    </div>
  );

  const { honorCount, shameCount } = getHonorShameStats();

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #FFF9F0 0%, #FFFFFF 100%)' }}>
      {/* 顶部品牌装饰 */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 6, 
        background: 'linear-gradient(90deg, #8B5A2B 0%, #D4A574 50%, #FAAD14 100%)'
      }} />

      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <Title level={4} style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <CrownOutlined style={{ color: '#FAAD14', fontSize: 28 }} />
          <span>员工荣辱榜</span>
          {/* 吉祥物小图标 */}
          <img 
            src="/mascot/11.png" 
            alt="水豚" 
            style={{ width: 32, marginLeft: 'auto' }} 
          />
        </Title>

      {/* 筛选栏 */}
      <Card style={{ marginBottom: 20, borderRadius: 12 }}>
        <Row gutter={16} align="middle">
          <Col xs={24} sm={8}>
            <AutoComplete
              placeholder="搜索员工姓名"
              value={filterName}
              onChange={setFilterName}
              allowClear
              style={{ width: '100%' }}
              options={[
                ...new Set(employees.map(e => e.name))
              ].filter(name => !filterName || name.includes(filterName)).map(name => ({
                value: name,
                label: name
              }))}
            >
              <Input prefix={<SearchOutlined />} allowClear />
            </AutoComplete>
          </Col>
          <Col xs={24} sm={8}>
            <Select
              placeholder="按门店筛选"
              value={filterStore}
              onChange={setFilterStore}
              allowClear
              style={{ width: '100%' }}
              showSearch
            >
              {stores.map(s => (
                <Select.Option key={s} value={s}>
                  {storeNumbers[s] ? <><Tag color="blue" style={{ marginRight: 8 }}>{storeNumbers[s]}</Tag>{s}</> : s}
                </Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Text type="secondary">
              共 <strong style={{ color: '#1890ff' }}>{filteredEmployees.length}</strong> 名员工
            </Text>
          </Col>
        </Row>
      </Card>

      {/* 按门店分组展示员工 */}
      {Object.keys(storeStats).length === 0 ? (
        <Card>
          <Empty description="暂无员工数据" />
        </Card>
      ) : (
        sortedStoreEntries.map(([storeName, data]) => (
          <div key={storeName} style={{ marginBottom: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '2px solid #f0f0f0'
            }}>
              {data.store_number && <Tag color="purple" style={{ fontSize: 13, padding: '2px 8px' }}>{data.store_number}</Tag>}
              <EnvironmentOutlined style={{ color: '#1890ff', fontSize: 18 }} />
              <Title level={5} style={{ margin: 0 }}>{storeName}</Title>
              <Tag color="blue">{data.total}人</Tag>
            </div>
            <Row gutter={[12, 12]}>
              {data.employees.map(emp => {
                const empIds = emp._ids || [emp.id];
                const empRecords = allRecords.filter(r => empIds.includes(r.employee_id));
                let empHonor = 0, empShame = 0;
                empRecords.forEach(rec => {
                  rec.items?.forEach(item => {
                    if (item.type === 'honor') empHonor++;
                    if (item.type === 'shame') empShame++;
                  });
                });
                return (
                  <Col xs={12} sm={8} md={6} lg={4} key={emp.id}>
                    <Card
                      hoverable
                      onClick={() => handleEmployeeClick(emp)}
                      style={{
                        borderRadius: 12,
                        textAlign: 'center',
                        cursor: 'pointer',
                        border: '1px solid #f0f0f0',
                        transition: 'all 0.3s'
                      }}
                      styles={{ body: { padding: '16px 12px' } }}
                    >
                      <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8B5A2B 0%, #D4A574 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 10px', fontSize: 24, color: '#fff',
                        fontWeight: 'bold'
                      }}>
                        {emp.name.charAt(0)}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        {emp.name}
                        {emp.is_director && (
                          <Tag color="gold" style={{ margin: 0, fontSize: 11, padding: '0 4px' }}>总监</Tag>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
                        {emp.hire_date ? dayjs(emp.hire_date).format('YYYY-MM') : '未设置'} 入职
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                        {empHonor > 0 && (
                          <Tooltip title="荣誉">
                            <span style={{ color: '#faad14', fontSize: 13 }}>
                              <TrophyOutlined /> {empHonor}
                            </span>
                          </Tooltip>
                        )}
                        {empShame > 0 && (
                          <Tooltip title="不足">
                            <span style={{ color: '#f5222d', fontSize: 13 }}>
                              <WarningOutlined /> {empShame}
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </Card>
                  </Col>
                );
              })}
            </Row>
          </div>
        ))
      )}

      {/* 员工详情弹窗 */}
      <Modal
        open={detailVisible}
        onCancel={() => { setDetailVisible(false); setSelectedEmployee(null); }}
        footer={null}
        width={720}
        title={null}
        styles={{ body: { padding: 0 } }}
      >
        {selectedEmployee && (
          <div>
            {/* 员工信息头部 */}
            <div style={{
              background: 'linear-gradient(135deg, #8B5A2B 0%, #D4A574 100%)',
              padding: '32px 32px 24px',
              color: '#fff',
              borderRadius: '12px 12px 0 0'
            }}>
              <Row align="middle" gutter={20}>
                <Col>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 32, fontWeight: 'bold',
                    border: '3px solid rgba(255,255,255,0.4)'
                  }}>
                    {selectedEmployee.name.charAt(0)}
                  </div>
                </Col>
                <Col flex="auto">
                  <div style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {selectedEmployee.name}
                    {selectedEmployee.is_director && (
                      <Tag color="gold" style={{ margin: 0, fontSize: 14, padding: '2px 10px' }}>总监</Tag>
                    )}
                  </div>
                  <div style={{ fontSize: 14, opacity: 0.85 }}>
                    <EnvironmentOutlined style={{ marginRight: 4 }} />
                    {selectedEmployee.store_name}
                    {selectedEmployee.id_number && (
                      <>
                        <span style={{ margin: '0 8px', opacity: 0.5 }}>|</span>
                        {selectedEmployee.id_number}
                      </>
                    )}
                  </div>
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                    <CalendarOutlined style={{ marginRight: 4 }} />
                    入职日期：{selectedEmployee.hire_date ? dayjs(selectedEmployee.hire_date).format('YYYY-MM-DD') : '未设置'}
                  </div>
                  {selectedEmployee.work_years !== null && (
                    <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>
                      <ClockCircleOutlined style={{ marginRight: 4 }} />
                      入职年限：{selectedEmployee.work_years}年
                    </div>
                  )}
                </Col>
              </Row>
            </div>

            {/* 统计卡片 */}
            <div style={{ padding: '20px 32px 0' }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Card style={{ borderRadius: 10, textAlign: 'center', borderColor: '#ffd591' }}>
                    <Statistic
                      title={<span style={{ color: '#fa8c16' }}><TrophyOutlined /> 荣誉</span>}
                      value={honorCount}
                      valueStyle={{ color: '#fa8c16', fontSize: 28 }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ borderRadius: 10, textAlign: 'center', borderColor: '#ffccc7' }}>
                    <Statistic
                      title={<span style={{ color: '#cf1322' }}><WarningOutlined /> 不足</span>}
                      value={shameCount}
                      valueStyle={{ color: '#cf1322', fontSize: 28 }}
                    />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                    <Statistic
                      title={<span><FileTextOutlined /> 记录数</span>}
                      value={employeeRecords.filter(r => r.status === 'approved').length}
                      valueStyle={{ color: '#1890ff', fontSize: 28 }}
                    />
                  </Card>
                </Col>
              </Row>
            </div>

            {/* 调动历史 */}
            {transfers.length > 0 && (
              <div style={{ padding: '0 32px' }}>
                <Divider style={{ margin: '16px 0' }} />
                <Title level={5} style={{ marginBottom: 12 }}>
                  <RocketOutlined style={{ marginRight: 8 }} />门店调动历史
                </Title>
                {transfers.map(t => (
                  <div key={t.id} style={{
                    padding: '10px 14px', marginBottom: 8,
                    background: '#f5f5f5', borderRadius: 8,
                    borderLeft: '3px solid #1890ff'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>{t.from_store} → {t.to_store}</Text>
                      <Text type="secondary">{dayjs(t.transfer_date).format('YYYY-MM-DD')}</Text>
                    </div>
                    {t.reason && <div style={{ fontSize: 13, color: '#666' }}>{t.reason}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* 管理员操作按钮 */}
            {user.role === 'admin' && selectedEmployee && (
              <div style={{ padding: '16px 32px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Button type="primary" onClick={() => setTransferModalVisible(true)}>
                  <RocketOutlined /> 门店调动
                </Button>
                {selectedEmployee.is_director ? (
                  <Button onClick={() => handleSetDirector(false)}>取消总监</Button>
                ) : (
                  <Button type="primary" ghost onClick={() => handleSetDirector(true)}>
                    设为总监
                  </Button>
                )}
              </div>
            )}

            {/* 荣辱明细 */}
            <div style={{ padding: '20px 32px 32px' }}>
              <Divider style={{ margin: '16px 0' }} />
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
                  加载中...
                </div>
              ) : employeeRecords.filter(r => r.status === 'approved').length === 0 ? (
                <Empty description="暂无荣辱记录" />
              ) : (
                employeeRecords
                  .filter(r => r.status === 'approved')
                  .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
                  .map((record, ri) => (
                    <div key={record.id} style={{ marginBottom: 20 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginBottom: 12
                      }}>
                        <Tag color="purple" style={{ borderRadius: 12, padding: '2px 12px' }}>
                          {record.month}
                        </Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          提交人：{record.submitted_by_name} |
                          {dayjs(record.submitted_at).format('YYYY-MM-DD')}
                        </Text>
                      </div>
                      {record.items?.map((item, ii) =>
                        item.type === 'honor'
                          ? renderHonorItem(item, `${ri}-${ii}`)
                          : renderShameItem(item, `${ri}-${ii}`)
                      )}
                      {/* 如果没有items但有review_note,将其作为荣誉项显示 */}
                      {(!record.items || record.items.length === 0) && record.review_note && (
                        <div key={`${ri}-note`}>
                          {renderHonorItem({
                            title: '参加总监竞聘',
                            description: record.review_note,
                            score: null
                          }, `${ri}-note`)}
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* 门店调动弹窗 */}
      <Modal
        title={`门店调动 - ${selectedEmployee?.name}`}
        open={transferModalVisible}
        onOk={handleTransfer}
        onCancel={() => setTransferModalVisible(false)}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">当前门店：</Text>
            <Text strong>{selectedEmployee?.store_name}</Text>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">目标门店：</Text>
            <Select
              placeholder="选择目标门店"
              value={transferForm.to_store}
              onChange={v => setTransferForm({ ...transferForm, to_store: v })}
              style={{ width: '100%', marginTop: 8 }}
              showSearch
            >
              {stores.map(s => (
                <Select.Option key={s} value={s}>{s}</Select.Option>
              ))}
            </Select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary">调动日期：</Text>
            <DatePicker
              value={transferForm.transfer_date}
              onChange={date => setTransferForm({ ...transferForm, transfer_date: date })}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div>
            <Text type="secondary">调动原因：</Text>
            <Input.TextArea
              value={transferForm.reason}
              onChange={e => setTransferForm({ ...transferForm, reason: e.target.value })}
              placeholder="可选填写调动原因"
              rows={3}
              style={{ marginTop: 8 }}
            />
          </div>
        </div>
      </Modal>
    </div>
    </div>
  );
}

export default EmployeeBoard;

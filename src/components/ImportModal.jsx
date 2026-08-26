import React, { useState } from 'react';
import { Modal, Upload, Button, message, Table, Tag, Collapse, Space, Typography, Statistic, Row, Col, Alert, Spin, Tooltip } from 'antd';
import { UploadOutlined, CheckCircleOutlined, UserAddOutlined, FileExcelOutlined, FileWordOutlined } from '@ant-design/icons';
import api from '../api';

const { Text, Title } = Typography;
const { Panel } = Collapse;

function ImportModal({ visible, onCancel, onSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importId, setImportId] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleUpload = async (file) => {
    setUploading(true);
    setRecords([]);
    setStats(null);
    setImportId(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/api/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setImportId(res.data.importId);
      setRecords(res.data.records);
      setStats(res.data.stats);
      message.success(`解析成功！共识别 ${res.data.stats.totalItems} 条记录`);
    } catch (err) {
      message.error(err.response?.data?.error || '解析文件失败');
    } finally {
      setUploading(false);
    }
    return false; // prevent auto upload
  };

  const handleConfirm = async () => {
    if (!importId) return;
    setImporting(true);

    try {
      const res = await api.post('/api/import/confirm', { importId });
      message.success(res.data.message);
      handleClose();
      onSuccess && onSuccess();
    } catch (err) {
      message.error(err.response?.data?.error || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setImportId(null);
    setRecords([]);
    setStats(null);
    setFileName('');
    onCancel();
  };

  // 按门店-姓名分组显示
  const groupedByStoreAndName = {};
  records.forEach(r => {
    const storeKey = r.store;
    const nameKey = r.name;
    if (!groupedByStoreAndName[storeKey]) groupedByStoreAndName[storeKey] = {};
    if (!groupedByStoreAndName[storeKey][nameKey]) groupedByStoreAndName[storeKey][nameKey] = [];
    groupedByStoreAndName[storeKey][nameKey].push(r);
  });

  const columns = [
    {
      title: '月份',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      render: (month) => <Tag color="blue">{month}</Tag>
    },
    {
      title: '类型',
      key: 'types',
      width: 100,
      render: (_, record) => {
        const honorCount = record.items.filter(i => i.type === 'honor').length;
        const shameCount = record.items.filter(i => i.type === 'shame').length;
        return (
          <Space>
            {honorCount > 0 && <Tag color="green">荣 {honorCount}</Tag>}
            {shameCount > 0 && <Tag color="red">辱 {shameCount}</Tag>}
          </Space>
        );
      }
    },
    {
      title: '事项',
      key: 'items',
      render: (_, record) => (
        <div>
          {record.items.map((item, i) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <Tag color={item.type === 'honor' ? 'green' : 'red'} style={{ fontSize: 11 }}>
                {item.type === 'honor' ? '荣' : '辱'}
              </Tag>
              <Text style={{ fontSize: 13 }}>{item.title}</Text>
              {item.description && <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{item.description}</Text>}
            </div>
          ))}
        </div>
      )
    },
    {
      title: '匹配',
      key: 'match',
      width: 100,
      render: (_, record) => record.isNewEmployee
        ? <Tag color="orange" icon={<UserAddOutlined />}>新建</Tag>
        : <Tag color="green" icon={<CheckCircleOutlined />}>已匹配</Tag>
    }
  ];

  return (
    <Modal
      title="批量导入荣辱记录"
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={importId ? [
        <Button key="cancel" onClick={handleClose}>取消</Button>,
        <Button key="confirm" type="primary" onClick={handleConfirm} loading={importing}>
          确认导入 ({records.length} 条记录)
        </Button>
      ] : [<Button key="close" onClick={handleClose}>关闭</Button>]}
    >
      {!importId && !uploading && (
        <div>
          <Alert
            message="支持的文件格式"
            description="支持 .xlsx、.xls（Excel）和 .docx（Word）格式。系统会自动解析文件中的员工姓名、门店、月份和奖惩事项，按「门店-姓名-月份」分类导入。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Upload.Dragger
            accept=".xlsx,.xls,.docx"
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={uploading}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: 48, color: '#1890ff' }} />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持 Excel (.xlsx/.xls) 和 Word (.docx) 文件，系统自动识别内容并按门店-姓名-月份分类
            </p>
          </Upload.Dragger>
        </div>
      )}

      {uploading && (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text>正在解析文件「{fileName}」...</Text>
          </div>
        </div>
      )}

      {importId && stats && (
        <div>
          <Alert
            message={`文件「${fileName}」解析完成`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Statistic title="解析记录" value={stats.totalRecords} suffix="条" />
            </Col>
            <Col span={6}>
              <Statistic title="明细条目" value={stats.totalItems} suffix="条" />
            </Col>
            <Col span={6}>
              <Statistic title="已匹配员工" value={stats.matchedEmployees} suffix="人" valueStyle={{ color: '#3f8600' }} />
            </Col>
            <Col span={6}>
              <Statistic title="需新建员工" value={stats.newEmployees} suffix="人" valueStyle={{ color: stats.newEmployees > 0 ? '#cf1322' : undefined }} />
            </Col>
          </Row>

          {stats.stores && (
            <div style={{ marginBottom: 16 }}>
              <Text strong>涉及门店：</Text>
              {stats.stores.map(s => <Tag key={s} color="cyan">{s}</Tag>)}
            </div>
          )}

          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            <Collapse defaultActiveKey={Object.keys(groupedByStoreAndName)}>
              {Object.entries(groupedByStoreAndName).map(([store, names]) => (
                <Panel header={<Text strong>{store} ({Object.keys(names).length}人)</Text>} key={store}>
                  {Object.entries(names).map(([name, recs]) => (
                    <div key={`${store}-${name}`} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                        <Text strong style={{ fontSize: 14 }}>{name}</Text>
                        {recs[0].idCard && <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>{recs[0].idCard}</Text>}
                        {recs[0].isNewEmployee && <Tag color="orange" style={{ marginLeft: 8 }}>新员工</Tag>}
                        <Text type="secondary" style={{ marginLeft: 'auto', fontSize: 12 }}>{recs.length}个月份</Text>
                      </div>
                      <Table
                        columns={columns}
                        dataSource={recs}
                        rowKey={(r) => `${r.store}-${r.name}-${r.month}`}
                        size="small"
                        pagination={false}
                      />
                    </div>
                  ))}
                </Panel>
              ))}
            </Collapse>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default ImportModal;

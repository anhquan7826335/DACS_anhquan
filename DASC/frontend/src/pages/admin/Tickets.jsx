import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Select, Space, Button, message, Image } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Title, Paragraph } = Typography;

const severityColor = { LOW: 'blue', MEDIUM: 'orange', HIGH: 'red' };
const severityLabel = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Khẩn cấp' };
const statusColor = { PENDING: 'default', IN_PROGRESS: 'processing', RESOLVED: 'success' };
const statusLabel = { PENDING: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý' };

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [severity, setSeverity] = useState();
  const [status, setStatus] = useState();

  async function fetchTickets() {
    setLoading(true);
    try {
      const { data } = await api.get('/tickets', { params: { severity, status } });
      setTickets(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách sự cố.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTickets(); }, [severity, status]);

  async function handleUpdateStatus(id, newStatus) {
    try {
      await api.put(`/tickets/${id}`, { status: newStatus });
      message.success('Đã cập nhật trạng thái.');
      fetchTickets();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật.');
    }
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Khách báo cáo', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: 'Tiêu đề', dataIndex: 'title', key: 'title' },
    {
      title: 'Mô tả', dataIndex: 'description', key: 'description',
      render: (v) => <Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0, maxWidth: 260 }}>{v}</Paragraph>,
    },
    {
      title: 'Ảnh', dataIndex: 'image_url', key: 'image_url',
      render: (v) => v ? <Image src={v} width={60} /> : '-',
    },
    {
      title: 'Mức độ', dataIndex: 'severity', key: 'severity',
      render: (v) => <Tag color={severityColor[v]}>{severityLabel[v]}</Tag>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v, r) => (
        <Select
          size="small"
          value={v}
          style={{ width: 130 }}
          onChange={(val) => handleUpdateStatus(r.id, val)}
          options={Object.keys(statusLabel).map((k) => ({ value: k, label: statusLabel[k] }))}
        />
      ),
    },
    { title: 'Thời gian', dataIndex: 'created_at', key: 'created_at' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Báo cáo Sự cố</Title>
        <Space>
          <Select
            placeholder="Lọc mức độ"
            allowClear
            style={{ width: 150 }}
            value={severity}
            onChange={setSeverity}
            options={Object.keys(severityLabel).map((k) => ({ value: k, label: severityLabel[k] }))}
          />
          <Select
            placeholder="Lọc trạng thái"
            allowClear
            style={{ width: 150 }}
            value={status}
            onChange={setStatus}
            options={Object.keys(statusLabel).map((k) => ({ value: k, label: statusLabel[k] }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchTickets}>Làm mới</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={tickets} loading={loading} bordered scroll={{ x: 1000 }} />
    </div>
  );
}

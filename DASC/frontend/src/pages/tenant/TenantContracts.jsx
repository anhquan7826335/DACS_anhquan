import { useEffect, useState } from 'react';
import { Button, Empty, message, Popconfirm, Table, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import { contractStatus, fmtDate, rentalTypeLabel, vnd } from '../../utils/format';

const { Title, Paragraph } = Typography;

export default function TenantContracts() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const { data } = await api.get('/contracts/mine');
      setRows(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải hợp đồng.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchData(); }, []);

  async function cancel(id) {
    try {
      await api.put(`/contracts/${id}/cancel`);
      message.success('Đã hủy yêu cầu.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể hủy yêu cầu.');
    }
    fetchData();
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room', render: (v) => <b>{v}</b> },
    { title: 'Hình thức', dataIndex: 'rental_type', key: 'type', render: (v) => <Tag color={v === 'DAILY' ? 'cyan' : 'blue'}>{rentalTypeLabel[v]}</Tag> },
    { title: 'Thời gian thuê', key: 'range', render: (_, r) => `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}` },
    { title: 'Đơn giá', key: 'fee', render: (_, r) => (r.rental_type === 'DAILY' ? `${vnd(r.daily_fee)}/ngày` : `${vnd(r.monthly_fee)}/tháng`) },
    { title: 'Tiền cọc', dataIndex: 'deposit', key: 'deposit', render: (v) => vnd(v) },
    { title: 'Dự kiến tiền phòng', dataIndex: 'estimated_total', key: 'total', render: (v) => <b>{vnd(v)}</b> },
    { title: 'Trạng thái', dataIndex: 'status', key: 'status', render: (v) => <Tag color={contractStatus[v]?.color}>{contractStatus[v]?.label || v}</Tag> },
    { title: 'Ghi chú của chủ trọ', dataIndex: 'admin_note', key: 'note', render: (v) => v || '-' },
    {
      title: '', key: 'action',
      render: (_, r) => r.status === 'PENDING' && (
        <Popconfirm title="Hủy yêu cầu thuê phòng này?" okText="Hủy yêu cầu" cancelText="Giữ lại" onConfirm={() => cancel(r.id)}>
          <Button size="small" danger>Hủy yêu cầu</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Hợp đồng của tôi</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
      </div>
      <Paragraph type="secondary">
        Gồm các yêu cầu thuê đang chờ duyệt và hợp đồng đã có hiệu lực. Muốn thuê thêm phòng, vào <Link to="/tenant/rooms">Thuê phòng</Link>.
      </Paragraph>
      {rows.length === 0 && !loading ? (
        <Empty description="Bạn chưa có hợp đồng hoặc yêu cầu thuê nào." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} bordered scroll={{ x: 1100 }} />
      )}
    </div>
  );
}

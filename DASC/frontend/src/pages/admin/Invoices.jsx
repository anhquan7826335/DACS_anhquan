import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Select, Space, Button, message, Popconfirm } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Title } = Typography;

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data } = await api.get('/invoices/admin', { params: { status } });
      setInvoices(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách hóa đơn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInvoices(); }, [status]);

  async function handleMarkPaid(id) {
    try {
      await api.put(`/invoices/${id}/pay`);
      message.success('Đã đánh dấu hóa đơn Đã thanh toán.');
      fetchInvoices();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật hóa đơn.');
    }
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Khách thuê', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: 'Kỳ', key: 'period', render: (_, r) => `${r.month}/${r.year}` },
    { title: 'Điện (kWh)', key: 'elec', render: (_, r) => `${r.old_electricity} → ${r.new_electricity}` },
    { title: 'Nước (m³)', key: 'water', render: (_, r) => `${r.old_water} → ${r.new_water}` },
    { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (v) => <b>{v.toLocaleString('vi-VN')} đ</b> },
    { title: 'Hạn thanh toán', dataIndex: 'due_date', key: 'due_date' },
    {
      title: 'Trạng thái', dataIndex: 'payment_status', key: 'payment_status',
      render: (v) => <Tag color={v === 'PAID' ? 'green' : 'red'}>{v === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Tag>,
    },
    { title: 'Số lần nhắc nợ', dataIndex: 'reminder_count', key: 'reminder_count', align: 'center' },
    {
      title: '', key: 'action',
      render: (_, r) => r.payment_status === 'UNPAID' && (
        <Popconfirm title="Xác nhận khách đã thanh toán?" onConfirm={() => handleMarkPaid(r.id)} okText="Xác nhận" cancelText="Hủy">
          <Button size="small" type="primary">Đánh dấu đã trả</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý Hóa đơn</Title>
        <Space>
          <Select
            placeholder="Lọc trạng thái"
            allowClear
            style={{ width: 180 }}
            value={status}
            onChange={setStatus}
            options={[
              { value: 'UNPAID', label: 'Chưa thanh toán' },
              { value: 'PAID', label: 'Đã thanh toán' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchInvoices}>Làm mới</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={invoices} loading={loading} bordered scroll={{ x: 1000 }} />
    </div>
  );
}

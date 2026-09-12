import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Modal, message, Empty } from 'antd';
import { QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Title, Text } = Typography;

export default function TenantHome() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState(null);

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data } = await api.get('/invoices/tenant');
      setInvoices(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách hóa đơn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInvoices(); }, []);

  const columns = [
    { title: 'Kỳ', key: 'period', render: (_, r) => `${r.month}/${r.year}` },
    { title: 'Điện (kWh)', key: 'elec', render: (_, r) => `${r.old_electricity} → ${r.new_electricity}` },
    { title: 'Nước (m³)', key: 'water', render: (_, r) => `${r.old_water} → ${r.new_water}` },
    { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (v) => <b>{v.toLocaleString('vi-VN')} đ</b> },
    { title: 'Hạn thanh toán', dataIndex: 'due_date', key: 'due_date' },
    {
      title: 'Trạng thái', dataIndex: 'payment_status', key: 'payment_status',
      render: (v) => <Tag color={v === 'PAID' ? 'green' : 'red'}>{v === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Tag>,
    },
    {
      title: '', key: 'action',
      render: (_, r) => r.payment_status === 'UNPAID' && (
        <Button type="primary" icon={<QrcodeOutlined />} onClick={() => setQrModal(r)}>
          Thanh toán ngay
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Hóa đơn của tôi</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchInvoices}>Làm mới</Button>
      </div>

      {invoices.length === 0 && !loading ? (
        <Empty description="Bạn chưa có hóa đơn nào." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={invoices} loading={loading} bordered scroll={{ x: 800 }} />
      )}

      <Modal
        title={`Thanh toán hóa đơn kỳ ${qrModal?.month}/${qrModal?.year}`}
        open={!!qrModal}
        onCancel={() => setQrModal(null)}
        footer={<Button onClick={() => setQrModal(null)}>Đóng</Button>}
      >
        {qrModal && (
          <div style={{ textAlign: 'center' }}>
            <p>Quét mã QR bằng App Ngân hàng để thanh toán tự động</p>
            <img src={qrModal.qr_url} alt="VietQR" style={{ width: 260, marginBottom: 12 }} />
            <p><Text type="secondary">Số tiền:</Text> <b>{qrModal.total_amount.toLocaleString('vi-VN')} đ</b></p>
            <p><Text type="secondary">Nội dung chuyển khoản:</Text> <b>{qrModal.transfer_content}</b></p>
            <Text type="warning">
              Lưu ý: giữ nguyên nội dung chuyển khoản để hệ thống tự động ghi nhận thanh toán.
            </Text>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Table, Tag, Typography, Button, Modal, message, Empty, DatePicker, Space } from 'antd';
import { DownloadOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../api/axios';
import { vnd, fmtDate, downloadFile } from '../../utils/format';

const { Title, Text } = Typography;

export default function TenantHome() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [range, setRange] = useState(null); // [dayjs, dayjs] theo tháng

  const rangeParams = () => (range?.[0] && range?.[1]
    ? { from: range[0].format('YYYY-MM'), to: range[1].format('YYYY-MM') } : {});

  async function exportXlsx() {
    try {
      await downloadFile(api, '/invoices/tenant/export', rangeParams(), 'hoa-don.xlsx');
    } catch {
      message.error('Không xuất được file Excel.');
    }
  }

  async function fetchInvoices() {
    setLoading(true);
    try {
      const { data } = await api.get('/invoices/tenant', { params: rangeParams() });
      setInvoices(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách hóa đơn.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchInvoices(); }, [range]);

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room' },
    { title: 'Kỳ', key: 'period', render: (_, r) => `${r.month}/${r.year}` },
    { title: 'Tiền phòng', dataIndex: 'room_fee', key: 'room_fee', render: (v) => vnd(v) },
    { title: 'Tiền điện', dataIndex: 'electricity', key: 'electricity', render: (v) => vnd(v) },
    { title: 'Tiền nước', dataIndex: 'water', key: 'water', render: (v) => vnd(v) },
    { title: 'Phụ phí', dataIndex: 'other_fee', key: 'other_fee', render: (v) => vnd(v) },
    { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (v) => <b>{vnd(v)}</b> },
    { title: 'Hạn thanh toán', dataIndex: 'due_date', key: 'due_date', render: (v) => fmtDate(v) },
    {
      title: 'Trạng thái', dataIndex: 'payment_status', key: 'payment_status',
      render: (v, r) => (
        <span>
          <Tag color={v === 'PAID' ? 'green' : 'red'}>{v === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Tag>
          {r.paid_at && <div style={{ fontSize: 12, color: '#888' }}>{r.paid_at.slice(0, 16)}</div>}
        </span>
      ),
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Hóa đơn của tôi</Title>
        <Space wrap>
          <DatePicker.RangePicker picker="month" value={range} onChange={setRange} format="MM/YYYY" placeholder={['Từ tháng', 'Đến tháng']} />
          <Button icon={<ReloadOutlined />} onClick={fetchInvoices}>Làm mới</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportXlsx} disabled={invoices.length === 0}>Xuất Excel</Button>
        </Space>
      </div>

      {invoices.length === 0 && !loading ? (
        <Empty description="Bạn chưa có hóa đơn nào." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={invoices} loading={loading} bordered scroll={{ x: 1100 }} />
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
            <p><Text type="secondary">Số tiền:</Text> <b>{vnd(qrModal.total_amount)}</b></p>
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

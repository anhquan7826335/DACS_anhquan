import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Select, Space, Button, message, Popconfirm, Modal, Form, InputNumber,
  DatePicker, Alert, Descriptions,
} from 'antd';
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';
import CreateInvoiceModal from '../../components/CreateInvoiceModal';
import { vnd, fmtDate, moneyInputProps } from '../../utils/format';

const { Title } = Typography;

/** Phần thân form sửa hóa đơn — chỉ được mount khi modal mở nên form luôn luôn khởi tạo từ hóa đơn đang sửa. */
function EditInvoiceForm({ invoice, form, onSubmit }) {
  const status = Form.useWatch('payment_status', form);
  const roomFee = Form.useWatch('room_fee', form);
  const electricity = Form.useWatch('electricity', form);
  const water = Form.useWatch('water', form);
  const otherFee = Form.useWatch('other_fee', form);

  // Hóa đơn đã thanh toán: khóa số tiền cho tới khi chuyển về "Chưa thanh toán"
  const locked = invoice.payment_status === 'PAID' && status === 'PAID';
  const total = Number(roomFee || 0) + Number(electricity || 0) + Number(water || 0) + Number(otherFee || 0);

  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={(values) => onSubmit(values, locked)}
      initialValues={{
        room_fee: Number(invoice.room_fee),
        electricity: Number(invoice.electricity),
        water: Number(invoice.water),
        other_fee: Number(invoice.other_fee || 0),
        due_date: dayjs(invoice.due_date),
        payment_status: invoice.payment_status,
      }}
    >
      <Form.Item name="payment_status" label="Trạng thái thanh toán">
        <Select options={[
          { value: 'UNPAID', label: 'Chưa thanh toán' },
          { value: 'PAID', label: 'Đã thanh toán' },
        ]} />
      </Form.Item>
      {locked && (
        <Alert
          type="info" showIcon style={{ marginBottom: 12 }}
          message="Hóa đơn đã thanh toán nên khóa số tiền. Chuyển về “Chưa thanh toán” nếu cần sửa."
        />
      )}
      <Form.Item name="room_fee" label="Tiền phòng (đ)" rules={[{ required: true, message: 'Nhập tiền phòng' }]}>
        <InputNumber {...moneyInputProps} disabled={locked} />
      </Form.Item>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        <Form.Item name="electricity" label="Tiền điện (đ)" rules={[{ required: true, message: 'Nhập tiền điện' }]} style={{ flex: '1 1 200px' }}>
          <InputNumber {...moneyInputProps} disabled={locked} />
        </Form.Item>
        <Form.Item name="water" label="Tiền nước (đ)" rules={[{ required: true, message: 'Nhập tiền nước' }]} style={{ flex: '1 1 200px' }}>
          <InputNumber {...moneyInputProps} disabled={locked} />
        </Form.Item>
      </div>
      <Form.Item name="other_fee" label="Phụ phí khác (đ)">
        <InputNumber {...moneyInputProps} disabled={locked} />
      </Form.Item>
      <Form.Item name="due_date" label="Hạn thanh toán" rules={[{ required: true, message: 'Chọn hạn thanh toán' }]}>
        <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} disabled={locked} />
      </Form.Item>
      <Descriptions size="small" bordered column={1}>
        <Descriptions.Item label="Tổng mới">
          <b style={{ color: '#1d4ed8' }}>{vnd(total)}</b>
        </Descriptions.Item>
      </Descriptions>
    </Form>
  );
}

/** Sửa hóa đơn: tiền phòng/điện/nước/phụ phí (VNĐ), hạn thanh toán, trạng thái. Tổng được server tính lại. */
function EditInvoiceModal({ invoice, onClose, onSaved }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  async function handleSubmit(values, locked) {
    if (locked) { onClose(); return; } // đã thanh toán và giữ nguyên -> không có gì thay đổi
    setSaving(true);
    try {
      await api.put(`/invoices/${invoice.id}`, {
        room_fee: values.room_fee,
        electricity: values.electricity,
        water: values.water,
        other_fee: values.other_fee || 0,
        due_date: values.due_date.format('YYYY-MM-DD'),
        payment_status: values.payment_status,
      });
      message.success('Đã cập nhật hóa đơn.');
      onSaved();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật hóa đơn.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={invoice ? `Sửa hóa đơn — Phòng ${invoice.room_number}, kỳ ${invoice.month}/${invoice.year}` : ''}
      open={!!invoice}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      destroyOnClose
    >
      {invoice && <EditInvoiceForm invoice={invoice} form={form} onSubmit={handleSubmit} />}
    </Modal>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const [createOpen, setCreateOpen] = useState(false);
  const [contracts, setContracts] = useState([]);
  const [editing, setEditing] = useState(null);

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

  async function openCreate() {
    try {
      const { data } = await api.get('/contracts', { params: { status: 'ACTIVE' } });
      setContracts(data);
      setCreateOpen(true);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không tải được danh sách hợp đồng.');
    }
  }

  async function handleMarkPaid(id) {
    try {
      await api.put(`/invoices/${id}/pay`);
      message.success('Đã đánh dấu hóa đơn Đã thanh toán.');
      fetchInvoices();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật hóa đơn.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/invoices/${id}`);
      message.success('Đã xóa hóa đơn.');
      fetchInvoices();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa hóa đơn.');
    }
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Khách thuê', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: 'Kỳ', key: 'period', render: (_, r) => `${r.month}/${r.year}` },
    { title: 'Tiền phòng', dataIndex: 'room_fee', key: 'room_fee', render: (v) => vnd(v) },
    { title: 'Tiền điện', dataIndex: 'electricity', key: 'electricity', render: (v) => vnd(v) },
    { title: 'Tiền nước', dataIndex: 'water', key: 'water', render: (v) => vnd(v) },
    { title: 'Phụ phí', dataIndex: 'other_fee', key: 'other_fee', render: (v) => vnd(v) },
    { title: 'Tổng tiền', dataIndex: 'total_amount', key: 'total_amount', render: (v) => <b>{vnd(v)}</b> },
    { title: 'Hạn thanh toán', dataIndex: 'due_date', key: 'due_date', render: (v) => fmtDate(v) },
    {
      title: 'Trạng thái', dataIndex: 'payment_status', key: 'payment_status',
      render: (v) => <Tag color={v === 'PAID' ? 'green' : 'red'}>{v === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}</Tag>,
    },
    { title: 'Số lần nhắc nợ', dataIndex: 'reminder_count', key: 'reminder_count', align: 'center' },
    {
      title: '', key: 'action', fixed: 'right', width: 250,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.payment_status === 'UNPAID' && (
            <Popconfirm title="Xác nhận khách đã thanh toán?" onConfirm={() => handleMarkPaid(r.id)} okText="Xác nhận" cancelText="Hủy">
              <Button size="small" type="primary">Đã trả</Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Sửa</Button>
          <Popconfirm
            title="Xóa hóa đơn này?"
            description={r.payment_status === 'PAID' ? 'Hóa đơn đã thanh toán — xóa sẽ mất lịch sử thu tiền.' : 'Không thể hoàn tác.'}
            onConfirm={() => handleDelete(r.id)}
            okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý Hóa đơn</Title>
        <Space wrap>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo hóa đơn</Button>
        </Space>
      </div>

      <Table rowKey="id" columns={columns} dataSource={invoices} loading={loading} bordered scroll={{ x: 1500 }} />

      <CreateInvoiceModal
        open={createOpen}
        contracts={contracts}
        onClose={() => setCreateOpen(false)}
        onSuccess={fetchInvoices}
      />
      <EditInvoiceModal
        invoice={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); fetchInvoices(); }}
      />
    </div>
  );
}

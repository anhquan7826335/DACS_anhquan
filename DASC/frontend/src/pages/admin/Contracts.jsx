import { useEffect, useMemo, useState } from 'react';
import {
  Table, Tag, Typography, Select, Space, Button, Input, message, Popconfirm, Modal, Form, InputNumber,
  DatePicker, Alert,
} from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined, EditOutlined, DeleteOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';
import CreateContractModal from '../../components/CreateContractModal';
import { contractStatus, fmtDate, moneyInputProps, rentalTypeLabel, vnd } from '../../utils/format';

const { Title } = Typography;

/** Form sửa hợp đồng — chỉ mount khi modal mở. Không đổi phòng/khách/loại hợp đồng. */
function EditContractForm({ contract, form, onSubmit }) {
  const isDaily = contract.rental_type === 'DAILY';
  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={onSubmit}
      initialValues={{
        deposit: Number(contract.deposit),
        range: [dayjs(contract.start_date), dayjs(contract.end_date)],
        daily_fee: Number(contract.daily_fee),
        monthly_fee: Number(contract.monthly_fee),
      }}
    >
      <Alert
        type="info" showIcon style={{ marginBottom: 12 }}
        message={`Phòng ${contract.room_number} — ${contract.tenant_name} (${isDaily ? 'thuê ngày' : 'thuê tháng'}). Số điện thoại thuộc hồ sơ khách (sửa ở mục Người dùng). Muốn đổi phòng hoặc khách, hãy thanh lý rồi tạo hợp đồng mới.`}
      />
      <Form.Item name="range" label="Thời hạn thuê" rules={[{ required: true, message: 'Chọn thời hạn thuê' }]}>
        <DatePicker.RangePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="deposit" label="Tiền cọc (đ)" rules={[{ required: true, message: 'Nhập tiền cọc' }]}>
        <InputNumber {...moneyInputProps} />
      </Form.Item>
      {isDaily ? (
        <Form.Item name="daily_fee" label="Đơn giá thuê ngày (đ/ngày)" rules={[{ required: true, message: 'Nhập đơn giá ngày' }]}>
          <InputNumber {...moneyInputProps} />
        </Form.Item>
      ) : (
        <Form.Item name="monthly_fee" label="Tiền thuê / tháng (đ)" rules={[{ required: true, message: 'Nhập tiền thuê tháng' }]}>
          <InputNumber {...moneyInputProps} />
        </Form.Item>
      )}
    </Form>
  );
}

export default function Contracts() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState();
  const [type, setType] = useState();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [approving, setApproving] = useState(null);
  const [deposit, setDeposit] = useState(0);
  const [rejecting, setRejecting] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [form] = Form.useForm();

  async function fetchContracts() {
    setLoading(true);
    try {
      const { data } = await api.get('/contracts', { params: { status } });
      setContracts(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchContracts(); }, [status]);

  const rows = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return contracts.filter((c) => (!type || c.rental_type === type)
      && (!kw || `${c.room_number} ${c.tenant_name} ${c.tenant_phone}`.toLowerCase().includes(kw)));
  }, [contracts, type, search]);

  async function handleSave(values) {
    setSaving(true);
    try {
      const body = {
        deposit: values.deposit,
        start_date: values.range[0].format('YYYY-MM-DD'),
        end_date: values.range[1].format('YYYY-MM-DD'),
      };
      if (editing.rental_type === 'DAILY') body.daily_fee = values.daily_fee;
      else body.monthly_fee = values.monthly_fee;
      await api.put(`/contracts/${editing.id}`, body);
      message.success('Đã cập nhật hợp đồng.');
      setEditing(null);
      fetchContracts();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật hợp đồng.');
    } finally {
      setSaving(false);
    }
  }

  async function handleApprove() {
    try {
      await api.put(`/contracts/${approving.id}/approve`, { deposit });
      message.success('Đã duyệt yêu cầu, hợp đồng có hiệu lực.');
      setApproving(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể duyệt yêu cầu.');
    }
    fetchContracts();
  }

  async function handleReject() {
    try {
      await api.put(`/contracts/${rejecting.id}/reject`, { admin_note: rejectNote });
      message.success('Đã từ chối yêu cầu.');
      setRejecting(null);
      setRejectNote('');
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể từ chối yêu cầu.');
    }
    fetchContracts();
  }

  async function handleTerminate(id) {
    try {
      await api.put(`/contracts/${id}/terminate`);
      message.success('Đã thanh lý hợp đồng, phòng chuyển về Trống.');
      fetchContracts();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể thanh lý hợp đồng.');
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/contracts/${id}`);
      message.success('Đã xóa hợp đồng.');
      fetchContracts();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa hợp đồng.');
    }
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Khách thuê', dataIndex: 'tenant_name', key: 'tenant_name' },
    { title: 'Số điện thoại', dataIndex: 'tenant_phone', key: 'tenant_phone' },
    {
      title: 'Loại', dataIndex: 'rental_type', key: 'rental_type',
      render: (v) => <Tag color={v === 'DAILY' ? 'cyan' : 'blue'}>{rentalTypeLabel[v]}</Tag>,
    },
    { title: 'Bắt đầu', dataIndex: 'start_date', key: 'start_date', render: (v) => fmtDate(v) },
    { title: 'Kết thúc', dataIndex: 'end_date', key: 'end_date', render: (v) => fmtDate(v) },
    { title: 'Tiền cọc', dataIndex: 'deposit', key: 'deposit', render: (v) => vnd(v) },
    {
      title: 'Đơn giá', key: 'fee',
      render: (_, r) => (r.rental_type === 'DAILY' ? `${vnd(r.daily_fee)}/ngày` : `${vnd(r.monthly_fee)}/tháng`),
    },
    { title: 'Dự kiến', dataIndex: 'estimated_total', key: 'estimated_total', render: (v) => vnd(v) },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v, r) => (
        <span><Tag color={contractStatus[v]?.color}>{contractStatus[v]?.label || v}</Tag>{r.admin_note && v !== 'ACTIVE' && <div style={{ fontSize: 12, color: '#888' }}>{r.admin_note}</div>}</span>
      ),
    },
    {
      title: '', key: 'action', fixed: 'right', width: 320,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.status === 'PENDING' && (
            <>
              <Button size="small" type="primary" onClick={() => { setApproving(r); setDeposit(Number(r.deposit) || (r.rental_type === 'MONTHLY' ? Number(r.monthly_fee) : 0)); }}>Duyệt</Button>
              <Button size="small" danger onClick={() => { setRejecting(r); setRejectNote(''); }}>Từ chối</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Sửa</Button>
            </>
          )}
          {r.status === 'ACTIVE' && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Sửa</Button>
              <Popconfirm
                title={`Thanh lý hợp đồng phòng ${r.room_number}?`}
                description="Hợp đồng kết thúc và phòng trở về trạng thái Trống."
                onConfirm={() => handleTerminate(r.id)}
                okText="Thanh lý" cancelText="Hủy"
              >
                <Button size="small" icon={<StopOutlined />}>Thanh lý</Button>
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="Xóa hợp đồng này?"
            description={r.status === 'ACTIVE'
              ? 'Hợp đồng đang hiệu lực: phòng sẽ trở về Trống. Hợp đồng đã có hóa đơn không thể xóa.'
              : 'Hợp đồng đã có hóa đơn không thể xóa. Không thể hoàn tác.'}
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
        <Title level={3} style={{ margin: 0 }}>Quản lý Hợp đồng</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchContracts}>Làm mới</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Tạo hợp đồng</Button>
        </Space>
      </div>

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input
          placeholder="Tìm theo phòng, tên, số điện thoại"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Trạng thái" allowClear style={{ width: 170 }} value={status} onChange={setStatus}
          options={Object.entries(contractStatus).map(([value, v]) => ({ value, label: v.label }))}
        />
        <Select
          placeholder="Loại hợp đồng" allowClear style={{ width: 170 }} value={type} onChange={setType}
          options={[{ value: 'MONTHLY', label: 'Thuê tháng' }, { value: 'DAILY', label: 'Thuê ngày' }]}
        />
      </Space>

      <CreateContractModal
        open={creating}
        onClose={() => setCreating(false)}
        onSuccess={() => { setCreating(false); fetchContracts(); }}
      />

      <Table rowKey="id" columns={columns} dataSource={rows} loading={loading} bordered scroll={{ x: 1500 }} />

      <Modal
        title={approving ? `Duyệt yêu cầu — Phòng ${approving.room_number}` : ''}
        open={!!approving} onCancel={() => setApproving(null)} onOk={handleApprove} okText="Duyệt" cancelText="Hủy"
      >
        {approving && (
          <div>
            <p><b>{approving.tenant_name}</b> thuê {rentalTypeLabel[approving.rental_type].toLowerCase()}: {fmtDate(approving.start_date)} → {fmtDate(approving.end_date)}</p>
            <div style={{ marginBottom: 4 }}>Tiền cọc (đ)</div>
            <InputNumber {...moneyInputProps} value={deposit} onChange={(v) => setDeposit(v || 0)} />
            <p style={{ marginTop: 12, color: '#888' }}>Phòng sẽ chuyển sang Đang thuê và các yêu cầu còn lại của phòng này tự động bị từ chối.</p>
          </div>
        )}
      </Modal>
      <Modal
        title={rejecting ? `Từ chối yêu cầu của ${rejecting.tenant_name}` : ''}
        open={!!rejecting} onCancel={() => setRejecting(null)} onOk={handleReject}
        okText="Từ chối" okButtonProps={{ danger: true }} cancelText="Hủy"
      >
        <div style={{ marginBottom: 8 }}>Lý do (không bắt buộc, khách sẽ nhìn thấy):</div>
        <Input.TextArea rows={3} maxLength={255} showCount value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
      </Modal>

      <Modal
        title={editing ? `Sửa hợp đồng — Phòng ${editing.room_number}` : ''}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnClose
      >
        {editing && <EditContractForm contract={editing} form={form} onSubmit={handleSave} />}
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Space, Modal, Form, InputNumber, message, Typography, Select, Image, Upload, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, HomeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { vnd, moneyInputProps } from '../../utils/format';

const { Title } = Typography;

const statusColor = { EMPTY: 'default', RENTED: 'green', MAINTENANCE: 'orange' };
const statusLabel = { EMPTY: 'Trống', RENTED: 'Đang thuê', MAINTENANCE: 'Bảo trì' };

/** Form sửa phòng — chỉ mount khi modal mở. Phòng đang thuê không đổi được trạng thái (phải thanh lý hợp đồng). */
function EditRoomForm({ room, form, onSubmit }) {
  const rented = room.status === 'RENTED';
  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={onSubmit}
      initialValues={{
        room_number: room.room_number,
        floor: room.floor,
        price: Number(room.price),
        daily_price: room.daily_price != null ? Number(room.daily_price) : undefined,
        area: room.area ?? undefined,
        description: room.description || '',
        status: room.status,
      }}
    >
      <Form.Item name="room_number" label="Số phòng" rules={[{ required: true, whitespace: true, message: 'Nhập số phòng' }]}>
        <Input maxLength={20} />
      </Form.Item>
      <Form.Item name="floor" label="Tầng" rules={[{ required: true, message: 'Nhập tầng' }]}>
        <InputNumber min={0} precision={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item name="price" label="Giá phòng / tháng (đ)" rules={[{ required: true, message: 'Nhập giá phòng' }]}>
        <InputNumber {...moneyInputProps} min={1} />
      </Form.Item>
      <Form.Item name="daily_price" label="Giá thuê ngày (đ) — để trống = giá tháng / 30">
        <InputNumber {...moneyInputProps} />
      </Form.Item>
      <Form.Item name="area" label="Diện tích (m²)">
        <InputNumber min={0} style={{ width: '100%' }} />
      </Form.Item>
      <Form.Item
        name="status" label="Trạng thái"
        extra={rented ? 'Phòng đang có người thuê — thanh lý hợp đồng ở trang chi tiết để đổi trạng thái.' : 'Đang thuê chỉ được tạo qua hợp đồng hoặc khi duyệt yêu cầu thuê.'}
      >
        <Select
          disabled={rented}
          options={rented
            ? [{ value: 'RENTED', label: 'Đang thuê' }]
            : [{ value: 'EMPTY', label: 'Trống' }, { value: 'MAINTENANCE', label: 'Bảo trì' }]}
        />
      </Form.Item>
      <Form.Item name="description" label="Mô tả">
        <Input.TextArea rows={2} />
      </Form.Item>
    </Form>
  );
}

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState();
  const [modalOpen, setModalOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const navigate = useNavigate();

  async function fetchRooms() {
    setLoading(true);
    try {
      const { data } = await api.get('/rooms', { params: { search: search || undefined, status } });
      setRooms(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách phòng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRooms(); }, [status]);

  async function handleCreate(values) {
    setCreating(true);
    try {
      const { data } = await api.post('/rooms', values);
      const file = fileList[0]?.originFileObj;
      if (file) {
        try {
          const body = new FormData();
          body.append('image', file);
          await api.post(`/rooms/${data.id}/image`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (err) {
          message.warning(err.response?.data?.message || 'Đã tạo phòng nhưng chưa tải được ảnh, hãy thử lại trong trang chi tiết.');
        }
      }
      message.success('Tạo phòng thành công.');
      setModalOpen(false);
      form.resetFields();
      setFileList([]);
      fetchRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo phòng.');
    } finally {
      setCreating(false);
    }
  }

  async function handleEdit(values) {
    setSaving(true);
    try {
      const body = {
        room_number: values.room_number,
        floor: values.floor,
        price: values.price,
        daily_price: values.daily_price ?? null,
        area: values.area ?? null,
        description: values.description || null,
      };
      if (editing.status !== 'RENTED') body.status = values.status;
      await api.put(`/rooms/${editing.id}`, body);
      message.success('Đã cập nhật phòng.');
      setEditing(null);
      fetchRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật phòng.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/rooms/${id}`);
      message.success('Đã xóa phòng.');
      fetchRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa phòng.');
    }
  }

  const columns = [
    {
      title: 'Ảnh', dataIndex: 'image_url', key: 'image_url', width: 80,
      render: (v) => v
        ? <Image src={v} width={56} height={56} style={{ objectFit: 'cover', borderRadius: 6 }} />
        : <div style={{ width: 56, height: 56, borderRadius: 6, background: '#f0f2f5', color: '#bfbfbf', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><HomeOutlined /></div>,
    },
    { title: 'Số phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Tầng', dataIndex: 'floor', key: 'floor', width: 80 },
    { title: 'Giá phòng', dataIndex: 'price', key: 'price', render: (v) => vnd(v) },
    { title: 'Diện tích', dataIndex: 'area', key: 'area', render: (v) => (v ? `${v} m²` : '-') },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v, r) => (
        <Space size={4} wrap>
          <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>
          {r.pending_requests > 0 && <Tag color="gold">{r.pending_requests} yêu cầu thuê chờ duyệt</Tag>}
        </Space>
      ),
    },
    { title: 'Khách thuê hiện tại', dataIndex: 'tenant_name', key: 'tenant_name', render: (v) => v || '-' },
    {
      title: '', key: 'action', fixed: 'right', width: 280,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button type="link" style={{ paddingInline: 4 }} onClick={() => navigate(`/admin/rooms/${record.id}`)}>
            {record.pending_requests > 0 ? 'Xem yêu cầu →' : 'Chi tiết →'}
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(record)}>Sửa</Button>
          <Popconfirm
            title={`Xóa phòng ${record.room_number}?`}
            description="Các yêu cầu thuê và sự cố của phòng cũng bị xóa. Phòng đã từng có hợp đồng không thể xóa."
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy"
            disabled={record.status === 'RENTED'}
          >
            <Tooltip title={record.status === 'RENTED' ? 'Phòng đang có người thuê' : ''}>
              <Button size="small" danger icon={<DeleteOutlined />} disabled={record.status === 'RENTED'}>Xóa</Button>
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý Phòng trọ</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm phòng mới
        </Button>
      </div>

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input
          placeholder="Tìm theo số phòng (VD: P101)"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={fetchRooms}
          style={{ width: 260, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Lọc trạng thái"
          allowClear
          style={{ width: 160 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'EMPTY', label: 'Trống' },
            { value: 'RENTED', label: 'Đang thuê' },
            { value: 'MAINTENANCE', label: 'Bảo trì' },
          ]}
        />
      </Space>

      <Table rowKey="id" columns={columns} dataSource={rooms} loading={loading} bordered scroll={{ x: 1100 }} />

      <Modal
        title="Thêm phòng mới"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setFileList([]); }}
        onOk={() => form.submit()}
        confirmLoading={creating}
        okText="Tạo phòng"
      >
        <Form layout="vertical" form={form} onFinish={handleCreate}>
          <Form.Item name="room_number" label="Số phòng" rules={[{ required: true, message: 'Nhập số phòng' }]}>
            <Input placeholder="VD: P101, P202" />
          </Form.Item>
          <Form.Item name="floor" label="Tầng" rules={[{ required: true, message: 'Nhập tầng' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="price" label="Giá phòng / tháng (đ)" rules={[{ required: true, message: 'Nhập giá phòng' }]}>
            <InputNumber min={0} style={{ width: '100%' }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
          </Form.Item>
          <Form.Item name="daily_price" label="Giá thuê ngày (đ) — để trống = giá tháng / 30">
            <InputNumber {...moneyInputProps} />
          </Form.Item>
          <Form.Item name="area" label="Diện tích (m²)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item label="Ảnh phòng (JPG/PNG/WEBP, tối đa 5MB)">
            <Upload
              listType="picture-card"
              accept="image/jpeg,image/png,image/webp"
              maxCount={1}
              fileList={fileList}
              beforeUpload={(file) => {
                if (file.size > 5 * 1024 * 1024) { message.error('Ảnh phòng tối đa 5MB.'); return Upload.LIST_IGNORE; }
                return false;
              }}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
            >
              {fileList.length === 0 && <div><PlusOutlined /><div style={{ marginTop: 8 }}>Chọn ảnh</div></div>}
            </Upload>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editing ? `Sửa phòng ${editing.room_number}` : ''}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => editForm.submit()}
        confirmLoading={saving}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnClose
      >
        {editing && <EditRoomForm room={editing} form={editForm} onSubmit={handleEdit} />}
      </Modal>
    </div>
  );
}

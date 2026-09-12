import { useEffect, useState } from 'react';
import { Table, Tag, Button, Input, Space, Modal, Form, InputNumber, message, Typography, Select } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const { Title } = Typography;

const statusColor = { EMPTY: 'default', RENTED: 'green', MAINTENANCE: 'orange' };
const statusLabel = { EMPTY: 'Trống', RENTED: 'Đang thuê', MAINTENANCE: 'Bảo trì' };

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState();
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
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
    try {
      await api.post('/rooms', values);
      message.success('Tạo phòng thành công.');
      setModalOpen(false);
      form.resetFields();
      fetchRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo phòng.');
    }
  }

  const columns = [
    { title: 'Số phòng', dataIndex: 'room_number', key: 'room_number', render: (v) => <b>{v}</b> },
    { title: 'Tầng', dataIndex: 'floor', key: 'floor', width: 80 },
    { title: 'Giá phòng', dataIndex: 'price', key: 'price', render: (v) => v?.toLocaleString('vi-VN') + ' đ' },
    { title: 'Diện tích', dataIndex: 'area', key: 'area', render: (v) => (v ? `${v} m²` : '-') },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v) => <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>,
    },
    { title: 'Khách thuê hiện tại', dataIndex: 'tenant_name', key: 'tenant_name', render: (v) => v || '-' },
    {
      title: '', key: 'action',
      render: (_, record) => (
        <Button type="link" onClick={() => navigate(`/admin/rooms/${record.id}`)}>Chi tiết →</Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý Phòng trọ</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Thêm phòng mới
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm theo số phòng (VD: P101)"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={fetchRooms}
          style={{ width: 260 }}
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

      <Table rowKey="id" columns={columns} dataSource={rooms} loading={loading} bordered />

      <Modal
        title="Thêm phòng mới"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
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
          <Form.Item name="area" label="Diện tích (m²)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

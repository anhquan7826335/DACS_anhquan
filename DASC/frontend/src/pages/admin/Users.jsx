import { useEffect, useState } from 'react';
import {
  Table, Tag, Typography, Select, Space, Button, Input, message, Popconfirm, Modal, Form, Avatar, Alert,
} from 'antd';
import { ReloadOutlined, SearchOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { fmtDate } from '../../utils/format';

const { Title } = Typography;

const roleLabel = { ADMIN: 'Chủ trọ (Admin)', TENANT: 'Khách thuê' };
const roleColor = { ADMIN: 'purple', TENANT: 'blue' };

/** Form sửa người dùng — chỉ mount khi modal mở nên luôn khởi tạo từ người đang sửa. */
function EditUserForm({ target, isSelf, form, onSubmit }) {
  return (
    <Form
      layout="vertical"
      form={form}
      onFinish={onSubmit}
      initialValues={{
        full_name: target.full_name,
        email: target.email,
        phone: target.phone,
        role: target.role,
        password: '',
      }}
    >
      <Form.Item name="full_name" label="Họ tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên' }]}>
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}>
        <Input maxLength={100} />
      </Form.Item>
      <Form.Item
        name="phone" label="Số điện thoại"
        rules={[{ required: true, message: 'Nhập số điện thoại' }, { pattern: /^[0-9+\s().-]{8,20}$/, message: 'Số điện thoại không hợp lệ' }]}
      >
        <Input maxLength={20} />
      </Form.Item>
      <Form.Item
        name="role" label="Vai trò"
        extra={isSelf ? 'Bạn không thể tự đổi vai trò của chính mình.' : 'Đổi vai trò có hiệu lực ngay ở lần thao tác tiếp theo của người đó.'}
      >
        <Select
          disabled={isSelf}
          options={[
            { value: 'TENANT', label: roleLabel.TENANT },
            { value: 'ADMIN', label: roleLabel.ADMIN },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="password" label="Đặt lại mật khẩu (để trống nếu không đổi)"
        rules={[{ min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]}
      >
        <Input.Password autoComplete="new-password" placeholder="Mật khẩu mới" />
      </Form.Item>
    </Form>
  );
}

export default function Users() {
  const { user: me, updateUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState();
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  async function fetchUsers() {
    setLoading(true);
    try {
      const { data } = await api.get('/users', { params: { search: search || undefined, role } });
      setUsers(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, [role]);

  async function handleSave(values) {
    setSaving(true);
    try {
      const body = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
      };
      if (editing.id !== me.id) body.role = values.role;
      if (values.password) body.password = values.password;
      await api.put(`/users/${editing.id}`, body);
      if (editing.id === me.id) updateUser({ full_name: values.full_name.trim(), email: values.email.trim(), phone: values.phone.trim() });
      message.success('Đã cập nhật người dùng.');
      setEditing(null);
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể cập nhật người dùng.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/users/${id}`);
      message.success('Đã xóa người dùng.');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể xóa người dùng.');
    }
  }

  async function toggleActive(r) {
    try {
      await api.put(`/users/${r.id}/active`, { is_active: !r.is_active });
      message.success(r.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể đổi trạng thái tài khoản.');
    }
  }

  const columns = [
    {
      title: 'Họ tên', dataIndex: 'full_name', key: 'full_name',
      render: (v, r) => (
        <Space>
          <Avatar src={r.avatar_url} icon={<UserOutlined />} />
          <b>{v}</b>
          {r.id === me.id && <Tag>Bạn</Tag>}
        </Space>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Số điện thoại', dataIndex: 'phone', key: 'phone' },
    { title: 'Vai trò', dataIndex: 'role', key: 'role', render: (v) => <Tag color={roleColor[v]}>{roleLabel[v]}</Tag> },
    {
      title: 'Hợp đồng đang thuê', dataIndex: 'active_contracts', key: 'active_contracts', align: 'center',
      render: (v, r) => (r.role === 'TENANT' ? v : '-'),
    },
    {
      title: 'Trạng thái', dataIndex: 'is_active', key: 'is_active',
      render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Hoạt động' : 'Đã khóa'}</Tag>,
    },
    { title: 'Ngày tạo', dataIndex: 'created_at', key: 'created_at', render: (v) => fmtDate(v) },
    {
      title: '', key: 'action', fixed: 'right', width: 250,
      render: (_, r) => (
        <Space size={4}>
          <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(r)}>Sửa</Button>
          <Button size="small" disabled={r.id === me.id} onClick={() => toggleActive(r)}>{r.is_active ? 'Khóa' : 'Mở khóa'}</Button>
          <Popconfirm
            title={`Xóa người dùng “${r.full_name}”?`}
            description="Các yêu cầu thuê chưa duyệt, sự cố và hội thoại hỗ trợ của người này cũng bị xóa; người đã có hợp đồng thì nên khóa tài khoản thay vì xóa. Không thể hoàn tác."
            onConfirm={() => handleDelete(r.id)}
            okText="Xóa" okButtonProps={{ danger: true }} cancelText="Hủy"
            disabled={r.id === me.id}
          >
            <Button size="small" danger icon={<DeleteOutlined />} disabled={r.id === me.id}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Quản lý Người dùng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchUsers}>Làm mới</Button>
      </div>

      <Space wrap style={{ marginBottom: 16, width: '100%' }}>
        <Input
          placeholder="Tìm theo tên, email, số điện thoại"
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onPressEnter={fetchUsers}
          style={{ width: 300, maxWidth: '100%' }}
          allowClear
        />
        <Select
          placeholder="Lọc vai trò"
          allowClear
          style={{ width: 180 }}
          value={role}
          onChange={setRole}
          options={[
            { value: 'ADMIN', label: roleLabel.ADMIN },
            { value: 'TENANT', label: roleLabel.TENANT },
          ]}
        />
        <Button type="primary" icon={<SearchOutlined />} onClick={fetchUsers}>Tìm</Button>
      </Space>

      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="Người dùng đã có hợp đồng thuê không thể xóa (cần giữ để đối chiếu hóa đơn). Bạn không thể xóa hay đổi vai trò của chính mình."
      />

      <Table rowKey="id" columns={columns} dataSource={users} loading={loading} bordered scroll={{ x: 900 }} />

      <Modal
        title={editing ? `Sửa người dùng — ${editing.full_name}` : ''}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        destroyOnClose
      >
        {editing && <EditUserForm target={editing} isSelf={editing.id === me.id} form={form} onSubmit={handleSave} />}
      </Modal>
    </div>
  );
}

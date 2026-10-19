import { useCallback, useEffect, useState } from 'react';
import {
  Avatar,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Menu,
  message,
  Space,
  Spin,
  Typography,
  Upload,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  LockOutlined,
  ReloadOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import '../css/Profile.css';

const { Title, Text } = Typography;

function toCsvCell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportUtilityUsage(invoices) {
  const rows = [
    ['Tháng', 'Năm', 'Phòng', 'Điện tiêu thụ (kWh)', 'Nước tiêu thụ (m³)', 'Tiền điện (đ)', 'Tiền nước (đ)'],
    ...invoices.map((invoice) => [
      invoice.month,
      invoice.year,
      invoice.room_number,
      invoice.electricity,
      invoice.water,
      invoice.electricity_fee,
      invoice.water_fee,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lich-su-dien-nuoc.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form] = Form.useForm();
  const [section, setSection] = useState('profile');
  const [invoices, setInvoices] = useState([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const isTenant = user?.role === 'TENANT';

  const fetchInvoices = useCallback(async () => {
    setLoadingInvoices(true);
    try {
      const { data } = await api.get('/invoices/tenant');
      setInvoices(data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Không tải được lịch sử điện nước.');
    } finally {
      setLoadingInvoices(false);
    }
  }, []);

  useEffect(() => {
    if (isTenant) fetchInvoices();
  }, [fetchInvoices, isTenant]);

  async function handleChangePassword(values) {
    setChangingPassword(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      message.success(data.message || 'Đổi mật khẩu thành công.');
      form.resetFields();
    } catch (error) {
      message.error(error.response?.data?.message || 'Không đổi được mật khẩu.');
    } finally {
      setChangingPassword(false);
    }
  }

  function validateAvatar(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      message.error('Ảnh đại diện chỉ hỗ trợ định dạng JPG, PNG hoặc WEBP.');
      return Upload.LIST_IGNORE;
    }
    if (file.size > 5 * 1024 * 1024) {
      message.error('Ảnh đại diện không được lớn hơn 5 MB.');
      return Upload.LIST_IGNORE;
    }
    return true;
  }

  async function uploadAvatar({ file, onSuccess, onError }) {
    const body = new FormData();
    body.append('avatar', file);
    try {
      const { data } = await api.put('/auth/avatar', body);
      updateUser(data.user);
      message.success(data.message || 'Cập nhật ảnh đại diện thành công.');
      onSuccess(data);
    } catch (error) {
      message.error(error.response?.data?.message || 'Không tải được ảnh đại diện.');
      onError(error);
    }
  }

  const menuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
    },
    {
      key: 'password',
      icon: <LockOutlined />,
      label: 'Mật khẩu',
    },
    ...(isTenant
      ? [{ key: 'utilities', icon: <FileTextOutlined />, label: 'Lịch sử điện nước' }]
      : []),
  ];

  return (
    <div className="profile-page">
      <div className="profile-page-heading">
        <div>
          <Text className="profile-eyebrow">TÀI KHOẢN</Text>
          <Title level={2} style={{ margin: '4px 0 0' }}>Hồ sơ người dùng</Title>
        </div>
      </div>

      <div className="profile-settings-layout">
        <aside className="profile-sidebar">
          <div className="profile-sidebar-user">
            <Avatar size={58} src={user?.avatar_url} icon={<UserOutlined />} />
            <div className="profile-sidebar-user-text">
              <Text strong ellipsis>{user?.full_name}</Text>
              <Text type="secondary" ellipsis>{user?.email}</Text>
            </div>
          </div>
          <Menu
            className="profile-settings-menu"
            mode="inline"
            selectedKeys={[section]}
            items={menuItems}
            onClick={({ key }) => setSection(key)}
          />
        </aside>

        <main className="profile-settings-content">
          {section === 'profile' && (
            <Card className="profile-settings-card">
              <div className="profile-card-heading">
                <div>
                  <Title level={4}>Thông tin cá nhân</Title>
                  <Text type="secondary">Quản lý thông tin và ảnh đại diện tài khoản của bạn.</Text>
                </div>
                <Upload
                  accept="image/jpeg,image/png,image/webp"
                  showUploadList={false}
                  beforeUpload={validateAvatar}
                  customRequest={uploadAvatar}
                >
                  <Button icon={<UploadOutlined />}>Đổi ảnh</Button>
                </Upload>
              </div>

              <div className="profile-avatar-block">
                <Avatar
                  className="profile-large-avatar"
                  size={104}
                  src={user?.avatar_url}
                  icon={<UserOutlined />}
                />
                <div>
                  <Text strong className="profile-avatar-name">{user?.full_name}</Text>
                  <Text type="secondary" style={{ display: 'block' }}>
                    Ảnh JPG, PNG hoặc WEBP · tối đa 5 MB
                  </Text>
                </div>
              </div>

              <Descriptions className="profile-details" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Họ và tên">{user?.full_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{user?.email || '—'}</Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">{user?.phone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Vai trò">{isTenant ? 'Khách thuê' : 'Quản trị viên'}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          {section === 'password' && (
            <Card className="profile-settings-card">
              <div className="profile-card-heading">
                <div>
                  <Title level={4}><LockOutlined /> Mật khẩu</Title>
                  <Text type="secondary">Dùng mật khẩu hiện tại để xác nhận thay đổi.</Text>
                </div>
              </div>
              <Form form={form} layout="vertical" onFinish={handleChangePassword} className="profile-password-form">
                <Form.Item
                  name="currentPassword"
                  label="Mật khẩu hiện tại"
                  rules={[{ required: true, message: 'Nhập mật khẩu hiện tại.' }]}
                >
                  <Input.Password autoComplete="current-password" />
                </Form.Item>
                <Form.Item
                  name="newPassword"
                  label="Mật khẩu mới"
                  rules={[
                    { required: true, message: 'Nhập mật khẩu mới.' },
                    { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự.' },
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  name="confirmPassword"
                  label="Nhập lại mật khẩu mới"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: 'Nhập lại mật khẩu mới.' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                        return Promise.reject(new Error('Mật khẩu nhập lại không khớp.'));
                      },
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={changingPassword}>
                  Cập nhật mật khẩu
                </Button>
              </Form>
            </Card>
          )}

          {section === 'utilities' && isTenant && (
            <Card className="profile-settings-card">
              <div className="profile-card-heading">
                <div>
                  <Title level={4}>Lịch sử điện nước</Title>
                  <Text type="secondary">Xem hoặc tải xuống lịch sử chỉ số và chi phí theo từng tháng.</Text>
                </div>
                <Space>
                  <Button icon={<ReloadOutlined />} onClick={fetchInvoices} loading={loadingInvoices}>
                    Làm mới
                  </Button>
                  <Button
                    type="primary"
                    icon={<DownloadOutlined />}
                    disabled={invoices.length === 0}
                    onClick={() => exportUtilityUsage(invoices)}
                  >
                    Xuất file CSV
                  </Button>
                </Space>
              </div>

              <Spin spinning={loadingInvoices}>
                {invoices.length === 0 ? (
                  <Empty description="Chưa có dữ liệu điện nước để xuất." />
                ) : (
                  <Text type="secondary">
                    File tải về gồm chỉ số đầu kỳ, cuối kỳ, mức tiêu thụ và tiền điện nước theo từng tháng.
                  </Text>
                )}
              </Spin>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

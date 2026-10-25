import { useState } from 'react';
import { Avatar, Button, Card, Form, Input, Menu, message, Typography, Upload } from 'antd';
import { LockOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import '../css/Profile.css';

const { Title, Text } = Typography;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form] = Form.useForm();
  const [section, setSection] = useState('profile');
  const [changingPassword, setChangingPassword] = useState(false);
  const [infoForm] = Form.useForm();
  const [savingInfo, setSavingInfo] = useState(false);
  const isTenant = user?.role === 'TENANT';

  async function handleSaveInfo(values) {
    setSavingInfo(true);
    try {
      const { data } = await api.put('/users/me', values);
      updateUser({ ...user, ...data.user });
      message.success(data.message || 'Đã cập nhật thông tin.');
    } catch (error) {
      message.error(error.response?.data?.message || 'Không cập nhật được thông tin.');
    } finally {
      setSavingInfo(false);
    }
  }

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

              <Form
                form={infoForm}
                layout="vertical"
                onFinish={handleSaveInfo}
                initialValues={{ full_name: user?.full_name, email: user?.email, phone: user?.phone }}
                className="profile-password-form"
              >
                <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Nhập họ tên.' }]}>
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ.' }]}>
                  <Input maxLength={100} />
                </Form.Item>
                <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, pattern: /^[0-9+\s().-]{8,20}$/, message: 'Số điện thoại không hợp lệ.' }]}>
                  <Input maxLength={20} />
                </Form.Item>
                <Form.Item label="Vai trò"><Text>{isTenant ? 'Khách thuê' : 'Quản trị viên'}</Text></Form.Item>
                <Button type="primary" htmlType="submit" loading={savingInfo}>Lưu thông tin</Button>
              </Form>
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

        </main>
      </div>
    </div>
  );
}

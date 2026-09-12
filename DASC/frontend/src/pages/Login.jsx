import { useState } from 'react';
import { Form, Input, Button, Card, Typography, Alert, Tabs } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(values) {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', values);
      login(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin/rooms' : '/tenant');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(values) {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/register', { ...values, role: 'TENANT' });
      login(data.token, data.user);
      navigate('/tenant');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }}>
      <Card style={{ width: 400, borderRadius: 12 }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ marginBottom: 0 }}>Quản lý Nhà trọ</Title>
          <Text type="secondary">Hệ thống Quản lý & Tự động hóa Hóa đơn</Text>
        </div>

        <Tabs
          activeKey={mode}
          onChange={(k) => { setMode(k); setError(''); }}
          centered
          items={[
            { key: 'login', label: 'Đăng nhập' },
            { key: 'register', label: 'Đăng ký' },
          ]}
        />

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        {mode === 'login' ? (
          <Form layout="vertical" onFinish={handleLogin}>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Nhập email' }]}>
              <Input prefix={<UserOutlined />} placeholder="Email" />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Đăng nhập
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleRegister}>
            <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true }]}>
              <Input placeholder="Nguyễn Văn A" />
            </Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="ban@email.com" />
            </Form.Item>
            <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true }]}>
              <Input placeholder="0901234567" />
            </Form.Item>
            <Form.Item name="cccd" label="CCCD">
              <Input placeholder="012345678901" />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
              <Input.Password placeholder="Tối thiểu 6 ký tự" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Đăng ký tài khoản Khách thuê
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}

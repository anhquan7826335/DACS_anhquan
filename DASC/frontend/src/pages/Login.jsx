import { useState } from 'react';
import { Form, Input, Button, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './css/Login.css';

export default function Login() {
  const [mode, setMode] = useState('login');
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
    <div className="login-page">
      <div className="login-panel">
        <h1 className="login-title">Chào mừng trở lại!</h1>

        {error && <Alert type="error" message={error} showIcon className="login-error" />}

        {mode === 'login' ? (
          <Form layout="vertical" onFinish={handleLogin} className="login-form">
            <Form.Item name="email" rules={[{ required: true, message: 'Nhập email' }]} className="login-form-item">
              <Input
                prefix={<MailOutlined style={{ color: '#4d4d4d', fontSize: 22 }} />}
                placeholder="Email"
                className="login-input"
              />
            </Form.Item>

            <Form.Item name="password" rules={[{ required: true, message: 'Nhập mật khẩu' }]} className="login-form-item login-form-item--password">
              <Input.Password
                prefix={<LockOutlined style={{ color: '#4d4d4d', fontSize: 22 }} />}
                placeholder="Mật Khẩu"
                className="login-password"
              />
            </Form.Item>

            <div className="login-forgot">
              <button type="button">Quên Mật Khẩu?</button>
            </div>

            <Button type="primary" htmlType="submit" block loading={loading} className="login-submit">
              Đăng Nhập
            </Button>
          </Form>
        ) : (
          <Form layout="vertical" onFinish={handleRegister} className="login-form">
            <Form.Item name="full_name" rules={[{ required: true, message: 'Nhập họ và tên' }]} className="login-form-item">
              <Input placeholder="Họ và tên" className="login-input" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]} className="login-form-item">
              <Input placeholder="Email" className="login-input" />
            </Form.Item>
            <Form.Item name="phone" rules={[{ required: true, message: 'Nhập số điện thoại' }]} className="login-form-item">
              <Input placeholder="Số điện thoại" className="login-input" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Mật khẩu tối thiểu 6 ký tự' }]} className="login-form-item login-form-item--password">
              <Input.Password placeholder="Mật khẩu" className="login-password" />
            </Form.Item>

            <Button type="primary" htmlType="submit" block loading={loading} className="login-submit">
              Đăng Ký
            </Button>
          </Form>
        )}

        <div className="login-divider">
          <div className="login-divider-line" />
          <span className="login-divider-text">Hoặc tiếp tục với</span>
          <div className="login-divider-line" />
        </div>

        <div className="login-socials">
          <Button className="login-social-btn">
            <span className="login-social-icon">G</span>
            <span>Google</span>
          </Button>
          <Button className="login-social-btn login-social-btn--facebook">
            <span className="login-social-icon">f</span>
            <span>Facebook</span>
          </Button>
        </div>

        <div className="login-toggle">
          Không có tài khoản?{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập ngay'}
          </button>
        </div>
      </div>
    </div>
  );
}

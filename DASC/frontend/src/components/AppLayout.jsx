import { Layout, Menu, Button, Avatar, Space, Typography } from 'antd';
import { HomeOutlined, FileTextOutlined, ToolOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Content } = Layout;
const { Text } = Typography;

const adminMenu = [
  { key: '/admin/rooms', icon: <HomeOutlined />, label: <Link to="/admin/rooms">Phòng trọ</Link> },
  { key: '/admin/invoices', icon: <FileTextOutlined />, label: <Link to="/admin/invoices">Hóa đơn</Link> },
  { key: '/admin/tickets', icon: <ToolOutlined />, label: <Link to="/admin/tickets">Sự cố</Link> },
];

const tenantMenu = [
  { key: '/tenant', icon: <FileTextOutlined />, label: <Link to="/tenant">Hóa đơn của tôi</Link> },
  { key: '/tenant/tickets', icon: <ToolOutlined />, label: <Link to="/tenant/tickets">Báo sự cố</Link> },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = isAdmin ? adminMenu : tenantMenu;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#1d4ed8', paddingInline: 24 }}>
        <Text strong style={{ color: 'white', fontSize: 18, marginRight: 32, whiteSpace: 'nowrap' }}>
          🏠 Quản lý Nhà trọ
        </Text>
        <Menu
          theme="dark"
          mode="horizontal"
          style={{ background: 'transparent', flex: 1, minWidth: 0 }}
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
        <Space>
          <Avatar icon={<UserOutlined />} />
          <Text style={{ color: 'white' }}>{user?.full_name}</Text>
          <Button icon={<LogoutOutlined />} onClick={handleLogout} type="text" style={{ color: 'white' }}>
            Đăng xuất
          </Button>
        </Space>
      </Header>
      <Content>
        <div className="page-container">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}

import { useState } from 'react';
import { Layout, Menu, Button, Avatar, Space, Typography, Drawer, Dropdown } from 'antd';
import { HomeOutlined, FileTextOutlined, ToolOutlined, CustomerServiceOutlined, LogoutOutlined, UserOutlined, MenuOutlined, DownOutlined } from '@ant-design/icons';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header, Content } = Layout;
const { Text } = Typography;

const adminMenu = [
  { key: '/admin/rooms', icon: <HomeOutlined />, label: <Link to="/admin/rooms">Phòng trọ</Link> },
  { key: '/admin/invoices', icon: <FileTextOutlined />, label: <Link to="/admin/invoices">Hóa đơn</Link> },
  { key: '/admin/tickets', icon: <ToolOutlined />, label: <Link to="/admin/tickets">Sự cố</Link> },
  { key: '/admin/support', icon: <CustomerServiceOutlined />, label: <Link to="/admin/support">Hỗ trợ</Link> },
];

const tenantMenu = [
  { key: '/tenant', icon: <FileTextOutlined />, label: <Link to="/tenant">Hóa đơn của tôi</Link> },
  { key: '/tenant/tickets', icon: <ToolOutlined />, label: <Link to="/tenant/tickets">Báo sự cố</Link> },
  { key: '/tenant/support', icon: <CustomerServiceOutlined />, label: <Link to="/tenant/support">Hỗ trợ</Link> },
];

export default function AppLayout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const menuItems = isAdmin ? adminMenu : tenantMenu;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleMenuClick() {
    setDrawerOpen(false);
  }

  function handleAccountMenuClick({ key }) {
    if (key === 'profile') navigate('/profile');
    if (key === 'logout') handleLogout();
  }

  const accountMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Hồ sơ cá nhân',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#1d4ed8', paddingInline: 12 }}>
        <Button
          className="md:hidden"
          type="text"
          icon={<MenuOutlined style={{ color: 'white', fontSize: 18 }} />}
          onClick={() => setDrawerOpen(true)}
          style={{ marginRight: 8 }}
        />

        <Text
          strong
          className="truncate"
          style={{ color: 'white', fontSize: 16, marginRight: 24, whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          🏠 <span className="hidden sm:inline">Quản lý Nhà trọ</span>
        </Text>
        <Menu
          className="hidden md:flex"
          theme="dark"
          mode="horizontal"
          style={{ background: 'transparent', flex: 1, minWidth: 0 }}
          selectedKeys={[location.pathname]}
          items={menuItems}
        />
        <div className="flex-1 md:hidden" />
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{ items: accountMenuItems, onClick: handleAccountMenuClick }}
          popupRender={(menu) => (
            <div style={{ width: 280, overflow: 'hidden', borderRadius: 12, background: '#fff', boxShadow: '0 8px 28px rgba(0,0,0,.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 18, background: '#f0fbfb' }}>
                <Avatar size={52} src={user?.avatar_url} icon={<UserOutlined />} />
                <div style={{ minWidth: 0 }}>
                  <Text strong style={{ display: 'block' }}>{user?.full_name}</Text>
                  <Text type="secondary" ellipsis style={{ display: 'block', maxWidth: 185 }}>{user?.email}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{isAdmin ? 'Quản trị viên' : 'Khách thuê'}</Text>
                </div>
              </div>
              {menu}
            </div>
          )}
        >
          <Button
            type="text"
            aria-label="Mở menu tài khoản"
            style={{ display: 'inline-flex', height: 40, alignItems: 'center', gap: 8, paddingInline: 8, color: 'white' }}
          >
            <Avatar size="small" src={user?.avatar_url} icon={<UserOutlined />} />
            <Text className="hidden sm:inline" style={{ color: 'white' }}>{user?.full_name}</Text>
            <DownOutlined style={{ fontSize: 10 }} />
          </Button>
        </Dropdown>
      </Header>
      <Drawer
        title="🏠 Quản lý Nhà trọ"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={260}
        styles={{ body: { padding: 0 } }}
      >
        <Menu
          mode="vertical"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Drawer>
      <Content>
        <div className="page-container">
          <Outlet />
        </div>
      </Content>
    </Layout>
  );
}

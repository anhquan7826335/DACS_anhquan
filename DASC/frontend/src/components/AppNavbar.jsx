import { useState } from 'react';
import { Avatar, Button, Dropdown, Drawer, Layout, Menu, Typography } from 'antd';
import {
  CustomerServiceOutlined,
  DownOutlined,
  FileTextOutlined,
  HomeOutlined,
  LogoutOutlined,
  MenuOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../css/AppLayout.css';

const { Header } = Layout;
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

export default function AppNavbar() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuItems = isAdmin ? adminMenu : tenantMenu;

  function handleLogout() {
    logout();
    navigate('/login');
  }

  function handleAccountMenuClick({ key }) {
    if (key === 'profile') navigate('/profile');
    if (key === 'logout') handleLogout();
  }

  const accountMenuItems = [
    { key: 'profile', icon: <UserOutlined />, label: 'Hồ sơ cá nhân' },
    { key: 'logout', icon: <LogoutOutlined />, label: 'Đăng xuất', danger: true },
  ];

  return (
    <>
      <Header className="app-navbar" style={{ height: 'auto', padding: 0, lineHeight: 'normal', background: '#20232a' }}>
        <div className="app-navbar-inner">
          <Button
            className="md:hidden"
            type="text"
            aria-label="Mở điều hướng"
            icon={<MenuOutlined style={{ color: 'white', fontSize: 24 }} />}
            onClick={() => setDrawerOpen(true)}
            style={{ marginRight: 8 }}
          />

          <Text
            strong
            className="truncate"
            style={{ color: 'white', fontSize: 24, marginRight: 24, whiteSpace: 'nowrap', flexShrink: 0 }}
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
        </div>
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
          onClick={() => setDrawerOpen(false)}
        />
      </Drawer>
    </>
  );
}

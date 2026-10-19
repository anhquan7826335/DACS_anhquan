import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import AppFooter from './AppFooter';
import AppNavbar from './AppNavbar';

const { Content } = Layout;

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <AppNavbar />
      <Content style={{ flex: 1 }}>
        <div className="page-container">
          <Outlet />
        </div>
      </Content>
      <AppFooter />
    </Layout>
  );
}

import { Layout, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../css/AppFooter.css';
import { lazy } from 'react';

const { Footer } = Layout;
const { Text, Title } = Typography;

export default function AppFooter() {
  const { isAdmin } = useAuth();
  const supportPath = isAdmin ? '/admin/support' : '/tenant/support';
  const footerGroups = isAdmin
    ? [
      {
        title: 'QUẢN LÝ',
        links: [
          { label: 'Phòng trọ', to: '/admin/rooms' },
          { label: 'Hóa đơn', to: '/admin/invoices' },
          { label: 'Sự cố', to: '/admin/tickets' },
        ],
      },
      {
        title: 'TÀI KHOẢN',
        links: [{ label: 'Hồ sơ cá nhân', to: '/profile' }],
      },
    ]
    : [
      {
        title: 'DỊCH VỤ',
        links: [
          { label: 'Thuê phòng', to: '/tenant/rooms' },
          { label: 'Hóa đơn của tôi', to: '/tenant' },
          { label: 'Báo sự cố', to: '/tenant/tickets' },
        ],
      },
      {
        title: 'TÀI KHOẢN',
        links: [{ label: 'Hồ sơ cá nhân', to: '/profile' }],
      },
    ];

  footerGroups.push({
    title: 'HỖ TRỢ',
    links: [{ label: 'Trung tâm hỗ trợ', to: supportPath }],
  });

  return (
    <Footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-columns">
          {footerGroups.map((group) => (
            <section key={group.title}>
              <Title level={5} className="app-footer-heading">{group.title}</Title>
              <ul className="app-footer-links">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section className="app-footer-about">
            <Title level={5} className="app-footer-heading">QUẢN LÝ NHÀ TRỌ</Title>
            <Text className="app-footer-description">
              Đồng hành cùng bạn trong việc quản lý và sử dụng nhà trọ thuận tiện hơn.
            </Text>
          </section>
        </div>
        <div className="app-footer-bottom">
          <Text>© {new Date().getFullYear()} Quản lý Nhà trọ.</Text>
        </div>
      </div>
    </Footer>
  );
}

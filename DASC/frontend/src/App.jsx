import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AppLayout from './components/AppLayout';

import Login from './pages/Login';
import Rooms from './pages/admin/Rooms';
import RoomDetail from './pages/admin/RoomDetail';
import Invoices from './pages/admin/Invoices';
import Tickets from './pages/admin/Tickets';
import TenantHome from './pages/tenant/TenantHome';
import TenantTicket from './pages/tenant/TenantTicket';

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'ADMIN' ? '/admin/rooms' : '/tenant'} replace />;
}

export default function App() {
  return (
    <ConfigProvider locale={viVN} theme={{ token: { colorPrimary: '#1d4ed8', borderRadius: 8 } }}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              {/* Admin */}
              <Route path="/admin/rooms" element={<PrivateRoute role="ADMIN"><Rooms /></PrivateRoute>} />
              <Route path="/admin/rooms/:id" element={<PrivateRoute role="ADMIN"><RoomDetail /></PrivateRoute>} />
              <Route path="/admin/invoices" element={<PrivateRoute role="ADMIN"><Invoices /></PrivateRoute>} />
              <Route path="/admin/tickets" element={<PrivateRoute role="ADMIN"><Tickets /></PrivateRoute>} />

              {/* Tenant */}
              <Route path="/tenant" element={<PrivateRoute role="TENANT"><TenantHome /></PrivateRoute>} />
              <Route path="/tenant/tickets" element={<PrivateRoute role="TENANT"><TenantTicket /></PrivateRoute>} />
            </Route>

            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ConfigProvider>
  );
}

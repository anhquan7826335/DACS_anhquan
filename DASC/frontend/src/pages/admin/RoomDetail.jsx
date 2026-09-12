import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, Descriptions, Tag, Button, Space, message, Popconfirm, Empty, Typography } from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../../api/axios';
import CreateContractModal from '../../components/CreateContractModal';
import CreateInvoiceModal from '../../components/CreateInvoiceModal';

const { Title } = Typography;
const statusColor = { EMPTY: 'default', RENTED: 'green', MAINTENANCE: 'orange' };
const statusLabel = { EMPTY: 'Trống', RENTED: 'Đang thuê', MAINTENANCE: 'Bảo trì' };

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [contract, setContract] = useState(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: roomData } = await api.get(`/rooms/${id}`);
      setRoom(roomData);

      if (roomData.status === 'RENTED') {
        try {
          const { data: contractData } = await api.get(`/contracts/room/${id}`);
          setContract(contractData);
        } catch {
          setContract(null);
        }
      } else {
        setContract(null);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải dữ liệu phòng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [id]);

  async function handleTerminate() {
    try {
      await api.put(`/contracts/${contract.id}/terminate`);
      message.success('Đã thanh lý hợp đồng.');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể thanh lý hợp đồng.');
    }
  }

  if (loading || !room) return null;

  return (
    <div>
      <Link to="/admin/rooms"><Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Quay lại</Button></Link>

      <Card
        title={<Title level={4} style={{ margin: 0 }}>Phòng {room.room_number} <Tag color={statusColor[room.status]}>{statusLabel[room.status]}</Tag></Title>}
        extra={
          room.status === 'EMPTY' ? (
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => setContractModalOpen(true)}>
              Tạo hợp đồng thuê
            </Button>
          ) : (
            <Space>
              <Button icon={<ThunderboltOutlined />} type="primary" onClick={() => setInvoiceModalOpen(true)}>
                Chốt điện nước / Tạo hóa đơn
              </Button>
              <Popconfirm title="Xác nhận thanh lý hợp đồng?" onConfirm={handleTerminate} okText="Thanh lý" cancelText="Hủy">
                <Button danger>Thanh lý hợp đồng</Button>
              </Popconfirm>
            </Space>
          )
        }
      >
        <Descriptions bordered column={2}>
          <Descriptions.Item label="Tầng">{room.floor}</Descriptions.Item>
          <Descriptions.Item label="Diện tích">{room.area ? `${room.area} m²` : '-'}</Descriptions.Item>
          <Descriptions.Item label="Giá phòng">{room.price?.toLocaleString('vi-VN')} đ/tháng</Descriptions.Item>
          <Descriptions.Item label="Khách thuê hiện tại">{room.tenant_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Mô tả" span={2}>{room.description || '-'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {room.status === 'RENTED' && (
        <Card title="Thông tin hợp đồng" style={{ marginTop: 16 }}>
          {contract ? (
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Khách thuê">{contract.tenant_name}</Descriptions.Item>
              <Descriptions.Item label="SĐT">{contract.tenant_phone}</Descriptions.Item>
              <Descriptions.Item label="CCCD">{contract.tenant_cccd}</Descriptions.Item>
              <Descriptions.Item label="Tiền cọc">{contract.deposit?.toLocaleString('vi-VN')} đ</Descriptions.Item>
              <Descriptions.Item label="Đơn giá điện">{contract.electricity_rate?.toLocaleString('vi-VN')} đ/kWh</Descriptions.Item>
              <Descriptions.Item label="Đơn giá nước">{contract.water_rate?.toLocaleString('vi-VN')} đ/m³</Descriptions.Item>
              <Descriptions.Item label="Ngày bắt đầu">{contract.start_date}</Descriptions.Item>
              <Descriptions.Item label="Ngày kết thúc">{contract.end_date}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="Không tìm thấy hợp đồng đang hiệu lực." />
          )}
        </Card>
      )}

      <CreateContractModal
        open={contractModalOpen}
        room={room}
        onClose={() => setContractModalOpen(false)}
        onSuccess={() => { setContractModalOpen(false); fetchData(); }}
      />

      {contract && (
        <CreateInvoiceModal
          open={invoiceModalOpen}
          room={room}
          contract={contract}
          onClose={() => setInvoiceModalOpen(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

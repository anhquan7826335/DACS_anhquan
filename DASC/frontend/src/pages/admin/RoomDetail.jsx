import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Space, message, Popconfirm, Empty, Typography, Image, Upload,
  Table, Modal, Input, Alert, InputNumber,
} from 'antd';
import { ArrowLeftOutlined, FileAddOutlined, ThunderboltOutlined, CameraOutlined, HomeOutlined } from '@ant-design/icons';
import api from '../../api/axios';
import CreateContractModal from '../../components/CreateContractModal';
import CreateInvoiceModal from '../../components/CreateInvoiceModal';
import { dailyRateOf, fmtDate, moneyInputProps, rentalTypeLabel, vnd } from '../../utils/format';

const { Title, Text } = Typography;
const statusColor = { EMPTY: 'default', RENTED: 'green', MAINTENANCE: 'orange' };
const statusLabel = { EMPTY: 'Trống', RENTED: 'Đang thuê', MAINTENANCE: 'Bảo trì' };

export default function RoomDetail() {
  const { id } = useParams();
  const [room, setRoom] = useState(null);
  const [contract, setContract] = useState(null);
  const [requests, setRequests] = useState([]);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null); // yêu cầu đang nhập lý do từ chối
  const [rejectNote, setRejectNote] = useState('');
  const [approving, setApproving] = useState(null);
  const [approveDeposit, setApproveDeposit] = useState(0);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: roomData } = await api.get(`/rooms/${id}`);
      setRoom(roomData);

      if (roomData.status === 'RENTED') {
        setRequests([]);
        try {
          const { data: contractData } = await api.get(`/contracts/room/${id}`);
          setContract(contractData);
        } catch {
          setContract(null);
        }
      } else {
        setContract(null);
        if (roomData.status === 'EMPTY') {
          const { data: pending } = await api.get('/contracts', { params: { room_id: id, status: 'PENDING' } });
          setRequests(pending);
        } else {
          setRequests([]);
        }
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

  async function handleUploadImage(file) {
    if (file.size > 5 * 1024 * 1024) { message.error('Ảnh phòng tối đa 5MB.'); return Upload.LIST_IGNORE; }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      await api.post(`/rooms/${id}/image`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success('Đã cập nhật ảnh phòng.');
      await fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tải ảnh phòng.');
    } finally {
      setUploading(false);
    }
    return false; // không để Upload tự gửi request
  }

  async function handleApprove(booking) {
    setBusyId(booking.id);
    try {
      await api.put(`/contracts/${booking.id}/approve`, { deposit: approveDeposit });
      message.success('Đã duyệt yêu cầu. Bạn có thể tạo hóa đơn tiền phòng cho khách ngay bên dưới.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể duyệt yêu cầu.');
    } finally {
      setBusyId(null);
      fetchData();
    }
  }

  async function handleReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await api.put(`/contracts/${rejecting.id}/reject`, { admin_note: rejectNote });
      message.success('Đã từ chối yêu cầu.');
      setRejecting(null);
      setRejectNote('');
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể từ chối yêu cầu.');
    } finally {
      setBusyId(null);
      fetchData();
    }
  }

  if (loading && !room) return null;
  if (!room) return null;

  const requestColumns = [
    {
      title: 'Khách thuê', key: 'tenant',
      render: (_, r) => <div><b>{r.tenant_name}</b><div><Text type="secondary">{r.tenant_phone}</Text></div></div>,
    },
    { title: 'Thời gian thuê', key: 'range', render: (_, r) => `${fmtDate(r.start_date)} → ${fmtDate(r.end_date)}` },
    { title: 'Hình thức', dataIndex: 'rental_type', key: 'type', render: (v) => <Tag color={v === 'DAILY' ? 'cyan' : 'blue'}>{rentalTypeLabel[v]}</Tag> },
    { title: 'Dự kiến tiền phòng', dataIndex: 'estimated_total', key: 'estimated_total', render: (v) => <b>{vnd(v)}</b> },
    { title: 'Gửi lúc', dataIndex: 'created_at', key: 'created_at', render: (v) => v?.slice(0, 16) },
    {
      title: '', key: 'action',
      render: (_, r) => (
        <Space wrap>
          <Button type="primary" size="small" loading={busyId === r.id} onClick={() => { setApproving(r); setApproveDeposit(r.rental_type === 'MONTHLY' ? Number(r.monthly_fee) : 0); }}>Duyệt</Button>
          <Button danger size="small" disabled={busyId === r.id} onClick={() => { setRejecting(r); setRejectNote(''); }}>Từ chối</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Link to="/admin/rooms"><Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>Quay lại</Button></Link>

      <Card
        title={<Title level={4} style={{ margin: 0 }}>Phòng {room.room_number} <Tag color={statusColor[room.status]}>{statusLabel[room.status]}</Tag></Title>}
        extra={
          room.status === 'EMPTY' ? (
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => setContractModalOpen(true)}>
              Tạo hợp đồng
            </Button>
          ) : room.status === 'RENTED' ? (
            <Space wrap>
              <Button icon={<ThunderboltOutlined />} type="primary" onClick={() => setInvoiceModalOpen(true)}>
                Tạo hóa đơn
              </Button>
              <Popconfirm title="Xác nhận thanh lý hợp đồng?" onConfirm={handleTerminate} okText="Thanh lý" cancelText="Hủy">
                <Button danger>Thanh lý hợp đồng</Button>
              </Popconfirm>
            </Space>
          ) : null
        }
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          <div style={{ flex: '0 0 260px', maxWidth: '100%' }}>
            {room.image_url ? (
              <Image src={room.image_url} alt="Ảnh phòng" width="100%" height={200} style={{ objectFit: 'cover', borderRadius: 8 }} />
            ) : (
              <div style={{ height: 200, borderRadius: 8, background: '#f0f2f5', color: '#bfbfbf', fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HomeOutlined />
              </div>
            )}
            <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={handleUploadImage} disabled={uploading}>
              <Button icon={<CameraOutlined />} loading={uploading} style={{ marginTop: 8 }} block>
                {room.image_url ? 'Đổi ảnh phòng' : 'Tải ảnh phòng'}
              </Button>
            </Upload>
          </div>

          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Tầng">{room.floor}</Descriptions.Item>
              <Descriptions.Item label="Diện tích">{room.area ? `${room.area} m²` : '-'}</Descriptions.Item>
              <Descriptions.Item label="Giá phòng">{vnd(room.price)}/tháng</Descriptions.Item>
              <Descriptions.Item label="Giá thuê ngày">{vnd(room.daily_rate ?? dailyRateOf(room.price))}/ngày</Descriptions.Item>
              <Descriptions.Item label="Khách thuê hiện tại">{room.tenant_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="Thuê đến ngày">{room.end_date ? fmtDate(room.end_date) : '-'}</Descriptions.Item>
              <Descriptions.Item label="Mô tả" span={2}>{room.description || '-'}</Descriptions.Item>
            </Descriptions>
          </div>
        </div>
      </Card>

      {room.status === 'EMPTY' && (
        <Card
          title={<span>Yêu cầu thuê phòng {requests.length > 0 && <Tag color="gold">{requests.length} chờ duyệt</Tag>}</span>}
          style={{ marginTop: 16 }}
        >
          {requests.length === 0 ? (
            <Empty description="Chưa có ai gửi yêu cầu thuê phòng này." />
          ) : (
            <>
              <Alert
                type="info" showIcon style={{ marginBottom: 12 }}
                message="Khi bạn duyệt một yêu cầu, hợp đồng có hiệu lực, phòng chuyển sang Đang thuê và các yêu cầu còn lại của phòng này tự động bị từ chối."
              />
              <Table rowKey="id" columns={requestColumns} dataSource={requests} pagination={false} scroll={{ x: 700 }} />
            </>
          )}
        </Card>
      )}

      {room.status === 'RENTED' && (
        <Card title="Thông tin hợp đồng" style={{ marginTop: 16 }}>
          {contract ? (
            <Descriptions bordered column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Loại hợp đồng">
                <Tag color={contract.rental_type === 'DAILY' ? 'purple' : 'blue'}>
                  {contract.rental_type === 'DAILY' ? 'Thuê theo ngày' : 'Thuê theo tháng'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Khách thuê">{contract.tenant_name}</Descriptions.Item>
              <Descriptions.Item label="SĐT">{contract.tenant_phone}</Descriptions.Item>
              {contract.rental_type === 'DAILY' ? (
                <Descriptions.Item label="Đơn giá thuê ngày">{vnd(contract.daily_fee)}/ngày</Descriptions.Item>
              ) : (
                <Descriptions.Item label="Tiền cọc">{vnd(contract.deposit)}</Descriptions.Item>
              )}
              <Descriptions.Item label="Ngày bắt đầu">{fmtDate(contract.start_date)}</Descriptions.Item>
              <Descriptions.Item label="Ngày kết thúc">{fmtDate(contract.end_date)}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Empty description="Không tìm thấy hợp đồng đang hiệu lực." />
          )}
        </Card>
      )}

      <Modal
        title={`Duyệt yêu cầu của ${approving?.tenant_name || ''}`}
        open={!!approving}
        onCancel={() => setApproving(null)}
        onOk={async () => { const b = approving; setApproving(null); await handleApprove(b); }}
        okText="Duyệt" cancelText="Hủy"
      >
        <p>Phòng sẽ chuyển sang Đang thuê và các yêu cầu còn lại của phòng này tự động bị từ chối.</p>
        <div style={{ marginBottom: 4 }}>Tiền cọc (đ)</div>
        <InputNumber {...moneyInputProps} value={approveDeposit} onChange={(v) => setApproveDeposit(v || 0)} />
      </Modal>

      <Modal
        title={`Từ chối yêu cầu của ${rejecting?.tenant_name || ''}`}
        open={!!rejecting}
        onCancel={() => setRejecting(null)}
        onOk={handleReject}
        confirmLoading={busyId === rejecting?.id}
        okText="Từ chối" okButtonProps={{ danger: true }} cancelText="Hủy"
      >
        <div style={{ marginBottom: 8 }}>Lý do (không bắt buộc, khách sẽ nhìn thấy):</div>
        <Input.TextArea rows={3} maxLength={255} showCount value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
      </Modal>

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

import { useEffect, useMemo, useState } from 'react';
import {
  Button, Card, Col, DatePicker, Empty, Image, InputNumber, message, Modal,
  Radio, Row, Space, Tag, Typography,
} from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { Link } from 'react-router-dom';
import { dailyRateOf, vnd } from '../../utils/format';

const { Text, Title, Paragraph } = Typography;

function RoomImage({ src, height = 180 }) {
  if (src) {
    return <Image src={src} alt="Ảnh phòng" height={height} width="100%" style={{ objectFit: 'cover' }} />;
  }
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5', color: '#bfbfbf', fontSize: 40 }}>
      <HomeOutlined />
    </div>
  );
}

export default function TenantRooms() {
  const [rooms, setRooms] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [startDate, setStartDate] = useState(dayjs());
  const [rentalType, setRentalType] = useState('MONTHLY');
  const [days, setDays] = useState(1);
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function fetchAll() {
    setLoading(true);
    try {
      const [roomsRes, reqRes] = await Promise.all([api.get('/rooms'), api.get('/contracts/mine')]);
      setRooms(roomsRes.data);
      setRequests(reqRes.data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải dữ liệu phòng.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  const pendingRoomIds = useMemo(
    () => new Set(requests.filter((r) => r.status === 'PENDING').map((r) => r.room_id)),
    [requests],
  );
  const pendingCount = pendingRoomIds.size;

  function openRoom(room) {
    setSelectedRoom(room);
    setStartDate(dayjs());
    setDays(1);
    setMonths(1);
    setRentalType('MONTHLY');
  }

  const dailyRate = selectedRoom ? (selectedRoom.daily_rate ?? dailyRateOf(selectedRoom.price)) : 0;
  const isDaily = rentalType === 'DAILY';
  const qty = isDaily ? days : months;
  const validQty = Number.isInteger(qty) && qty >= 1 && qty <= (isDaily ? 365 : 36);
  const endDate = startDate && validQty
    ? (isDaily ? startDate.add(days - 1, 'day') : startDate.add(months, 'month').subtract(1, 'day'))
    : null;
  const totalRent = validQty && selectedRoom ? (isDaily ? dailyRate * days : Number(selectedRoom.price) * months) : 0;

  async function submitRequest() {
    if (!selectedRoom || !startDate || !validQty) return;
    setSubmitting(true);
    try {
      await api.post('/contracts/request', {
        room_id: selectedRoom.id,
        rental_type: rentalType,
        start_date: startDate.format('YYYY-MM-DD'),
        ...(isDaily ? { days } : { months }),
      });
      message.success('Đã gửi yêu cầu thuê phòng. Vui lòng chờ chủ trọ duyệt.');
      setSelectedRoom(null);
      await fetchAll();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể gửi yêu cầu thuê phòng.');
    } finally {
      setSubmitting(false);
    }
  }

  const roomsTab = rooms.length === 0 && !loading ? (
    <Empty description="Hiện không có phòng trống." />
  ) : (
    <Row gutter={[16, 16]}>
      {rooms.map((room) => {
        const requested = pendingRoomIds.has(room.id);
        return (
          <Col key={room.id} xs={24} sm={12} lg={8}>
            <Card
              hoverable
              loading={loading}
              cover={<RoomImage src={room.image_url} />}
              actions={[
                requested
                  ? <Link key="p" to="/tenant/contracts"><Tag color="gold">Đã gửi yêu cầu · chờ duyệt</Tag></Link>
                  : <Button key="rent" type="primary" onClick={() => openRoom(room)}>Thuê phòng</Button>,
              ]}
            >
              <Card.Meta
                title={<span>Phòng {room.room_number} <Text type="secondary" style={{ fontWeight: 400 }}>· Tầng {room.floor}</Text></span>}
                description={
                  <div>
                    <div style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 16 }}>
                      {vnd(room.daily_rate ?? dailyRateOf(room.price))}/ngày
                    </div>
                    <Text type="secondary">{vnd(room.price)}/tháng{room.area ? ` · ${room.area} m²` : ''}</Text>
                    <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: '8px 0 0' }}>
                      {room.description || 'Chưa có mô tả.'}
                    </Paragraph>
                  </div>
                }
              />
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Thuê phòng</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchAll}>Làm mới</Button>
      </div>

      <Paragraph type="secondary">
        Chọn phòng trống, gửi yêu cầu thuê theo ngày hoặc theo tháng. Theo dõi yêu cầu ở mục{' '}
        <Link to="/tenant/contracts">Hợp đồng của tôi</Link>.
      </Paragraph>
      {pendingCount > 0 && <Tag color="gold" style={{ marginBottom: 12 }}>{pendingCount} yêu cầu đang chờ duyệt</Tag>}
      {roomsTab}

      <Modal
        title={`Thuê phòng ${selectedRoom?.room_number || ''}`}
        open={!!selectedRoom}
        onCancel={() => setSelectedRoom(null)}
        onOk={submitRequest}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !startDate || !validQty }}
        okText="Gửi yêu cầu thuê"
        cancelText="Đóng"
        width={560}
      >
        {selectedRoom && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <RoomImage src={selectedRoom.image_url} height={220} />
            <div>
              <Text type="secondary">Tầng {selectedRoom.floor}{selectedRoom.area ? ` · ${selectedRoom.area} m²` : ''}</Text>
              <div style={{ color: '#1d4ed8', fontWeight: 600, fontSize: 18 }}>{vnd(dailyRate)}/ngày</div>
              <Text type="secondary">({vnd(selectedRoom.price)}/tháng)</Text>
              {selectedRoom.description && <Paragraph style={{ margin: '8px 0 0' }}>{selectedRoom.description}</Paragraph>}
            </div>

            <Radio.Group value={rentalType} onChange={(e) => setRentalType(e.target.value)} optionType="button" buttonStyle="solid">
              <Radio.Button value="MONTHLY">Thuê theo tháng</Radio.Button>
              <Radio.Button value="DAILY">Thuê theo ngày</Radio.Button>
            </Radio.Group>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ marginBottom: 4 }}>Ngày bắt đầu</div>
                <DatePicker
                  value={startDate}
                  onChange={setStartDate}
                  allowClear={false}
                  disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
                  format="DD/MM/YYYY"
                  style={{ width: '100%' }}
                />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <div style={{ marginBottom: 4 }}>{isDaily ? 'Số ngày thuê' : 'Số tháng thuê'}</div>
                {isDaily
                  ? <InputNumber min={1} max={365} precision={0} value={days} onChange={setDays} addonAfter="ngày" style={{ width: '100%' }} />
                  : <InputNumber min={1} max={36} precision={0} value={months} onChange={setMonths} addonAfter="tháng" style={{ width: '100%' }} />}
              </div>
            </div>

            {endDate && (
              <div style={{ lineHeight: 2, background: '#f5f7fb', padding: '8px 12px', borderRadius: 8 }}>
                <div>Thời gian thuê: <b>{startDate.format('DD/MM/YYYY')} → {endDate.format('DD/MM/YYYY')}</b> ({qty} {isDaily ? 'ngày' : 'tháng'})</div>
                <div>Tiền phòng dự kiến: <b style={{ color: '#1d4ed8' }}>{vnd(totalRent)}</b></div>
                <Text type="secondary">
                  {isDaily
                    ? 'Thuê theo ngày chỉ tính tiền phòng.'
                    : 'Thuê theo tháng: tiền điện, nước và tiền cọc do chủ trọ xác nhận khi duyệt.'} Yêu cầu sẽ được gửi cho chủ trọ duyệt.
                </Text>
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}

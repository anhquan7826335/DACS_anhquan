import { useEffect, useState } from 'react';
import { Alert, Button, DatePicker, Empty, message, Modal, Table, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../api/axios';

const { Text, Title } = Typography;

export default function TenantRooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [dates, setDates] = useState([dayjs(), dayjs()]);
  const [submitting, setSubmitting] = useState(false);

  async function fetchRooms() {
    setLoading(true);
    try {
      const { data } = await api.get('/rooms', { params: { status: 'EMPTY' } });
      setRooms(data);
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi tải danh sách phòng trống.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchRooms(); }, []);

  const rentalDays = dates?.[0] && dates?.[1] ? dates[1].diff(dates[0], 'day') + 1 : 0;
  const dailyRate = selectedRoom ? Number(selectedRoom.price) / 30 : 0;
  const totalRent = Math.round(dailyRate * rentalDays);

  async function submitRental() {
    if (!selectedRoom || !dates?.[0] || !dates?.[1]) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/contracts/daily', {
        room_id: selectedRoom.id,
        start_date: dates[0].format('YYYY-MM-DD'),
        end_date: dates[1].format('YYYY-MM-DD'),
      });
      message.success(`Thuê phòng thành công. Tiền phòng ${data.total_rent.toLocaleString('vi-VN')} đ.`);
      setSelectedRoom(null);
      await fetchRooms();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể thuê phòng.');
    } finally {
      setSubmitting(false);
    }
  }

  const columns = [
    { title: 'Phòng', dataIndex: 'room_number', key: 'room_number', render: (value) => <b>{value}</b> },
    { title: 'Tầng', dataIndex: 'floor', key: 'floor', width: 80 },
    {
      title: 'Giá thuê ngày',
      dataIndex: 'price',
      key: 'daily_rate',
      render: (price) => `${(Number(price) / 30).toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/ngày`,
    },
    { title: 'Diện tích', dataIndex: 'area', key: 'area', render: (value) => value ? `${value} m²` : '-' },
    { title: 'Mô tả', dataIndex: 'description', key: 'description', render: (value) => value || '-' },
    {
      title: '',
      key: 'action',
      render: (_, room) => <Button type="primary" onClick={() => setSelectedRoom(room)}>Chọn thuê</Button>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Thuê phòng theo ngày</Title>
        <Button icon={<ReloadOutlined />} onClick={fetchRooms}>Làm mới</Button>
      </div>
      {rooms.length === 0 && !loading ? (
        <Empty description="Hiện không có phòng trống." />
      ) : (
        <Table rowKey="id" columns={columns} dataSource={rooms} loading={loading} bordered scroll={{ x: 700 }} />
      )}
      <Modal
        title={`Đặt thuê phòng ${selectedRoom?.room_number || ''}`}
        open={!!selectedRoom}
        onCancel={() => setSelectedRoom(null)}
        onOk={submitRental}
        confirmLoading={submitting}
        okButtonProps={{ disabled: !dates?.[0] || !dates?.[1] }}
        okText="Xác nhận thuê"
        cancelText="Hủy"
      >
        {selectedRoom && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">Chọn thời gian thuê (tính cả ngày bắt đầu và ngày kết thúc):</Text>
            </div>
            <DatePicker.RangePicker
              value={dates}
              onChange={setDates}
              disabledDate={(date) => date.isBefore(dayjs().startOf('day'))}
              format="DD/MM/YYYY"
              style={{ width: '100%', marginBottom: 16 }}
            />
            {rentalDays > 0 && (
              <div style={{ lineHeight: 2 }}>
                <div>Giá/ngày: <b>{dailyRate.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ</b></div>
                <div>Số ngày thuê: <b>{rentalDays} ngày</b></div>
                <div>Tổng tiền phòng: <b>{totalRent.toLocaleString('vi-VN')} đ</b></div>
                <Text type="secondary">Điện: 0 đ · Nước: 0 đ · Phí dịch vụ: 0 đ</Text>
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}

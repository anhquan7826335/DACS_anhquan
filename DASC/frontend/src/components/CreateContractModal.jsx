import { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, DatePicker, message, AutoComplete, Radio, Select } from 'antd';
import api from '../api/axios';
import dayjs from 'dayjs';

export default function CreateContractModal({ open, onClose, room, onSuccess }) {
  const [form] = Form.useForm();
  const [tenantOptions, setTenantOptions] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [emptyRooms, setEmptyRooms] = useState([]);

  // Không truyền sẵn phòng (mở từ trang Hợp đồng): cho admin chọn trong các phòng đang trống
  useEffect(() => {
    if (!open || room) return;
    api.get('/rooms', { params: { status: 'EMPTY' } })
      .then(({ data }) => setEmptyRooms(data))
      .catch(() => message.error('Không tải được danh sách phòng trống.'));
  }, [open, room]);

  async function searchTenant(keyword) {
    if (!keyword || keyword.length < 3) { setTenantOptions([]); return; }
    try {
      const { data } = await api.get('/auth/tenant-lookup', { params: { keyword } });
      setTenantOptions(
        data.map((t) => ({ value: `${t.full_name} — ${t.email} — ${t.phone}`, tenant: t }))
      );
    } catch {
      // im lặng bỏ qua lỗi tìm kiếm
    }
  }

  function handleSelectTenant(_, option) {
    setSelectedTenant(option.tenant);
  }

  async function handleSubmit(values) {
    if (!selectedTenant) {
      message.warning('Vui lòng tìm và chọn đúng khách thuê (đã có tài khoản đăng ký).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/contracts', {
        room_id: room ? room.id : values.room_id,
        tenant_id: selectedTenant.id,
        deposit: values.deposit,
        rental_type: values.rental_type,
        start_date: values.dates[0].format('YYYY-MM-DD'),
        end_date: values.dates[1].format('YYYY-MM-DD'),
      });
      message.success('Tạo hợp đồng thành công!');
      form.resetFields();
      setSelectedTenant(null);
      setTenantOptions([]);
      onSuccess?.();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo hợp đồng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={room ? `Tạo hợp đồng - Phòng ${room.room_number}` : 'Tạo hợp đồng'}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Tạo hợp đồng"
      width={560}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
        {!room && (
          <Form.Item name="room_id" label="Phòng (đang trống)" rules={[{ required: true, message: 'Chọn phòng' }]}>
            <Select
              placeholder={emptyRooms.length ? 'Chọn phòng' : 'Hiện không có phòng trống'}
              options={emptyRooms.map((r) => ({ value: r.id, label: `Phòng ${r.room_number} · tầng ${r.floor}` }))}
            />
          </Form.Item>
        )}
        <Form.Item label="Tìm khách thuê (theo email hoặc SĐT đã đăng ký)" required>
          <AutoComplete
            options={tenantOptions}
            onSearch={searchTenant}
            onSelect={handleSelectTenant}
            placeholder="Nhập ít nhất 3 ký tự email hoặc SĐT..."
          />
        </Form.Item>
        {selectedTenant && (
          <div style={{ marginBottom: 16, padding: 8, background: '#f0f5ff', borderRadius: 6 }}>
            Đã chọn: <b>{selectedTenant.full_name}</b> — {selectedTenant.email}
          </div>
        )}
        <Form.Item name="rental_type" label="Hình thức thuê" initialValue="MONTHLY">
          <Radio.Group optionType="button" buttonStyle="solid"
            options={[{ value: 'MONTHLY', label: 'Theo tháng' }, { value: 'DAILY', label: 'Theo ngày' }]} />
        </Form.Item>
        <Form.Item name="deposit" label="Tiền cọc (đ)" rules={[{ required: true }]} initialValue={0}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item
          name="dates"
          label="Thời hạn hợp đồng"
          rules={[{ required: true, message: 'Chọn ngày bắt đầu và kết thúc' }]}
          initialValue={[dayjs(), dayjs().add(1, 'year')]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

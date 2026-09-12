import { useState } from 'react';
import { Modal, Form, Input, InputNumber, DatePicker, message, AutoComplete } from 'antd';
import api from '../api/axios';
import dayjs from 'dayjs';

export default function CreateContractModal({ open, onClose, room, onSuccess }) {
  const [form] = Form.useForm();
  const [tenantOptions, setTenantOptions] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [submitting, setSubmitting] = useState(false);

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
    form.setFieldsValue({ tenant_phone: option.tenant.phone, tenant_cccd: option.tenant.cccd });
  }

  async function handleSubmit(values) {
    if (!selectedTenant) {
      message.warning('Vui lòng tìm và chọn đúng khách thuê (đã có tài khoản đăng ký).');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/contracts', {
        room_id: room.id,
        tenant_id: selectedTenant.id,
        deposit: values.deposit,
        electricity_rate: values.electricity_rate,
        water_rate: values.water_rate,
        service_fee: values.service_fee || 0,
        tenant_phone: values.tenant_phone,
        tenant_cccd: values.tenant_cccd,
        start_date: values.dates[0].format('YYYY-MM-DD'),
        end_date: values.dates[1].format('YYYY-MM-DD'),
      });
      message.success('Tạo hợp đồng thành công!');
      form.resetFields();
      setSelectedTenant(null);
      onSuccess?.();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo hợp đồng.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Tạo hợp đồng thuê - Phòng ${room?.room_number}`}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Tạo hợp đồng"
      width={560}
    >
      <Form layout="vertical" form={form} onFinish={handleSubmit}>
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
        <Form.Item name="tenant_phone" label="SĐT khách thuê" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="tenant_cccd" label="CCCD khách thuê" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="deposit" label="Tiền cọc (đ)" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="electricity_rate" label="Đơn giá điện (đ/kWh)" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 3500" />
        </Form.Item>
        <Form.Item name="water_rate" label="Đơn giá nước (đ/m³)" rules={[{ required: true }]}>
          <InputNumber min={0} style={{ width: '100%' }} placeholder="VD: 15000" />
        </Form.Item>
        <Form.Item name="service_fee" label="Phí dịch vụ khác (đ/tháng)">
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

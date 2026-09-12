import { useState } from 'react';
import {
  Modal, Form, InputNumber, DatePicker, message, Tabs, Upload, Button,
  Alert, Spin, Descriptions, Divider,
} from 'antd';
import { UploadOutlined, CameraOutlined, ScanOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';

export default function CreateInvoiceModal({ open, onClose, room, contract, onSuccess }) {
  const [form] = Form.useForm();
  const [method, setMethod] = useState('manual'); // manual | camera | upload
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { qr_url, transfer_content, total_amount }

  function resetAll() {
    form.resetFields();
    setScanResult(null);
    setResult(null);
    setMethod('manual');
  }

  async function handleScan(file) {
    setScanning(true);
    setScanResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/invoices/scan-bill', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setScanResult(data);
      form.setFieldsValue({
        new_electricity: data.new_electricity ?? undefined,
        new_water: data.new_water ?? undefined,
      });
      message.success('AI đã đọc xong chỉ số, vui lòng kiểm tra lại trước khi lưu.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi quét ảnh/PDF bằng AI.');
    } finally {
      setScanning(false);
    }
    return false; // ngăn Upload tự động submit form thật
  }

  async function handleSubmit(values) {
    setSubmitting(true);
    try {
      const { data } = await api.post('/invoices', {
        contract_id: contract.id,
        month: values.period.month() + 1,
        year: values.period.year(),
        old_electricity: values.old_electricity,
        new_electricity: values.new_electricity,
        old_water: values.old_water,
        new_water: values.new_water,
        other_fee: values.other_fee || 0,
        due_date: values.due_date.format('YYYY-MM-DD'),
        bill_file_url: scanResult?.bill_file_url,
      });
      setResult(data);
      message.success('Tạo hóa đơn thành công!');
      onSuccess?.();
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể tạo hóa đơn.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      title={`Chốt điện nước & Tạo hóa đơn - Phòng ${room?.room_number}`}
      open={open}
      onCancel={() => { resetAll(); onClose(); }}
      footer={result ? null : undefined}
      onOk={() => form.submit()}
      confirmLoading={submitting}
      okText="Tạo hóa đơn"
      width={600}
    >
      {result ? (
        <div style={{ textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 12 }} />
          <p>Đã tạo hóa đơn với tổng tiền <b>{result.total_amount.toLocaleString('vi-VN')} đ</b></p>
          <img src={result.qr_url} alt="VietQR" style={{ width: 220, marginBottom: 12 }} />
          <p>Nội dung chuyển khoản: <b>{result.transfer_content}</b></p>
          <Button type="primary" onClick={() => { resetAll(); onClose(); }}>Đóng</Button>
        </div>
      ) : (
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          <Form.Item name="period" label="Kỳ hóa đơn (Tháng/Năm)" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="due_date" label="Hạn thanh toán" rules={[{ required: true }]} initialValue={dayjs().add(10, 'day')}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Divider orientation="left" plain>Chỉ số cũ (kỳ trước)</Divider>
          <div style={{ display: 'flex', gap: 16 }}>
            <Form.Item name="old_electricity" label="Điện cũ (kWh)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="old_water" label="Nước cũ (m³)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Divider orientation="left" plain>Chỉ số mới — chọn 1 trong 3 cách</Divider>
          <Tabs
            activeKey={method}
            onChange={setMethod}
            items={[
              { key: 'manual', label: 'Gõ tay' },
              { key: 'camera', label: <span><CameraOutlined /> Chụp ảnh công tơ</span> },
              { key: 'upload', label: <span><UploadOutlined /> Upload ảnh/PDF hóa đơn</span> },
            ]}
          />

          {method === 'manual' && (
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <Form.Item name="new_electricity" label="Điện mới (kWh)" rules={[{ required: true }]} style={{ flex: 1 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name="new_water" label="Nước mới (m³)" rules={[{ required: true }]} style={{ flex: 1 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>
          )}

          {(method === 'camera' || method === 'upload') && (
            <div style={{ marginTop: 12 }}>
              <Upload.Dragger
                accept={method === 'camera' ? 'image/*' : 'image/*,application/pdf'}
                capture={method === 'camera' ? 'environment' : undefined}
                beforeUpload={handleScan}
                showUploadList={false}
                maxCount={1}
              >
                <p className="ant-upload-drag-icon"><ScanOutlined /></p>
                <p>
                  {method === 'camera'
                    ? 'Bấm để chụp ảnh công tơ điện/nước'
                    : 'Kéo thả hoặc bấm để chọn file ảnh/PDF hóa đơn gốc'}
                </p>
                <p className="ant-upload-hint">AI sẽ tự động đọc chỉ số và điền vào ô bên dưới</p>
              </Upload.Dragger>

              {scanning && <Spin style={{ marginTop: 12 }} tip="AI đang đọc chỉ số..." />}

              {scanResult && (
                <Alert
                  style={{ marginTop: 12 }}
                  type={scanResult.confidence === 'LOW' ? 'warning' : 'success'}
                  message={`Độ tin cậy AI: ${scanResult.confidence || 'N/A'}`}
                  description="Vui lòng đối chiếu lại chỉ số AI đọc được trước khi lưu hóa đơn."
                />
              )}

              <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
                <Form.Item name="new_electricity" label="Điện mới (kWh) — AI đã điền, có thể sửa" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="new_water" label="Nước mới (m³) — AI đã điền, có thể sửa" rules={[{ required: true }]} style={{ flex: 1 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </div>
            </div>
          )}

          <Form.Item name="other_fee" label="Phí phát sinh khác (đ)" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          {contract && (
            <Descriptions size="small" bordered column={1} style={{ marginTop: 12 }}>
              <Descriptions.Item label="Đơn giá điện">{contract.electricity_rate?.toLocaleString('vi-VN')} đ/kWh</Descriptions.Item>
              <Descriptions.Item label="Đơn giá nước">{contract.water_rate?.toLocaleString('vi-VN')} đ/m³</Descriptions.Item>
              <Descriptions.Item label="Phí dịch vụ">{Number(contract.service_fee || 0).toLocaleString('vi-VN')} đ</Descriptions.Item>
            </Descriptions>
          )}
        </Form>
      )}
    </Modal>
  );
}

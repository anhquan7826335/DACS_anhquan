import { useState } from 'react';
import {
  Modal, Form, InputNumber, DatePicker, message, Tabs, Upload, Button,
  Alert, Spin, Descriptions, Divider, Select,
} from 'antd';
import { UploadOutlined, ScanOutlined, CheckCircleOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api/axios';
import { fmtDate, moneyInputProps, vnd } from '../utils/format';

/**
 * Tạo hóa đơn: điện, nước và phụ phí đều nhập bằng SỐ TIỀN (VNĐ), không nhập chỉ số công tơ.
 * Hóa đơn thuê theo ngày chỉ tính tiền phòng theo số ngày thuê.
 *
 * Hai cách dùng:
 *  - Từ trang chi tiết phòng: truyền sẵn `room` + `contract`.
 *  - Từ trang Hóa đơn: truyền `contracts` (danh sách hợp đồng đang hiệu lực) để admin tự chọn hợp đồng
 *    (thuê tháng hoặc thuê ngày) trong form.
 */
export default function CreateInvoiceModal({ open, onClose, room: roomProp, contract: contractProp, contracts, onSuccess }) {
  const [form] = Form.useForm();
  const pickedId = Form.useWatch('contract_id', form);
  const contract = contractProp || contracts?.find((c) => c.id === pickedId) || null;
  const room = roomProp || (contract ? { room_number: contract.room_number, price: contract.room_price } : null);
  const isDailyRental = contract?.rental_type === 'DAILY';
  const [method, setMethod] = useState('manual'); // manual | scan
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { qr_url, transfer_content, total_amount }

  const electricity = Form.useWatch('electricity', form);
  const water = Form.useWatch('water', form);
  const otherFee = Form.useWatch('other_fee', form);
  const roomFee = Number(contract?.monthly_fee ?? room?.price ?? 0);
  const estimatedTotal = roomFee + Number(electricity || 0) + Number(water || 0) + Number(otherFee || 0);

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
        electricity: data.electricity_amount ?? undefined,
        water: data.water_amount ?? undefined,
      });
      message.success('AI đã đọc xong số tiền, vui lòng kiểm tra lại trước khi lưu.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi quét ảnh/PDF bằng AI.');
    } finally {
      setScanning(false);
    }
    return false; // ngăn Upload tự động submit
  }

  function handlePickContract(id) {
    const picked = contracts?.find((c) => c.id === id);
    // Hợp đồng ngày: gợi ý sẵn kỳ hóa đơn là tháng bắt đầu thuê
    if (picked?.rental_type === 'DAILY') form.setFieldsValue({ period: dayjs(picked.start_date) });
  }

  async function handleSubmit(values) {
    if (!contract) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/invoices', {
        contract_id: contract.id,
        month: values.period.month() + 1,
        year: values.period.year(),
        electricity: isDailyRental ? 0 : values.electricity,
        water: isDailyRental ? 0 : values.water,
        other_fee: isDailyRental ? 0 : values.other_fee || 0,
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
      title={`${isDailyRental ? 'Tạo hóa đơn thuê ngày' : 'Tạo hóa đơn'}${room ? ` - Phòng ${room.room_number}` : ''}`}
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
          <p>Đã tạo hóa đơn với tổng tiền <b>{vnd(result.total_amount)}</b></p>
          <img src={result.qr_url} alt="VietQR" style={{ width: 220, marginBottom: 12 }} />
          <p>Nội dung chuyển khoản: <b>{result.transfer_content}</b></p>
          <Button type="primary" onClick={() => { resetAll(); onClose(); }}>Đóng</Button>
        </div>
      ) : (
        <Form layout="vertical" form={form} onFinish={handleSubmit}>
          {contracts && !contractProp && (
            <Form.Item name="contract_id" label="Hợp đồng / phòng" rules={[{ required: true, message: 'Chọn hợp đồng cần lập hóa đơn' }]}>
              <Select
                showSearch
                placeholder={contracts.length ? 'Chọn phòng đang thuê' : 'Chưa có hợp đồng nào đang hiệu lực'}
                optionFilterProp="label"
                onChange={handlePickContract}
                options={contracts.map((c) => ({
                  value: c.id,
                  label: `Phòng ${c.room_number} — ${c.tenant_name} (${c.rental_type === 'DAILY' ? `thuê ngày ${fmtDate(c.start_date)} → ${fmtDate(c.end_date)}` : 'thuê tháng'})`,
                }))}
              />
            </Form.Item>
          )}
          <Form.Item name="period" label="Kỳ hóa đơn (Tháng/Năm)" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker picker="month" format="MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="due_date" label="Hạn thanh toán" rules={[{ required: true }]} initialValue={dayjs().add(10, 'day')}>
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          {!contract ? (
            <Alert type="info" showIcon message="Chọn hợp đồng để nhập tiền điện, nước và phụ phí (thuê tháng) hoặc xem cách tính (thuê ngày)." />
          ) : isDailyRental ? (
            <Alert
              type="info"
              showIcon
              message="Hóa đơn thuê ngày chỉ tính tiền phòng theo số ngày thuê nằm trong kỳ; tiền điện, nước và phụ phí bằng 0."
              description={`Thời gian thuê: ${fmtDate(contract.start_date)} → ${fmtDate(contract.end_date)}. Chọn kỳ hóa đơn (tháng/năm) nằm trong khoảng này.`}
            />
          ) : (
            <>
              <Divider orientation="left" plain>Tiền điện, nước — nhập số tiền (VNĐ)</Divider>
              <Tabs
                activeKey={method}
                onChange={setMethod}
                items={[
                  { key: 'manual', label: <span><EditOutlined /> Nhập tay</span> },
                  { key: 'scan', label: <span><UploadOutlined /> Chụp / tải hóa đơn điện nước (AI đọc số tiền)</span> },
                ]}
              />

              {method === 'scan' && (
                <div style={{ marginBottom: 12 }}>
                  <Upload.Dragger
                    accept="image/*,application/pdf"
                    beforeUpload={handleScan}
                    showUploadList={false}
                    maxCount={1}
                  >
                    <p className="ant-upload-drag-icon"><ScanOutlined /></p>
                    <p>Kéo thả hoặc bấm để chọn ảnh/PDF hóa đơn tiền điện, tiền nước</p>
                    <p className="ant-upload-hint">AI sẽ đọc số tiền phải thanh toán và điền vào các ô bên dưới</p>
                  </Upload.Dragger>

                  {scanning && <Spin style={{ marginTop: 12 }} tip="AI đang đọc hóa đơn..." />}

                  {scanResult && (
                    <Alert
                      style={{ marginTop: 12 }}
                      type={scanResult.confidence === 'LOW' ? 'warning' : 'success'}
                      message={`Độ tin cậy AI: ${scanResult.confidence || 'N/A'}`}
                      description="Vui lòng đối chiếu lại số tiền AI đọc được trước khi lưu hóa đơn."
                    />
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <Form.Item name="electricity" label="Tiền điện (đ)" rules={[{ required: true, message: 'Nhập tiền điện' }]} style={{ flex: '1 1 200px' }}>
                  <InputNumber {...moneyInputProps} placeholder="VD: 350000" />
                </Form.Item>
                <Form.Item name="water" label="Tiền nước (đ)" rules={[{ required: true, message: 'Nhập tiền nước' }]} style={{ flex: '1 1 200px' }}>
                  <InputNumber {...moneyInputProps} placeholder="VD: 100000" />
                </Form.Item>
              </div>
              <Form.Item name="other_fee" label="Phụ phí khác (đ)" initialValue={0}>
                <InputNumber {...moneyInputProps} />
              </Form.Item>
            </>
          )}

          {contract && (
            <Descriptions size="small" bordered column={1} style={{ marginTop: 12 }}>
              {isDailyRental ? (
                <Descriptions.Item label="Đơn giá thuê ngày">{vnd(contract.daily_fee)}/ngày</Descriptions.Item>
              ) : (
                <>
                  <Descriptions.Item label="Tiền phòng">{vnd(roomFee)}</Descriptions.Item>
                  <Descriptions.Item label="Tổng dự kiến">
                    <b style={{ color: '#1d4ed8' }}>{vnd(estimatedTotal)}</b>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          )}
        </Form>
      )}
    </Modal>
  );
}

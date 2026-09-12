import { useEffect, useState } from 'react';
import {
  Card, Typography, Upload, Button, Form, Input, Select, message, Spin, Alert,
  List, Tag, Empty,
} from 'antd';
import { CameraOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Title } = Typography;
const severityColor = { LOW: 'blue', MEDIUM: 'orange', HIGH: 'red' };
const severityLabel = { LOW: 'Thấp', MEDIUM: 'Trung bình', HIGH: 'Khẩn cấp' };
const statusColor = { PENDING: 'default', IN_PROGRESS: 'processing', RESOLVED: 'success' };
const statusLabel = { PENDING: 'Chờ xử lý', IN_PROGRESS: 'Đang xử lý', RESOLVED: 'Đã xử lý' };

export default function TenantTicket() {
  const [form] = Form.useForm();
  const [contract, setContract] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [myTickets, setMyTickets] = useState([]);

  async function fetchContract() {
    try {
      const { data } = await api.get('/contracts/my');
      setContract(data);
    } catch {
      setContract(null);
    }
  }

  // Không có API riêng "GET /tickets/my" trong spec gốc, nên tenant chỉ thấy phiếu vừa gửi trong phiên này.
  useEffect(() => { fetchContract(); }, []);

  async function handleAnalyze(file) {
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/tickets/analyze-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysis(data);
      setImageUrl(data.image_url);
      form.setFieldsValue({
        title: data.title,
        description: data.summary_vi,
        severity: data.severity,
      });
      message.success('AI đã phân tích xong sự cố, vui lòng kiểm tra và bấm Gửi.');
    } catch (err) {
      message.error(err.response?.data?.message || 'Lỗi khi phân tích ảnh sự cố.');
    } finally {
      setAnalyzing(false);
    }
    return false;
  }

  async function handleSubmit(values) {
    if (!contract) {
      message.warning('Bạn cần có hợp đồng đang hiệu lực để báo sự cố.');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/tickets', {
        room_id: contract.room_id,
        title: values.title,
        description: values.description,
        image_url: imageUrl,
        severity: values.severity,
      });
      message.success('Đã gửi báo cáo sự cố thành công!');
      setMyTickets((prev) => [
        { id: data.id, title: values.title, description: values.description, severity: values.severity, status: 'PENDING', image_url: imageUrl },
        ...prev,
      ]);
      form.resetFields();
      setAnalysis(null);
      setImageUrl(null);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không thể gửi báo cáo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Title level={3}>Báo cáo Sự cố</Title>

      {!contract && (
        <Alert type="warning" showIcon message="Bạn hiện không có hợp đồng thuê đang hiệu lực nên chưa thể báo sự cố." style={{ marginBottom: 16 }} />
      )}

      <Card title="Chụp ảnh sự cố — AI sẽ tự phân tích và điền biểu mẫu">
        <Upload.Dragger
          accept="image/*"
          capture="environment"
          beforeUpload={handleAnalyze}
          showUploadList={false}
          maxCount={1}
          disabled={!contract}
        >
          <p className="ant-upload-drag-icon"><CameraOutlined /></p>
          <p>Bấm để chụp ảnh hoặc chọn ảnh chỗ hỏng</p>
          <p className="ant-upload-hint">AI sẽ chẩn đoán thiết bị, mức độ khẩn cấp và điền sẵn nội dung</p>
        </Upload.Dragger>

        {analyzing && <Spin style={{ marginTop: 16 }} tip="AI đang phân tích ảnh sự cố..." />}

        {imageUrl && !analyzing && (
          <img src={imageUrl} alt="Sự cố" style={{ width: 160, marginTop: 16, borderRadius: 8 }} />
        )}

        <Form layout="vertical" form={form} onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Tiêu đề" rules={[{ required: true, message: 'Nhập tiêu đề sự cố' }]}>
            <Input placeholder="VD: Vòi nước bị rò rỉ" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả chi tiết">
            <Input.TextArea rows={3} placeholder="Mô tả thêm nếu cần..." />
          </Form.Item>
          <Form.Item name="severity" label="Mức độ khẩn cấp" initialValue="MEDIUM" rules={[{ required: true }]}>
            <Select options={Object.keys(severityLabel).map((k) => ({ value: k, label: severityLabel[k] }))} />
          </Form.Item>
          <Button type="primary" icon={<SendOutlined />} htmlType="submit" loading={submitting} disabled={!contract}>
            Gửi báo cáo
          </Button>
        </Form>
      </Card>

      <Card title="Báo cáo đã gửi trong phiên này" style={{ marginTop: 16 }}>
        {myTickets.length === 0 ? (
          <Empty description="Chưa có báo cáo nào." />
        ) : (
          <List
            dataSource={myTickets}
            renderItem={(t) => (
              <List.Item extra={t.image_url && <img src={t.image_url} width={60} style={{ borderRadius: 6 }} />}>
                <List.Item.Meta
                  title={<span>{t.title} <Tag color={severityColor[t.severity]}>{severityLabel[t.severity]}</Tag></span>}
                  description={t.description}
                />
                <Tag color={statusColor[t.status]}>{statusLabel[t.status]}</Tag>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  );
}

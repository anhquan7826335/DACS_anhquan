import { useEffect, useState } from 'react';
import {
  Card, Typography, Upload, Button, Form, Input, Select, message, Spin, Alert,
  List, Tag, Empty,
} from 'antd';
import { CameraOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../api/axios';

const { Title, Text } = Typography;
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
        title: data.title || 'Báo cáo sự cố',
        severity: data.severity,
      });
      message.success('Đã nhận ảnh. Bạn có thể nhập mô tả thêm rồi bấm Gửi cho chủ trọ.');
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
    if (!imageUrl) {
      message.warning('Vui lòng chụp hoặc chọn ảnh sự cố trước khi gửi.');
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

      <Card title="Chụp ảnh sự cố trước, sau đó nhập mô tả nếu cần">
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
          <p className="ant-upload-hint">Ảnh giúp chủ trọ hiểu sự cố nhanh hơn. Bạn có thể nhập thêm mô tả bên dưới.</p>
        </Upload.Dragger>

        {analyzing && <Spin style={{ marginTop: 16 }} tip="AI đang phân tích ảnh sự cố..." />}

        {imageUrl && !analyzing && (
          <img src={imageUrl} alt="Sự cố" style={{ width: 160, marginTop: 16, borderRadius: 8 }} />
        )}

        {analysis?.should_call_landlord_urgently && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 16 }}
            message="Tình huống khẩn cấp!"
            description="Vui lòng gọi ngay cho chủ trọ thay vì chỉ gửi báo cáo, để được xử lý kịp thời."
          />
        )}

        {analysis?.is_safety_risk && !analysis?.should_call_landlord_urgently && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
            message="Lưu ý an toàn"
            description="Sự cố này có thể gây nguy hiểm nếu không xử lý cẩn thận, xem hướng dẫn bên dưới."
          />
        )}

        {analysis?.immediate_actions?.length > 0 && (
          <Card size="small" title="AI gợi ý: Bạn có thể làm ngay bây giờ" style={{ marginTop: 16, background: '#f0f5ff' }}>
            <List
              size="small"
              dataSource={analysis.immediate_actions}
              renderItem={(action, idx) => (
                <List.Item>
                  <Text><b>{idx + 1}.</b> {action}</Text>
                </List.Item>
              )}
            />
          </Card>
        )}

        <Form layout="vertical" form={form} onFinish={handleSubmit} style={{ marginTop: 16 }}>
          <Form.Item name="title" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Mô tả chi tiết">
            <Input.TextArea rows={3} placeholder="Nhập mô tả thêm nếu bạn muốn (không bắt buộc)..." />
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

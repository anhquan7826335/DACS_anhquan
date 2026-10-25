import { useEffect, useState } from 'react';
import { Button, Card, Col, DatePicker, message, Radio, Row, Space, Statistic, Table, Tabs, Typography } from 'antd';
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import dayjs from 'dayjs';
import api from '../../api/axios';
import { downloadFile, vnd } from '../../utils/format';

const { Title, Text } = Typography;
const short = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(1)}tr` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : v);

export default function Reports() {
  const [range, setRange] = useState([dayjs().startOf('year'), dayjs()]);
  const [basis, setBasis] = useState('paid');
  const [group, setGroup] = useState('month');
  const [chartType, setChartType] = useState('bar');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const params = () => ({
    from: range[0].format('YYYY-MM-DD'), to: range[1].format('YYYY-MM-DD'), basis, group,
  });

  async function fetchData() {
    if (!range?.[0] || !range?.[1]) return;
    setLoading(true);
    try {
      const { data: d } = await api.get('/reports/revenue', { params: params() });
      setData(d);
    } catch (err) {
      message.error(err.response?.data?.message || 'Không tải được báo cáo.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { fetchData(); }, [range, basis, group]);

  async function exportXlsx() {
    try {
      await downloadFile(api, '/reports/revenue/export', params(), 'doanh-thu.xlsx');
    } catch {
      message.error('Không xuất được file Excel.');
    }
  }

  const s = data?.summary;
  const keyLabel = data?.group === 'day' ? 'Ngày' : 'Tháng';
  const columns = [
    { title: keyLabel, dataIndex: 'key', key: 'key' },
    { title: 'Số HĐ', dataIndex: 'invoices', key: 'invoices', align: 'center' },
    { title: 'Tiền phòng', dataIndex: 'room_fee', key: 'room_fee', render: vnd },
    { title: 'Tiền điện', dataIndex: 'electricity_fee', key: 'e', render: vnd },
    { title: 'Tiền nước', dataIndex: 'water_fee', key: 'w', render: vnd },
    { title: 'Phụ phí', dataIndex: 'other_fee', key: 'o', render: vnd },
    { title: 'Phát sinh', dataIndex: 'billed', key: 'billed', render: (v) => <b>{vnd(v)}</b> },
    { title: 'Đã thu', dataIndex: 'collected', key: 'collected', render: (v) => <b style={{ color: '#389e0d' }}>{vnd(v)}</b> },
  ];
  const chartData = data?.series || [];

  const chart = (
    <ResponsiveContainer width="100%" height={340}>
      {chartType === 'bar' ? (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="key" /><YAxis tickFormatter={short} width={55} />
          <Tooltip formatter={(v) => vnd(v)} /><Legend />
          {basis === 'period' && <Bar dataKey="billed" name="Phát sinh" fill="#1d4ed8" />}
          <Bar dataKey="collected" name="Đã thu" fill="#52c41a" />
        </BarChart>
      ) : (
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="key" /><YAxis tickFormatter={short} width={55} />
          <Tooltip formatter={(v) => vnd(v)} /><Legend />
          {basis === 'period' && <Line type="monotone" dataKey="billed" name="Phát sinh" stroke="#1d4ed8" />}
          <Line type="monotone" dataKey="collected" name="Đã thu" stroke="#52c41a" />
        </LineChart>
      )}
    </ResponsiveContainer>
  );

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>Báo cáo doanh thu</Title>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Làm mới</Button>
          <Button type="primary" icon={<DownloadOutlined />} onClick={exportXlsx}>Xuất Excel</Button>
        </Space>
      </div>

      <Space wrap size={16} style={{ marginBottom: 16 }}>
        <DatePicker.RangePicker value={range} onChange={(v) => v && setRange(v)} allowClear={false} format="DD/MM/YYYY" />
        <Radio.Group value={basis} onChange={(e) => setBasis(e.target.value)} optionType="button" buttonStyle="solid"
          options={[{ value: 'paid', label: 'Theo ngày thực thu' }, { value: 'period', label: 'Theo kỳ hóa đơn' }]} />
        {basis === 'paid' && (
          <Radio.Group value={group} onChange={(e) => setGroup(e.target.value)} optionType="button"
            options={[{ value: 'month', label: 'Theo tháng' }, { value: 'day', label: 'Theo ngày' }]} />
        )}
      </Space>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="Đã thu" value={s?.collected || 0} suffix="đ" valueStyle={{ color: '#389e0d' }} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title={basis === 'paid' ? 'Hóa đơn đã thu' : 'Tổng phát sinh'} value={basis === 'paid' ? s?.invoices || 0 : s?.billed || 0} suffix={basis === 'paid' ? 'hóa đơn' : 'đ'} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title={basis === 'paid' ? 'Chưa thu (hạn trong kỳ)' : 'Chưa thu'} value={s?.outstanding || 0} suffix="đ" valueStyle={{ color: '#cf1322' }} /></Card></Col>
        <Col xs={12} md={6}>
          <Card>
            <Text type="secondary">Cơ cấu</Text>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              Phòng: <b>{vnd(s?.components.room_fee)}</b><br />
              Điện: <b>{vnd(s?.components.electricity_fee)}</b> · Nước: <b>{vnd(s?.components.water_fee)}</b><br />
              Phụ phí: <b>{vnd(s?.components.other_fee)}</b>
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs
        items={[
          {
            key: 'chart', label: 'Biểu đồ',
            children: (
              <Card loading={loading}>
                <Radio.Group value={chartType} onChange={(e) => setChartType(e.target.value)} style={{ marginBottom: 12 }}
                  options={[{ value: 'bar', label: 'Cột' }, { value: 'line', label: 'Đường' }]} optionType="button" />
                {chartData.length ? chart : <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Không có dữ liệu trong khoảng đã chọn.</div>}
              </Card>
            ),
          },
          { key: 'table', label: 'Bảng theo thời gian', children: <Table rowKey="key" columns={columns} dataSource={chartData} loading={loading} bordered pagination={{ pageSize: 15 }} scroll={{ x: 900 }} /> },
          {
            key: 'rooms', label: 'Theo phòng',
            children: <Table rowKey="room_number" loading={loading} bordered dataSource={data?.by_room || []} columns={[
              { title: 'Phòng', dataIndex: 'room_number', key: 'r', render: (v) => <b>{v}</b> },
              { title: 'Số HĐ', dataIndex: 'invoices', key: 'i', align: 'center' },
              { title: 'Phát sinh', dataIndex: 'billed', key: 'b', render: vnd },
              { title: 'Đã thu', dataIndex: 'collected', key: 'c', render: (v) => <b>{vnd(v)}</b> },
            ]} />,
          },
        ]}
      />
    </div>
  );
}

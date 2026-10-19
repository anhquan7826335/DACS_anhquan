import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Spin, Typography, message } from 'antd';
import { CustomerServiceOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import '../css/Support.css';

const { Title, Text } = Typography;

function getHistoryStorageKey(userId) {
  return `support-conversations-${userId}`;
}

function readSavedConversations(userId) {
  if (!userId) return [];

  try {
    const stored = localStorage.getItem(getHistoryStorageKey(userId));
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (conversation) =>
        conversation &&
        typeof conversation.id === 'string' &&
        Array.isArray(conversation.messages)
    );
  } catch (error) {
    console.error('Không thể đọc lịch sử hỗ trợ đã lưu:', error);
    return [];
  }
}

function createConversationId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
}

export default function Support() {
  const { user } = useAuth();
  const userId = user?.id;
  const [conversations, setConversations] = useState(() => readSavedConversations(userId));
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const inputRef = useRef(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId]
  );
  const currentMessages = selectedConversation?.messages || [];

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    if (conversations.length > 0) {
      setLoading(false);
      return;
    }

    let active = true;
    async function loadPreviousHistory() {
      try {
        const { data } = await api.get('/support');
        if (!active || !Array.isArray(data) || data.length === 0) return;

        const legacyConversation = {
          id: createConversationId(),
          title: 'Lịch sử trước đây',
          messages: data,
          updatedAt: data[data.length - 1].created_at || new Date().toISOString(),
        };
        setConversations([legacyConversation]);
      } catch (error) {
        message.error(error.response?.data?.message || 'Không thể tải lịch sử hỗ trợ.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPreviousHistory();
    return () => {
      active = false;
    };
  }, [userId, conversations.length]);

  useEffect(() => {
    if (!userId || conversations.length === 0) return;
    try {
      localStorage.setItem(getHistoryStorageKey(userId), JSON.stringify(conversations));
    } catch (error) {
      console.error('Không thể lưu lịch sử hỗ trợ:', error);
      message.error('Không thể lưu lịch sử trò chuyện trên thiết bị này.');
    }
  }, [conversations, userId]);

  const startNewConversation = useCallback(() => {
    setSelectedConversationId(null);
    setQuestion('');
    inputRef.current?.focus();
  }, []);

  async function handleAsk() {
    const value = question.trim();
    if (!value || sending || loading) return;

    setSending(true);
    try {
      const { data } = await api.post('/support', { question: value });
      const conversationId = selectedConversationId || createConversationId();
      const now = new Date().toISOString();

      setConversations((previous) => {
        const existing = previous.find((conversation) => conversation.id === conversationId);
        const nextConversation = {
          id: conversationId,
          title: existing?.title || value.slice(0, 56),
          messages: [...(existing?.messages || []), data],
          updatedAt: now,
        };
        return [
          nextConversation,
          ...previous.filter((conversation) => conversation.id !== conversationId),
        ];
      });
      setSelectedConversationId(conversationId);
      setQuestion('');
      inputRef.current?.focus();
    } catch (error) {
      message.error(error.response?.data?.message || 'Không thể gửi câu hỏi.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <Title level={3}>Hỗ trợ nhà trọ</Title>
      <Card
        title={<span><CustomerServiceOutlined /> Trợ lý nhà trọ</span>}
        extra={<Text type="secondary">Hỏi về phòng, hợp đồng, hóa đơn, thanh toán và sự cố</Text>}
      >
        <div className="support-chat-layout">
          <aside className="support-history">
            <div className="support-history-header">
              <Text strong>Lịch sử trò chuyện</Text>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={startNewConversation}
              >
                Trò chuyện mới
              </Button>
            </div>
            {loading ? (
              <div className="support-history-loading"><Spin size="small" /></div>
            ) : conversations.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có cuộc trò chuyện" />
            ) : (
              <List
                className="support-history-list"
                dataSource={conversations}
                renderItem={(conversation) => (
                  <List.Item className="support-history-item">
                    <Button
                      type="text"
                      className={`support-history-button${conversation.id === selectedConversationId ? ' is-selected' : ''}`}
                      onClick={() => setSelectedConversationId(conversation.id)}
                    >
                      <span className="support-history-title">{conversation.title}</span>
                      <span className="support-history-date">
                        {formatConversationTime(conversation.updatedAt)}
                      </span>
                    </Button>
                  </List.Item>
                )}
              />
            )}
          </aside>

          <section className="support-conversation">
            <Alert
              showIcon
              type="info"
              message="Bạn có thể hỏi mọi điều liên quan đến việc thuê và sử dụng phòng trọ."
              description="Với thông tin riêng của hợp đồng hoặc khoản tiền cụ thể, hãy xác nhận lại với chủ trọ."
              style={{ marginBottom: 16 }}
            />
            <div className="support-messages">
              {loading ? (
                <Spin />
              ) : currentMessages.length === 0 ? (
                <Empty description="Hãy đặt câu hỏi để bắt đầu cuộc trò chuyện." />
              ) : (
                <List
                  dataSource={currentMessages}
                  split={false}
                  renderItem={(item) => (
                    <List.Item style={{ display: 'block', paddingInline: 0 }}>
                      <Card size="small" style={{ marginBottom: 10, background: '#f5f8ff' }}>
                        <Text strong>Bạn hỏi</Text>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.question}</div>
                      </Card>
                      <Card size="small" style={{ marginBottom: 16 }}>
                        <Text strong style={{ color: '#1d4ed8' }}>Trợ lý trả lời</Text>
                        <div style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{item.answer}</div>
                      </Card>
                    </List.Item>
                  )}
                />
              )}
            </div>

            <Input.TextArea
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  handleAsk();
                }
              }}
              rows={3}
              maxLength={2000}
              showCount
              placeholder="Ví dụ: Hạn thanh toán hóa đơn là khi nào? Tôi cần làm gì khi vòi nước bị rò?"
              disabled={sending || loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleAsk}
              loading={sending}
              disabled={!question.trim() || loading}
              style={{ marginTop: 10 }}
            >
              Gửi câu hỏi
            </Button>
          </section>
        </div>
      </Card>
    </div>
  );
}

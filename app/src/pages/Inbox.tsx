import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, RefreshCw, Circle, Loader2, Users, Bot } from 'lucide-react';
import { api, Message } from '../lib/api';

interface Channel {
  platform: string;
  id: string;
  name: string;
  connected: boolean;
  lastMessage?: Message;
}

export default function Inbox() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const messagesRef = useRef<HTMLDivElement>(null);
  const refreshInterval = useRef<number | null>(null);

  // Load messages for a channel
  const loadMessages = async (channel: Channel) => {
    setMessagesLoading(true);
    try {
      const result = await api.messages.thread(channel.platform, channel.id);
      setMessages(result.messages.reverse()); // Show newest at bottom
    } catch (err) {
      console.error('Failed to load messages:', err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Load all messages and extract channels
  const loadChannels = async () => {
    setLoading(true);
    try {
      const result = await api.messages.list();
      const allMessages = result.messages;

      // Extract unique channels from messages
      const channelMap = new Map<string, Channel>();

      allMessages.forEach(msg => {
        const key = `${msg.platform}:${msg.channel}`;
        if (!channelMap.has(key)) {
          channelMap.set(key, {
            platform: msg.platform,
            id: msg.channel,
            name: `${msg.platform}/${msg.channel}`,
            connected: true, // Assume connected if we have messages
            lastMessage: msg
          });
        } else {
          // Update with latest message
          const channel = channelMap.get(key)!;
          if (!channel.lastMessage || new Date(msg.timestamp) > new Date(channel.lastMessage.timestamp)) {
            channel.lastMessage = msg;
          }
        }
      });

      const channelsList = Array.from(channelMap.values()).sort((a, b) => {
        if (!a.lastMessage && !b.lastMessage) return 0;
        if (!a.lastMessage) return 1;
        if (!b.lastMessage) return -1;
        return new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime();
      });

      setChannels(channelsList);

      // Auto-select first channel if none selected
      if (!selectedChannel && channelsList.length > 0) {
        setSelectedChannel(channelsList[0]);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  };

  // Send a message
  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChannel || sending) return;

    setSending(true);
    try {
      await api.messages.send(
        selectedChannel.platform,
        `channel:${selectedChannel.id}`,
        newMessage.trim()
      );
      setNewMessage('');
      // Reload messages to show the sent message
      await loadMessages(selectedChannel);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  // Load messages when channel changes
  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel);
    }
  }, [selectedChannel]);

  // Auto-refresh setup
  useEffect(() => {
    loadChannels();

    if (autoRefresh) {
      refreshInterval.current = setInterval(() => {
        loadChannels();
        if (selectedChannel) {
          loadMessages(selectedChannel);
        }
      }, 10000); // Refresh every 10 seconds
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [autoRefresh, selectedChannel]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Get platform icon
  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'telegram': return '📱';
      case 'discord': return '💬';
      case 'slack': return '💼';
      default: return '💬';
    }
  };

  return (
    <div className="max-w-7xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text flex items-center gap-2">
          <MessageSquare size={18} className="text-amber" />Unified Inbox
        </h1>
        <p className="text-dim text-xs mt-0.5">Cross-platform messaging hub</p>
      </div>

      <div className="grid grid-cols-4 gap-6" style={{ height: '600px' }}>
        {/* Channel List */}
        <div className="bg-surface border border-border rounded-lg flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-amber" />
              <span className="text-text text-sm font-medium">Channels</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`text-xs px-2 py-1 rounded ${
                  autoRefresh ? 'bg-green text-white' : 'bg-raised text-dim'
                }`}
                title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
              >
                <Circle size={8} className={autoRefresh ? 'fill-current' : ''} />
              </button>
              <button
                onClick={loadChannels}
                disabled={loading}
                className="text-dim hover:text-text transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {loading && channels.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={16} className="animate-spin text-dim" />
              </div>
            ) : channels.length === 0 ? (
              <div className="text-center text-dim text-xs py-8">
                No channels found
              </div>
            ) : (
              <div className="space-y-1">
                {channels.map((channel) => (
                  <button
                    key={`${channel.platform}:${channel.id}`}
                    onClick={() => setSelectedChannel(channel)}
                    className={[
                      'w-full p-3 rounded-lg text-left transition-colors border',
                      selectedChannel?.platform === channel.platform && selectedChannel?.id === channel.id
                        ? 'bg-a-soft border-amber text-text'
                        : 'bg-raised border-transparent hover:border-border2 text-text hover:bg-border'
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getPlatformIcon(channel.platform)}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        channel.connected ? 'bg-green' : 'bg-red'
                      }`} />
                      <span className="text-xs font-medium truncate flex-1">
                        {channel.platform}
                      </span>
                    </div>
                    <div className="text-[10px] text-dim mb-1 truncate">
                      #{channel.id}
                    </div>
                    {channel.lastMessage && (
                      <>
                        <div className="text-xs text-text truncate">
                          {channel.lastMessage.sender}: {channel.lastMessage.text}
                        </div>
                        <div className="text-[9px] text-faint mt-1">
                          {formatTime(channel.lastMessage.timestamp)}
                        </div>
                      </>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages Panel */}
        <div className="col-span-3 bg-surface border border-border rounded-lg flex flex-col">
          {selectedChannel ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <span className="text-xl">{getPlatformIcon(selectedChannel.platform)}</span>
                <div>
                  <div className="text-text text-sm font-medium">
                    {selectedChannel.platform} / #{selectedChannel.id}
                  </div>
                  <div className={`text-xs flex items-center gap-1 ${
                    selectedChannel.connected ? 'text-green' : 'text-red'
                  }`}>
                    <Circle size={6} className="fill-current" />
                    {selectedChannel.connected ? 'Connected' : 'Disconnected'}
                  </div>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => selectedChannel && loadMessages(selectedChannel)}
                    disabled={messagesLoading}
                    className="text-dim hover:text-text transition-colors"
                  >
                    <RefreshCw size={14} className={messagesLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={16} className="animate-spin text-dim" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-dim text-xs py-8">
                    No messages in this channel
                  </div>
                ) : (
                  messages.map((message, i) => {
                    const isBot = message.sender.toLowerCase().includes('bot') ||
                                  message.sender.toLowerCase().includes('agent') ||
                                  message.sender.toLowerCase().includes('ai');

                    return (
                      <div key={i} className={`flex gap-3 ${
                        message.sender === 'you' ? 'justify-end' : 'justify-start'
                      }`}>
                        {message.sender !== 'you' && (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-raised border border-border shrink-0">
                            {isBot ? (
                              <Bot size={14} className="text-blue" />
                            ) : (
                              <span className="text-xs font-bold text-text">
                                {message.sender.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        )}

                        <div className={`max-w-[70%] ${
                          message.sender === 'you' ? 'order-first' : ''
                        }`}>
                          <div className={`rounded-lg px-3 py-2 ${
                            message.sender === 'you'
                              ? 'bg-amber text-bg ml-auto'
                              : 'bg-raised border border-border text-text'
                          }`}>
                            {message.sender !== 'you' && (
                              <div className="text-xs text-dim mb-1 font-medium">
                                {message.sender}
                              </div>
                            )}
                            <div className="text-sm whitespace-pre-wrap">
                              {message.text}
                            </div>
                          </div>
                          <div className={`text-[10px] text-faint mt-1 ${
                            message.sender === 'you' ? 'text-right' : 'text-left'
                          }`}>
                            {formatTime(message.timestamp)}
                          </div>
                        </div>

                        {message.sender === 'you' && (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber text-bg shrink-0">
                            <span className="text-xs font-bold">You</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <div className="border-t border-border p-4 flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={`Message ${selectedChannel.platform}...`}
                  className="flex-1 bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
                  disabled={sending || !selectedChannel.connected}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending || !selectedChannel.connected}
                  className="bg-amber text-bg px-4 py-2 rounded text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
                >
                  {sending ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Send size={13} />
                  )}
                  Send
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-dim">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                <div className="text-sm">Select a channel to view messages</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
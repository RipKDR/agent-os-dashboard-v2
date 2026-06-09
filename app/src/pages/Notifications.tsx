import { Bell, BellOff, Trash2 } from 'lucide-react';
import { Notification } from '../lib/api';

interface Props {
  notifs: Notification[];
  onClear: () => void;
  onMarkRead: (id: string) => void;
}

const TYPE_COLOR: Record<string, string> = {
  error:   'text-red',
  warning: 'text-amber',
  success: 'text-green',
  info:    'text-blue',
};

export default function NotificationsPage({ notifs, onClear, onMarkRead }: Props) {
  const unread = notifs.filter(n => !n.read).length;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Bell size={18} className="text-amber" />
            Notifications
            {unread > 0 && (
              <span className="bg-amber text-bg text-[10px] font-bold rounded-full px-2 py-0.5">
                {unread}
              </span>
            )}
          </h1>
          <p className="text-dim text-xs mt-0.5">{notifs.length} total · {unread} unread</p>
        </div>
        {notifs.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1.5 text-xs text-dim hover:text-red transition-colors"
          >
            <Trash2 size={13} />Clear all
          </button>
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="text-center py-24">
          <BellOff size={36} className="mx-auto mb-3 text-faint" />
          <div className="text-dim text-sm">All quiet</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {notifs.map(n => (
            <div
              key={n.id}
              onClick={() => !n.read && onMarkRead(n.id)}
              className={[
                'flex gap-3 bg-surface border rounded-lg px-4 py-3 transition-colors',
                n.read
                  ? 'border-border opacity-60'
                  : 'border-border2 cursor-pointer hover:border-amber',
              ].join(' ')}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${n.read ? 'bg-faint' : 'bg-amber'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] font-bold ${TYPE_COLOR[n.type] || 'text-dim'}`}>
                    {n.type}
                  </span>
                  <span className="text-[10px] text-faint">{n.source}</span>
                  <span className="text-[10px] text-faint ml-auto">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-text mt-0.5">{n.message}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

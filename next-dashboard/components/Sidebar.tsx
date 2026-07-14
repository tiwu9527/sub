'use client';

import { useEffect, useState } from 'react';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  KeyRound,
  LockKeyhole,
  LogOut,
  Palette,
  Plus,
  ReceiptText,
  Search,
  Settings,
  UserRound
} from 'lucide-react';
import { sidebarItems } from '@/lib/data';
import { dashboardThemes } from '@/lib/themes';
import type { DashboardTheme } from '@/lib/themes';

export type NavView = (typeof sidebarItems)[number]['id'];

export type DashboardNotification = {
  id: string;
  title: string;
  note: string;
  kind: 'billing' | 'budget';
  severity: 'info' | 'warning' | 'danger';
  action: 'subscription' | 'analytics';
  targetQuery?: string;
};

const notificationReadStorageKey = 'subscription-dashboard-read-notifications';

export function Sidebar({
  isAdmin,
  workspaceName,
  activeView,
  query,
  onQueryChange,
  theme,
  notificationOpen,
  notifications = [],
  onThemeChange,
  onToggleNotifications,
  onNotificationSelect,
  onNavigate,
  onOpenLogin,
  onOpenChangePassword,
  onOpenSettings,
  onOpenCreate,
  onLogout
}: {
  isAdmin: boolean;
  workspaceName: string;
  activeView: NavView;
  query: string;
  onQueryChange: (value: string) => void;
  theme: DashboardTheme;
  notificationOpen: boolean;
  notifications: DashboardNotification[];
  onThemeChange: (theme: DashboardTheme) => void;
  onToggleNotifications: () => void;
  onNotificationSelect: (notification: DashboardNotification) => void;
  onNavigate: (view: NavView) => void;
  onOpenLogin: () => void;
  onOpenChangePassword: () => void;
  onOpenSettings: () => void;
  onOpenCreate: () => void;
  onLogout: () => void;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [readNotificationsReady, setReadNotificationsReady] = useState(false);
  const unreadCount = readNotificationsReady
    ? notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length
    : 0;

  useEffect(() => {
    try {
      const storedIds = JSON.parse(window.localStorage.getItem(notificationReadStorageKey) ?? '[]');
      if (Array.isArray(storedIds)) {
        setReadNotificationIds(storedIds.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      setReadNotificationIds([]);
    } finally {
      setReadNotificationsReady(true);
    }
  }, []);

  function saveReadNotificationIds(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids));
    setReadNotificationIds(uniqueIds);
    window.localStorage.setItem(notificationReadStorageKey, JSON.stringify(uniqueIds));
  }

  function toggleNotifications() {
    setAdminMenuOpen(false);
    setThemeMenuOpen(false);
    onToggleNotifications();
  }

  function toggleAdminMenu() {
    if (notificationOpen) onToggleNotifications();
    setThemeMenuOpen(false);
    setAdminMenuOpen((value) => !value);
  }

  function toggleThemeMenu() {
    if (notificationOpen) onToggleNotifications();
    setAdminMenuOpen(false);
    setThemeMenuOpen((value) => !value);
  }

  function selectTheme(nextTheme: DashboardTheme) {
    onThemeChange(nextTheme);
  }

  function handleNotificationClick(notification: DashboardNotification) {
    if (!readNotificationIds.includes(notification.id)) {
      saveReadNotificationIds([...readNotificationIds, notification.id]);
    }
    onNotificationSelect(notification);
  }

  function markAllNotificationsRead() {
    saveReadNotificationIds([...readNotificationIds, ...notifications.map((notification) => notification.id)]);
  }

  function runAdminAction(action: () => void) {
    setAdminMenuOpen(false);
    setThemeMenuOpen(false);
    action();
  }

  return (
    <aside className="dashboard-nav theme-nav sticky top-0 z-40 border-b border-[#E3E8E5] bg-white lg:h-screen lg:border-b-0 lg:border-r">
      <div className="dashboard-nav-inner relative flex h-full min-w-0 flex-col gap-4 px-3 py-3 lg:gap-5 lg:px-4 lg:py-5">
        <div className="dashboard-brand flex min-w-0 items-center justify-between gap-3 lg:px-1">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white">
              <ReceiptText size={20} strokeWidth={2.2} />
            </div>
            <div className="dashboard-brand-copy min-w-0">
              <div className="truncate text-[16px] font-bold text-ink">续费管家</div>
              <div className="mt-0.5 truncate text-[11px] font-medium text-muted">Subscription Desk</div>
            </div>
          </div>

          <div className="dashboard-mobile-actions flex items-center gap-1 lg:hidden">
            <IconButton label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : '通知'} onClick={toggleNotifications} active={notificationOpen}>
              <NotificationBell unreadCount={unreadCount} />
            </IconButton>
            <IconButton label="界面主题" onClick={toggleThemeMenu} active={themeMenuOpen}>
              <Palette size={17} />
            </IconButton>
            <button
              type="button"
              onClick={toggleAdminMenu}
              className="theme-icon-button grid h-9 w-9 place-items-center rounded-lg border border-[#E2E7E4] bg-white text-ink"
              aria-label="账户菜单"
              aria-expanded={adminMenuOpen}
            >
              {isAdmin ? <UserRound size={17} /> : <LockKeyhole size={16} />}
            </button>
          </div>
        </div>

        <label className="dashboard-search theme-field-shell flex h-10 min-w-0 items-center gap-2 rounded-lg border border-[#DDE4E0] bg-[#F7F9F8] px-3 text-muted">
          <Search size={16} className="shrink-0" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索订阅"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-[#98A29C]"
          />
        </label>

        <nav className="dashboard-navigation flex min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="主导航">
          {sidebarItems.map((item) => {
            const isActive = activeView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`dashboard-nav-item group flex h-10 shrink-0 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold transition lg:w-full ${
                  isActive
                    ? 'theme-active-tab bg-[#E8F3F1] text-primary'
                    : 'theme-menu-item text-muted hover:bg-[#F1F4F2] hover:text-ink'
                }`}
                type="button"
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon size={17} className={isActive ? 'text-primary' : 'text-[#7B8780] group-hover:text-ink'} />
                <span className="dashboard-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={onOpenCreate}
          className="dashboard-create theme-primary-action hidden h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold lg:inline-flex"
        >
          <Plus size={17} />
          <span className="dashboard-create-label">新建订阅</span>
        </button>

        <div className="dashboard-nav-spacer hidden lg:block lg:flex-1" />

        <div className="dashboard-footer hidden border-t border-[#E6EAE8] pt-4 lg:block">
          <div className="dashboard-footer-tools mb-2 flex items-center gap-2">
            <IconButton label={unreadCount > 0 ? `通知，${unreadCount} 条未读` : '通知'} onClick={toggleNotifications} active={notificationOpen}>
              <NotificationBell unreadCount={unreadCount} />
            </IconButton>
            <IconButton label="界面主题" onClick={toggleThemeMenu} active={themeMenuOpen}>
              <Palette size={17} />
            </IconButton>
            <IconButton label="工作区设置" onClick={onOpenSettings}>
              <Settings size={17} />
            </IconButton>
          </div>

          <button
            type="button"
            onClick={toggleAdminMenu}
            className="dashboard-account theme-button flex w-full min-w-0 items-center gap-3 rounded-lg border border-[#E2E7E4] bg-white p-2 text-left"
            aria-haspopup="menu"
            aria-expanded={adminMenuOpen}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E9EEEB] text-[#33433A]">
              {isAdmin ? <UserRound size={17} /> : <LockKeyhole size={16} />}
            </div>
            <div className="dashboard-account-copy min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-ink">{isAdmin ? '管理员' : '访客模式'}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted">{isAdmin ? workspaceName : '登录后管理订阅'}</div>
            </div>
            <ChevronDown size={15} className="dashboard-account-chevron shrink-0 text-muted" />
          </button>
        </div>

        {themeMenuOpen ? (
          <div className="theme-picker-popover theme-popover absolute right-3 top-[60px] z-50 max-h-[calc(100vh-76px)] w-[min(366px,calc(100vw-24px))] overflow-y-auto rounded-lg border border-[#DDE4E0] bg-white p-3 shadow-lift lg:bottom-[148px] lg:left-[calc(100%+12px)] lg:right-auto lg:top-auto lg:max-h-[calc(100vh-172px)] lg:w-[340px]">
            <div className="flex items-center gap-2 px-1 pb-3">
              <div className="theme-icon-chip grid h-8 w-8 place-items-center rounded-lg bg-[#E8F3F1] text-primary">
                <Palette size={16} />
              </div>
              <div className="text-sm font-bold text-ink">界面主题</div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {dashboardThemes.map((option) => {
                const selected = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectTheme(option.id)}
                    className={`theme-button flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition ${
                      selected ? 'theme-active-tab border-primary/30 bg-[#E8F3F1] text-primary' : 'border-[#E2E7E4] bg-white text-ink hover:border-primary/25'
                    }`}
                    aria-pressed={selected}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{option.label}</span>
                      <span className="mt-1.5 flex items-center gap-1" aria-hidden="true">
                        {option.swatches.map((color) => (
                          <span key={color} style={{ backgroundColor: color }} className="h-3.5 w-5 rounded-sm border border-black/10" />
                        ))}
                      </span>
                    </span>
                    {selected ? <Check size={15} className="shrink-0" /> : null}
                  </button>
                );
              })}
            </div>

          </div>
        ) : null}

        {notificationOpen ? (
          <div className="notification-popover theme-popover absolute right-3 top-[60px] z-50 w-[min(366px,calc(100vw-24px))] overflow-hidden rounded-lg border border-[#DDE4E0] bg-white shadow-lift lg:bottom-[148px] lg:left-[calc(100%+12px)] lg:right-auto lg:top-auto lg:w-[360px]">
            <div className="flex items-center justify-between gap-3 border-b border-[#E7ECE9] px-4 py-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="text-sm font-bold text-ink">通知中心</div>
                {unreadCount > 0 ? (
                  <span className="rounded-full bg-[#E8F3F1] px-2 py-0.5 text-[11px] font-semibold text-primary">{unreadCount} 未读</span>
                ) : null}
              </div>
              {notifications.length > 0 && unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markAllNotificationsRead}
                  className="theme-menu-item inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-primary transition hover:bg-[#E8F3F1]"
                >
                  <CheckCheck size={14} />
                  全部已读
                </button>
              ) : null}
            </div>

            {notifications.length > 0 ? (
              <div className="max-h-[360px] divide-y divide-[#E8ECEA] overflow-y-auto">
                {notifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    read={readNotificationIds.includes(notification.id)}
                    onClick={() => handleNotificationClick(notification)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-8 text-center">
                <div className="theme-icon-chip grid h-10 w-10 place-items-center rounded-lg bg-[#EEF2F0] text-muted">
                  <BellOff size={18} />
                </div>
                <div className="mt-3 text-sm font-bold text-ink">暂无待处理通知</div>
                <div className="mt-1 text-xs leading-5 text-muted">账单和预算状态正常</div>
              </div>
            )}

            <div className="border-t border-[#E7ECE9] bg-[#F7F9F8] px-4 py-2 text-[11px] font-medium text-muted" aria-live="polite">
              已同步当前工作区状态
            </div>
          </div>
        ) : null}

        {adminMenuOpen ? (
          <div
            role="menu"
            className="account-popover theme-popover absolute right-3 top-[60px] z-50 w-64 rounded-lg border border-[#DDE4E0] bg-white p-2 shadow-lift lg:bottom-4 lg:left-[calc(100%+12px)] lg:right-auto lg:top-auto"
          >
            <div className="px-3 py-2">
              <div className="text-sm font-bold text-ink">{isAdmin ? '管理员已登录' : '管理员未登录'}</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                {isAdmin ? '当前拥有完整的订阅管理权限。' : '登录后可新增、编辑订阅与配置。'}
              </div>
            </div>
            <div className="my-1 h-px bg-[#E8ECEA]" />
            {!isAdmin ? (
              <MenuButton icon={LockKeyhole} label="管理员登录" onClick={() => runAdminAction(onOpenLogin)} />
            ) : null}
            <MenuButton icon={Plus} label={isAdmin ? '新建订阅' : '登录后新建订阅'} onClick={() => runAdminAction(onOpenCreate)} />
            <MenuButton icon={Settings} label="工作区设置" onClick={() => runAdminAction(onOpenSettings)} />
            {isAdmin ? (
              <MenuButton icon={KeyRound} label="修改账户密码" onClick={() => runAdminAction(onOpenChangePassword)} />
            ) : null}
            {isAdmin ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => runAdminAction(onLogout)}
                className="flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold text-danger transition hover:bg-danger/10"
              >
                <LogOut size={16} />
                退出登录
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function IconButton({
  children,
  label,
  onClick,
  active = false
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      onClick={onClick}
      className={`theme-icon-button grid h-9 w-9 shrink-0 place-items-center rounded-lg border transition ${
        active ? 'border-primary/25 bg-[#E8F3F1] text-primary' : 'border-[#E2E7E4] bg-white text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function MenuButton({ icon: Icon, label, onClick }: { icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm font-semibold text-ink transition hover:bg-[#F1F4F2]"
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <span className="relative grid place-items-center">
      <Bell size={17} />
      {unreadCount > 0 ? (
        <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-danger px-0.5 text-[9px] font-bold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </span>
  );
}

const notificationToneMap: Record<DashboardNotification['severity'], string> = {
  info: 'bg-[#E9F0FC] text-[#2563EB]',
  warning: 'bg-[#FDF0E5] text-[#B45C16]',
  danger: 'bg-[#FCEBEC] text-danger'
};

function NotificationItem({
  notification,
  read,
  onClick
}: {
  notification: DashboardNotification;
  read: boolean;
  onClick: () => void;
}) {
  const Icon = notification.kind === 'billing' ? Clock3 : CircleDollarSign;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`theme-menu-item flex w-full min-w-0 items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#F1F4F2] ${
        read ? 'bg-white' : 'bg-[#F7FBFA]'
      }`}
      aria-label={`${read ? '' : '未读：'}${notification.title}`}
    >
      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${notificationToneMap[notification.severity]}`}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className={`min-w-0 text-sm text-ink ${read ? 'font-semibold' : 'font-bold'}`}>{notification.title}</div>
          {!read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
        </div>
        <div className="mt-1 text-xs leading-5 text-muted">{notification.note}</div>
      </div>
    </button>
  );
}

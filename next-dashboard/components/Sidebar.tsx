'use client';

import { useState } from 'react';
import * as motion from 'framer-motion/client';
import { Bell, LockKeyhole, LogOut, Moon, Plus, Search, Settings, Sparkles, Sun, UserRound } from 'lucide-react';
import { sidebarItems } from '@/lib/data';

export type NavView = (typeof sidebarItems)[number]['id'];

export function Sidebar({
  isAdmin,
  workspaceName,
  activeView,
  query,
  onQueryChange,
  darkMode,
  notificationOpen,
  onToggleDarkMode,
  onToggleNotifications,
  onNavigate,
  onOpenLogin,
  onOpenSettings,
  onOpenCreate,
  onLogout
}: {
  isAdmin: boolean;
  workspaceName: string;
  activeView: NavView;
  query: string;
  onQueryChange: (value: string) => void;
  darkMode: boolean;
  notificationOpen: boolean;
  onToggleDarkMode: () => void;
  onToggleNotifications: () => void;
  onNavigate: (view: NavView) => void;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onOpenCreate: () => void;
  onLogout: () => void;
}) {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  function runAdminAction(action: () => void) {
    setAdminMenuOpen(false);
    action();
  }

  return (
    <header className="theme-nav sticky top-4 z-30 flex min-w-0 flex-col gap-4 rounded-[28px] border border-black/[0.05] bg-white/72 p-3 shadow-glow backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 px-1">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-[18px] bg-gradient-to-br from-primary via-[#8F73FF] to-secondary text-white shadow-[0_18px_38px_rgba(124,92,255,.28)]">
            <div className="absolute inset-px rounded-[17px] border border-white/30" />
            <Sparkles size={21} strokeWidth={2.35} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">续费管家</div>
            <div className="mt-0.5 truncate text-xs font-medium text-muted">Subscription OS</div>
          </div>
        </div>
      </div>

      <nav className="grid min-w-0 grid-cols-2 gap-1 sm:grid-cols-5 lg:flex lg:flex-1 lg:justify-center">
        {sidebarItems.map((item) => {
          const isActive = activeView === item.id;

          return (
            <motion.button
              key={item.id}
              whileHover={{ y: -1 }}
              onClick={() => onNavigate(item.id)}
              className={`group flex h-11 min-w-0 items-center justify-center gap-2 rounded-[16px] px-3 text-sm font-medium transition lg:w-auto lg:min-w-[112px] ${
                isActive
                  ? 'theme-active-tab bg-[#F0ECFF] text-accent shadow-[inset_0_0_0_1px_rgba(124,92,255,.08)]'
                  : 'theme-menu-item text-muted hover:bg-white/76 hover:text-ink'
              }`}
              type="button"
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon
                size={18}
                className={`shrink-0 ${isActive ? 'text-primary' : 'text-muted transition group-hover:text-primary'}`}
              />
              <span className="truncate">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>

      <div className="relative flex min-w-0 flex-wrap items-center gap-2 lg:shrink-0 lg:flex-nowrap">
        <label className="theme-button flex h-11 min-w-[180px] flex-1 items-center gap-2 rounded-[14px] border border-black/[0.05] bg-white/72 px-3 text-muted shadow-glow backdrop-blur-xl lg:w-44 lg:flex-none">
          <Search size={17} className="shrink-0" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索订阅"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted"
          />
        </label>

        <IconButton label="通知" onClick={onToggleNotifications}>
          <Bell size={18} />
        </IconButton>
        <IconButton label="主题切换" onClick={onToggleDarkMode}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </IconButton>

        {notificationOpen ? (
          <div className="theme-popover absolute right-0 top-14 z-40 w-72 rounded-[22px] border border-black/[0.05] bg-white/95 p-4 shadow-lift backdrop-blur-xl">
            <div className="text-sm font-semibold text-ink">通知</div>
            <div className="mt-3 space-y-3">
              <Notice title="Apple One 即将扣费" note="季付账单将在 5 月 18 日执行。" />
              <Notice title="预算状态健康" note="当前使用 18%，仍低于月预算。" />
            </div>
          </div>
        ) : null}

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setAdminMenuOpen((value) => !value)}
            className={`theme-button flex h-11 items-center gap-2 rounded-[14px] border border-black/[0.05] bg-white/82 px-2.5 text-left shadow-soft backdrop-blur-xl transition hover:border-primary/20 sm:gap-3 sm:rounded-[20px] sm:p-2 sm:pr-3 ${
              adminMenuOpen ? 'border-primary/25' : ''
            }`}
            aria-haspopup="menu"
            aria-expanded={adminMenuOpen}
          >
            <div className="grid h-8 w-8 place-items-center rounded-[12px] bg-gradient-to-br from-[#111827] to-[#4B5563] text-white sm:h-10 sm:w-10 sm:rounded-2xl">
              {isAdmin ? <UserRound size={17} /> : <LockKeyhole size={17} />}
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="truncate text-sm font-semibold text-ink">{isAdmin ? 'Admin' : '未登录'}</div>
              <div className="truncate text-xs text-muted">{isAdmin ? workspaceName : '登录后可添加订阅'}</div>
            </div>
          </button>

        {adminMenuOpen ? (
          <div
            role="menu"
            className="theme-popover absolute right-0 top-16 z-40 w-64 rounded-[20px] border border-black/[0.05] bg-white/95 p-2 shadow-lift backdrop-blur-xl"
          >
            <div className="theme-inset rounded-[16px] bg-[#F7F7FC] px-3 py-3">
              <div className="text-sm font-semibold text-ink">{isAdmin ? '管理员已登录' : '管理员未登录'}</div>
              <div className="mt-1 text-xs leading-5 text-muted">
                {isAdmin ? '可以添加、编辑订阅和修改配置。' : '添加订阅前需要先完成登录。'}
              </div>
            </div>

            <div className="mt-2 grid gap-1">
              {!isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAdminAction(onOpenLogin)}
                  className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-ink transition hover:bg-[#F7F7FC]"
                >
                  <LockKeyhole size={16} />
                  管理员登录
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                onClick={() => runAdminAction(onOpenCreate)}
                className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-ink transition hover:bg-[#F7F7FC]"
              >
                {isAdmin ? <Plus size={16} /> : <LockKeyhole size={16} />}
                {isAdmin ? '添加订阅' : '登录后添加订阅'}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runAdminAction(onOpenSettings)}
                className="theme-menu-item flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-ink transition hover:bg-[#F7F7FC]"
              >
                <Settings size={16} />
                配置管理
              </button>
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => runAdminAction(onLogout)}
                  className="flex h-10 w-full items-center gap-2 rounded-[12px] px-3 text-sm font-semibold text-danger transition hover:bg-danger/10"
                >
                  <LogOut size={16} />
                  退出登录
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
      </div>
    </header>
  );
}

function IconButton({
  children,
  label,
  onClick
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      type="button"
      aria-label={label}
      onClick={onClick}
      className="theme-icon-button grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-black/[0.05] bg-white/72 text-ink shadow-glow backdrop-blur-xl transition hover:border-primary/20 hover:text-primary"
    >
      {children}
    </motion.button>
  );
}

function Notice({ title, note }: { title: string; note: string }) {
  return (
    <div className="theme-inset rounded-[16px] bg-[#F7F7FC] p-3">
      <div className="text-sm font-semibold text-ink">{title}</div>
      <div className="mt-1 text-xs leading-5 text-muted">{note}</div>
    </div>
  );
}

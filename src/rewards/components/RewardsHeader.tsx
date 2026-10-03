import React, { useState } from "react";
import {
  Home,
  MessageCircle,
  Award,
  CircleHelp,
  Gift,
  BadgeCheck,
  Mic2,
  ShieldCheck,
  Bell,
  ArrowUpRight,
  LogOut,
  X,
  Check,
} from "lucide-react";
import type { RewardsNavTab, NotificationItem } from "../types";

interface RewardsHeaderProps {
  currentTab: RewardsNavTab;
  onSelectTab: (tab: RewardsNavTab) => void;
  canManage: boolean;
  userName: string;
  userId: string;
  notifications: NotificationItem[];
  onMarkNotificationsRead: () => void;
  onOpenProfile?: () => void;
}

export const RewardsHeader: React.FC<RewardsHeaderProps> = ({
  currentTab,
  onSelectTab,
  canManage,
  userName,
  userId,
  notifications,
  onMarkNotificationsRead,
  onOpenProfile,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems = [
    { id: "home" as RewardsNavTab, label: "الرئيسية", icon: Home },
    { id: "posts" as RewardsNavTab, label: "المنشورات", icon: MessageCircle },
    { id: "hof" as RewardsNavTab, label: "لوحة الشرف", icon: Award },
    {
      id: "support" as RewardsNavTab,
      label: "الطلبات والشكاوى",
      icon: CircleHelp,
    },
    { id: "store" as RewardsNavTab, label: "المتجر", icon: Gift },
    { id: "cert" as RewardsNavTab, label: "الشهادات", icon: BadgeCheck },
    { id: "sessions" as RewardsNavTab, label: "الجلسات", icon: Mic2 },
  ];

  if (canManage) {
    navItems.push({
      id: "admin" as RewardsNavTab,
      label: "الإدارة",
      icon: ShieldCheck,
    });
  }

  const initialLetter = userName.trim() ? userName.trim().charAt(0) : "ع";

  return (
    <header className="rew-header" dir="rtl">
      <div className="rew-header-inner">
        {/* Brand with Soundwave */}
        <a href="/portal" className="rew-brand" title="العودة إلى بوابة إنصات">
          <div className="rew-wave-badge">
            <span className="wave-bar bar-1"></span>
            <span className="wave-bar bar-2"></span>
            <span className="wave-bar bar-3"></span>
            <span className="wave-bar bar-4"></span>
          </div>
          <div className="rew-brand-text">
            <span className="rew-brand-title">أنصات</span>
            <span className="rew-brand-sub">لوحة النقاط والتقدير</span>
          </div>
        </a>

        {/* Primary Navigation */}
        <nav className="rew-nav-bar" aria-label="أقسام منصة التقدير">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`rew-nav-btn ${isActive ? "active" : ""}`}
                onClick={() => onSelectTab(item.id)}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="rew-header-actions">
          {/* Link to Tasks Platform */}
          <a
            href="/tasks"
            className="rew-tasks-link"
            title="الانتقال إلى نظام المهام"
          >
            <span>نظام المهام</span>
            <ArrowUpRight size={14} />
          </a>

          {/* Notifications Bell */}
          <div className="rew-notif-wrapper">
            <button
              type="button"
              className={`rew-notif-btn ${unreadCount > 0 ? "has-unread" : ""}`}
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) {
                  onMarkNotificationsRead();
                }
              }}
              title="الإشعارات والتنبيهات"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="rew-notif-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="rew-notif-dropdown">
                <div className="rew-notif-head">
                  <strong>الإشعارات والتنبيهات</strong>
                  <button
                    type="button"
                    onClick={() => setShowNotifications(false)}
                    aria-label="إغلاق"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="rew-notif-list">
                  {notifications.length > 0 ? (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={`rew-notif-item ${notif.read ? "read" : "unread"}`}
                      >
                        <strong>{notif.title}</strong>
                        <p>{notif.message}</p>
                        <small>{notif.createdAt}</small>
                      </div>
                    ))
                  ) : (
                    <div className="rew-notif-empty">
                      <Check size={18} />
                      <span>لا توجد إشعارات جديدة حالياً</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Member Profile Chip */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="rew-user-chip cursor-pointer hover:opacity-90 transition transform hover:scale-[1.02] border-0 bg-transparent"
            title="تعديل ملفك الشخصي وبيانات الحساب"
          >
            <div className="rew-user-avatar">{initialLetter}</div>
            <div className="rew-user-info text-right">
              <span className="rew-user-name">{userName}</span>
              <span className="rew-user-id text-[10px] text-indigo-400 font-bold">
                تعديل الملف
              </span>
            </div>
          </button>

          {/* Portal Return / Exit */}
          <a
            href="/portal"
            className="rew-exit-btn"
            title="العودة إلى البوابة العامة"
          >
            <LogOut size={16} />
          </a>
        </div>
      </div>
    </header>
  );
};

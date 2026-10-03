import React, { useState } from "react";
import {
  Calendar,
  Sparkles,
  ExternalLink,
  X,
  Clock,
  Award,
} from "lucide-react";
import type { ActivityItem } from "../types";

interface ActivitiesRowProps {
  activities: ActivityItem[];
}

export const ActivitiesRow: React.FC<ActivitiesRowProps> = ({ activities }) => {
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(
    null,
  );

  if (!activities || activities.length === 0) {
    return null;
  }

  const formatActivityDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat("ar-IQ", {
        month: "short",
        day: "numeric",
        weekday: "short",
      }).format(d);
    } catch {
      return isoStr;
    }
  };

  return (
    <section
      className="rew-activities-section"
      dir="rtl"
      aria-label="الأنشطة والفعاليات القادمة"
    >
      <div className="rew-activities-header">
        <div className="rew-activities-title">
          <Calendar size={18} />
          <h3>الأنشطة والفعاليات القادمة</h3>
        </div>
        <span className="rew-activities-badge">
          {activities.length} متاحة للتسجيل
        </span>
      </div>

      <div className="rew-activities-carousel">
        {activities.map((act) => (
          <article key={act.id} className="rew-act-card">
            <div className="rew-act-top">
              <span className="rew-act-date">
                <Clock size={12} />
                {formatActivityDate(act.datetime)}
              </span>
              {act.points > 0 && (
                <span className="rew-act-pts">
                  <Sparkles size={12} />+{act.points} نقطة
                </span>
              )}
            </div>
            <h4 className="rew-act-heading">{act.title}</h4>
            <p className="rew-act-desc">{act.description}</p>
            <button
              type="button"
              className="rew-act-btn"
              onClick={() => setSelectedActivity(act)}
            >
              <span>تفاصيل / تسجيل</span>
              <ExternalLink size={13} />
            </button>
          </article>
        ))}
      </div>

      {/* Activity Details Modal */}
      {selectedActivity && (
        <div
          className="rew-modal-backdrop"
          onClick={() => setSelectedActivity(null)}
        >
          <div className="rew-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="rew-modal-head">
              <div className="rew-modal-title-group">
                <Award size={20} className="rew-modal-icon" />
                <h3>{selectedActivity.title}</h3>
              </div>
              <button
                type="button"
                className="rew-modal-close"
                onClick={() => setSelectedActivity(null)}
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rew-modal-body">
              <div className="rew-modal-meta-row">
                <div className="rew-modal-pill">
                  <Clock size={15} />
                  <span>
                    الموعد: {formatActivityDate(selectedActivity.datetime)}
                  </span>
                </div>
                {selectedActivity.points > 0 && (
                  <div className="rew-modal-pill highlight">
                    <Sparkles size={15} />
                    <span>المكافأة: +{selectedActivity.points} نقطة أثر</span>
                  </div>
                )}
              </div>

              <div className="rew-modal-text-content">
                <h4>عن النشاط</h4>
                <p>{selectedActivity.description}</p>
              </div>

              {selectedActivity.link && (
                <div className="rew-modal-action-row">
                  <a
                    href={selectedActivity.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rew-modal-primary-btn"
                  >
                    <span>التسجيل في الفعالية</span>
                    <ExternalLink size={16} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

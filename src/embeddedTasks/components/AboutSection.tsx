// @ts-nocheck
import React, { useState } from "react";
import { DEPARTMENTS, TEAM_MEMBERS } from "../data/mockData";
import { DepartmentId } from "../types";
import {
  BookOpen,
  Mic,
  Palette,
  Code,
  Users,
  Globe2,
  HeartHandshake,
  Award,
} from "lucide-react";

export const AboutSection: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState<DepartmentId>("content");

  const getDeptIcon = (iconName: string) => {
    switch (iconName) {
      case "BookOpen":
        return BookOpen;
      case "Mic":
        return Mic;
      case "Palette":
        return Palette;
      case "Code":
        return Code;
      default:
        return Users;
    }
  };

  const activeDeptInfo =
    DEPARTMENTS.find((d) => d.id === selectedDept) || DEPARTMENTS[0];
  const deptMembers = TEAM_MEMBERS.filter(
    (m) => m.departmentId === selectedDept,
  );

  return (
    <section
      id="about"
      className="py-24 bg-slate-900/60 border-t border-b border-slate-800/80 relative overflow-hidden"
    >
      {/* Background Ornaments */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
            <HeartHandshake className="w-4 h-4" />
            <span>رسالتنا الثقافية</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white font-['Cairo']">
            عن مبادرة <span className="text-amber-400">إنصــات</span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">
            "إنصات" هي مبادرة ثقافية تطوعية عابرة للحدود انطلقت بجهود ذاتية تجمع
            بين ضفاف دجلة والفرات والنيل، لتحويل الكنز الأدبي المكتوب إلى تجارب
            صوتية وتفاعلية تثري الذائقة العربية.
          </p>
        </div>

        {/* Narrative Feature Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/30 transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Globe2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Cairo']">
              جسر ثنائي بين دجلة والنيل
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              تلاحم فكري وفني يضم 18 متطوعاً متخصصاً من العراق ومصر، يتبادلون
              الخبرات اللغوية والصوتية والرقمية لصناعة محتوى محكم يرتقي بالقارئ
              العربي.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/30 transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Cairo']">
              جودة وقيم أدبية سامية
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              نلتزم بأعلى معايير التدقيق اللغوي، حقوق الملكية الفكرية، والهندسة
              الصوتية عالية الدقة مع توزيع موسيقي أصيل مصمم خصيصاً لكل كتاب.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/30 transition-all space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Code className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white font-['Cairo']">
              تكنولوجيا التزامن التفاعلي
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              لا نكتفي بملف صوتي صامت؛ بل نبتكر تجربة تزامن بصري للمقرؤ مع
              المسموع يتيح المتابعة النصية للكلمة المضاءة أثناء القراءة والتفاعل
              المباشر.
            </p>
          </div>
        </div>

        {/* Specialized Departments Explorer */}
        <div className="mt-20 space-y-8">
          <div className="text-center space-y-2">
            <h3 className="text-2xl font-bold text-white font-['Cairo']">
              الأقسام المتخصصة بفريق إنصات (18 عضواً)
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              اختر القسم لاستكشاف الهيكل والتخصص والملاكات العاملة فيه
            </p>
          </div>

          {/* Department Selector Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DEPARTMENTS.map((dept) => {
              const Icon = getDeptIcon(dept.iconName);
              const isSelected = selectedDept === dept.id;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDept(dept.id)}
                  className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? "bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-900 border-amber-500/50 shadow-lg shadow-amber-500/10"
                      : "bg-slate-950 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`p-2.5 rounded-xl ${isSelected ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-amber-400"}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {dept.memberCount} أعضاء
                    </span>
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-bold font-['Cairo'] ${isSelected ? "text-amber-300" : "text-white"}`}
                    >
                      {dept.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">
                      مسؤول القسم: {dept.leader}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Department Detailed Overview & Team Members Card Grid */}
          <div className="p-6 sm:p-8 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <h4 className="text-2xl font-bold text-white font-['Cairo']">
                    {activeDeptInfo.name}
                  </h4>
                </div>
                <p className="text-sm text-slate-300 max-w-2xl">
                  {activeDeptInfo.description}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
                  <span className="text-slate-500">القائد: </span>
                  <span className="text-amber-400 font-bold">
                    {activeDeptInfo.leader}
                  </span>
                </div>
              </div>
            </div>

            {/* Department Team Members Cards */}
            <div>
              <h5 className="text-xs font-bold text-slate-400 mb-4 tracking-wider">
                أعضاء الفريق في {activeDeptInfo.name} ({deptMembers.length}{" "}
                أعضاء):
              </h5>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {deptMembers.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-500/30 transition-all flex items-center gap-3"
                  >
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                      <img
                        src={member.avatar}
                        alt={member.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute bottom-0 left-0 text-[10px] px-1 bg-slate-950/90 text-slate-200">
                        {member.country === "العراق" ? "🇮🇶" : "🇪🇬"}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0 text-right space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h6 className="text-sm font-bold text-white font-['Cairo'] truncate">
                          {member.name}
                        </h6>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                            member.country === "العراق"
                              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                              : "bg-blue-500/10 text-blue-300 border border-blue-500/20"
                          }`}
                        >
                          {member.country}
                        </span>
                      </div>
                      <p className="text-xs text-amber-400/90 truncate font-medium">
                        {member.role}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {member.email}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  UserCheck,
  Plus,
  X,
  Search,
  ChevronDown,
  ChevronUp,
  Mic,
  Sparkles,
  Edit3,
  Check,
  User as UserIcon,
} from "lucide-react";
import { User, ThemeMode } from "../types";
import { fetchUsers } from "../lib/supabaseClient";

interface NarratorSelectorProps {
  value: string;
  onChange: (newValue: string) => void;
  users?: User[];
  currentUser?: User | null;
  theme?: ThemeMode;
}

export const NarratorSelector: React.FC<NarratorSelectorProps> = ({
  value,
  onChange,
  users: propUsers = [],
  currentUser,
  theme = "dark",
}) => {
  const [availableUsers, setAvailableUsers] = useState<User[]>(propUsers);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [showRawTextInput, setShowRawTextInput] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync prop users or fetch if empty
  useEffect(() => {
    if (propUsers && propUsers.length > 0) {
      setAvailableUsers(propUsers);
    } else {
      fetchUsers()
        .then((uList) => {
          if (uList && uList.length > 0) {
            setAvailableUsers(uList);
          }
        })
        .catch((err) =>
          console.warn("Could not fetch users for NarratorSelector", err),
        );
    }
  }, [propUsers]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse comma-separated string into list of names
  const selectedNames = value
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const updateNames = (newList: string[]) => {
    // Deduplicate while preserving case
    const unique: string[] = [];
    newList.forEach((item) => {
      const trimmed = item.trim();
      if (
        trimmed &&
        !unique.some((u) => u.toLowerCase() === trimmed.toLowerCase())
      ) {
        unique.push(trimmed);
      }
    });
    onChange(unique.join("، "));
  };

  const handleAddManualName = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    if (!selectedNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      updateNames([...selectedNames, trimmed]);
    }
    setManualInput("");
  };

  const handleRemoveName = (indexToRemove: number) => {
    const updated = selectedNames.filter((_, idx) => idx !== indexToRemove);
    updateNames(updated);
  };

  const handleToggleUser = (user: User) => {
    const isSelected = selectedNames.some((n) => {
      const lower = n.toLowerCase();
      return (
        lower === (user.name || "").trim().toLowerCase() ||
        (user.username && lower === user.username.trim().toLowerCase()) ||
        lower === (user.id || "").toLowerCase()
      );
    });

    if (isSelected) {
      // Remove
      const updated = selectedNames.filter((n) => {
        const lower = n.toLowerCase();
        return !(
          lower === (user.name || "").trim().toLowerCase() ||
          (user.username && lower === user.username.trim().toLowerCase()) ||
          lower === (user.id || "").toLowerCase()
        );
      });
      updateNames(updated);
    } else {
      // Add exact full name for flawless matching in "مساحتي ومسار عملي"
      const nameToAdd = (user.name || user.username || "عضو").trim();
      updateNames([...selectedNames, nameToAdd]);
    }
  };

  const isUserSelected = (user: User) => {
    return selectedNames.some((n) => {
      const lower = n.toLowerCase();
      return (
        lower === (user.name || "").trim().toLowerCase() ||
        (user.username && lower === user.username.trim().toLowerCase()) ||
        lower === (user.id || "").toLowerCase()
      );
    });
  };

  // Filter available users based on search
  const filteredUsers = availableUsers.filter((u) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.role_display_ar && u.role_display_ar.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q)) ||
      (u.department && u.department.toLowerCase().includes(q))
    );
  });

  // Sort: Narrators first, then alphabetically
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aIsNarrator = a.role === "NARRATOR" || a.can_upload_raw;
    const bIsNarrator = b.role === "NARRATOR" || b.can_upload_raw;
    if (aIsNarrator && !bIsNarrator) return -1;
    if (!aIsNarrator && bIsNarrator) return 1;
    return (a.name || "").localeCompare(b.name || "", "ar");
  });

  const isCurrentAssigned = currentUser ? isUserSelected(currentUser) : false;

  return (
    <div className="space-y-2.5" ref={dropdownRef}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
          <Users size={14} className="text-amber-400" />
          <span>الرواة والمسند إليهم العمل:</span>
        </label>
        <button
          type="button"
          onClick={() => setShowRawTextInput(!showRawTextInput)}
          className="text-[11px] text-amber-400/90 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer font-medium"
        >
          <Edit3 size={12} />
          <span>
            {showRawTextInput
              ? "إخفاء الكتابة المباشرة"
              : "الكتابة اليدوية (نص مفصول بفواصل)"}
          </span>
        </button>
      </div>

      {/* Selected Tags / Chips Display */}
      <div
        className={`p-2.5 rounded-xl border min-h-[46px] flex flex-wrap items-center gap-1.5 transition ${
          theme === "dark"
            ? "bg-slate-950 border-slate-800"
            : "bg-slate-50 border-slate-300"
        }`}
      >
        {selectedNames.length === 0 ? (
          <span className="text-xs text-slate-500 italic px-1">
            لم يتم تعيين أي راوٍ بعد — اختر من قائمة الأسماء أدناه أو اكتب
            يدوياً
          </span>
        ) : (
          selectedNames.map((name, idx) => (
            <span
              key={`${name}-${idx}`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold animate-in fade-in"
            >
              <Mic size={12} className="text-amber-400" />
              <span>{name}</span>
              <button
                type="button"
                onClick={() => handleRemoveName(idx)}
                className="hover:bg-amber-500/30 p-0.5 rounded-full text-amber-300 hover:text-white transition cursor-pointer"
                title={`إزالة ${name}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Controls: Dropdown Toggle & Quick Manual Input */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex-1 min-w-[200px] px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
            isOpen
              ? "bg-slate-800 border-amber-500/60 text-white"
              : theme === "dark"
                ? "bg-slate-900 hover:bg-slate-800/80 border-slate-700 text-slate-200"
                : "bg-white hover:bg-slate-50 border-slate-300 text-slate-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users size={15} className="text-amber-400 shrink-0" />
            <span>
              {isOpen
                ? "إغلاق قائمة الأسماء"
                : "اختر من أسماء الرواة والأعضاء المسجلين"}
            </span>
            {availableUsers.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-mono">
                {availableUsers.length}
              </span>
            )}
          </div>
          {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {/* Quick Assign Me Button */}
        {currentUser && !isCurrentAssigned && (
          <button
            type="button"
            onClick={() => handleToggleUser(currentUser)}
            className="px-3 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
            title="تعيين هذا الكتاب لي أنا مباشرة"
          >
            <Sparkles size={13} className="text-amber-400" />
            <span>تعييني أنا</span>
          </button>
        )}
      </div>

      {/* Dropdown Menu of Available Users */}
      {isOpen && (
        <div
          className={`p-3 rounded-2xl border shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 ${
            theme === "dark"
              ? "bg-slate-900 border-slate-700 text-white"
              : "bg-white border-slate-200 text-slate-900"
          }`}
        >
          {/* Search Box inside dropdown */}
          <div className="relative">
            <Search
              size={14}
              className="absolute right-3 top-3 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ابحث باسم الراوي، اسم المستخدم، أو الدور..."
              className={`w-full pr-9 pl-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                theme === "dark"
                  ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                  : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
              }`}
              autoFocus
            />
          </div>

          {/* List of Registered Users */}
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
            {sortedUsers.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                لا يوجد أعضاء مطابقون لكلمة البحث
              </div>
            ) : (
              sortedUsers.map((user) => {
                const selected = isUserSelected(user);
                const isNarratorRole =
                  user.role === "NARRATOR" || user.can_upload_raw;

                return (
                  <button
                    key={user.id || user.email || user.name}
                    type="button"
                    onClick={() => handleToggleUser(user)}
                    className={`w-full p-2 rounded-xl flex items-center justify-between text-right text-xs transition cursor-pointer border ${
                      selected
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-200"
                        : theme === "dark"
                          ? "bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-200"
                          : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          selected
                            ? "bg-amber-500 text-slate-950 font-black"
                            : isNarratorRole
                              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                              : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {selected ? (
                          <Check size={14} />
                        ) : user.name ? (
                          user.name.charAt(0)
                        ) : (
                          <UserIcon size={12} />
                        )}
                      </div>

                      <div className="truncate">
                        <div className="flex items-center gap-2">
                          <strong className="font-bold text-white text-xs truncate">
                            {user.name}
                          </strong>
                          {isNarratorRole && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 shrink-0">
                              🎙️ راوٍ
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          {user.username && (
                            <span dir="ltr">@{user.username}</span>
                          )}
                          {user.role_display_ar && (
                            <span>• {user.role_display_ar}</span>
                          )}
                          {user.department && <span>• {user.department}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 mr-2">
                      {selected ? (
                        <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                          <UserCheck size={13} />
                          <span>معيّن</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 hover:text-amber-300 flex items-center gap-1">
                          <Plus size={13} />
                          <span>إسناد</span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Manual Typing Backup Section (اريدك تبقي الكتابة اليدوية للاحتياط) */}
      <div className="space-y-2 pt-1">
        {/* Quick Add Custom Name input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddManualName();
              }
            }}
            placeholder="أو اكتب اسماً جديداً يدوياً واضغط إضافة..."
            className={`flex-1 px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-amber-500 transition ${
              theme === "dark"
                ? "bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                : "bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400"
            }`}
          />
          <button
            type="button"
            onClick={handleAddManualName}
            disabled={!manualInput.trim()}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-amber-300 border border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>إضافة</span>
          </button>
        </div>

        {/* Full Direct Comma-Separated Text Input (Always available / backup) */}
        {showRawTextInput && (
          <div className="space-y-1 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 animate-in fade-in">
            <label className="text-[11px] font-bold text-slate-300 block">
              نص الأسماء المباشر (مفصولة بفواصل)، يمكنك التعديل واللصق بحرية:
            </label>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="مثال: أحمد عبد الله، ديمة، علي كرار..."
              className={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                theme === "dark"
                  ? "bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                  : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400"
              }`}
            />
            <span className="text-[10px] text-slate-400 block">
              ملاحظة: يمكنك كتابة أسماء متعددة تفصل بينها الفاصلة العربية (،) أو
              الإنجليزية (,).
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 leading-tight">
        ✨ سيظهر الكتاب فوراً في قائمة <strong>«مساحتي ومسار عملي»</strong>{" "}
        للرواة المحددين بمجرد حفظ الكتاب.
      </p>
    </div>
  );
};

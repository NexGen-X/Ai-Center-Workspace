import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import { Task, Project } from '../../../../shared/types.js';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  onSelectTask?: (task: Task) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({ isOpen, onClose, tasks, projects, onSelectTask }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  if (!isOpen) return null;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getTasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter((t) => t.dueDate === dateStr);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-[#0B0F17]/60 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white truncate">Kalender Orkestrasi</h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">Jadwal target penyelesaian tugas dan milestone proyek.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Calendar Nav */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <h3 className="text-xs sm:text-sm font-bold text-white font-mono">
              {monthNames[month]} {year}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days Grid */}
        <div className="p-2 sm:p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-400 font-mono">
            <span>MIN</span><span>SEN</span><span>SEL</span><span>RAB</span><span>KAM</span><span>JUM</span><span>SAB</span>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {/* Blank padding */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[52px] sm:min-h-[85px] rounded-lg sm:rounded-xl bg-slate-950/20 border border-transparent" />
            ))}

            {/* Month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayTasks = getTasksForDay(day);
              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={`day-${day}`}
                  className={`min-h-[52px] sm:min-h-[85px] p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between transition ${
                    isToday
                      ? 'bg-blue-950/30 border-blue-500/50'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] sm:text-xs font-mono font-bold ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                    <div className="space-y-1 mt-1 overflow-y-auto max-h-[55px]">
                    {dayTasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask && onSelectTask(t)}
                        className={`text-[10px] p-1 rounded truncate font-medium flex items-center gap-1 cursor-pointer transition hover:opacity-80 ${
                          t.status === 'DONE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-900 text-slate-200 border border-slate-800'
                        }`}
                        title={`${t.title} (Klik untuk rincian)`}
                      >
                        {t.status === 'DONE' ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> : <Clock className="w-2.5 h-2.5 shrink-0" />}
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

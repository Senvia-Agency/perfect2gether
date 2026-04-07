import { isSaturday, isSunday, eachDayOfInterval, format } from "date-fns";

export const absenceTypeLabels: Record<string, string> = {
  vacation: "Férias",
  sick_leave: "Baixa Médica",
  appointment: "Consultas",
  personal_leave: "Licença Pessoal",
  training: "Formação",
  other: "Outro",
};

export type PeriodType = 'full_day' | 'partial';

export interface DatePeriod {
  from: Date;
  to: Date;
  periodType: PeriodType;
  startTime?: string;
  endTime?: string;
  businessDays?: number;
}

export interface RhHoliday {
  id: string;
  date: string;
  name: string;
  year: number;
  is_national: boolean;
}

export const AVAILABLE_HOURS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00", "17:30", "18:00",
];

export const calculateHoursBetween = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return ((endHour * 60 + endMin) - (startHour * 60 + startMin)) / 60;
};

export const calculateBusinessDaysFromHours = (hours: number): number => {
  return Math.round((hours / 8) * 4) / 4;
};

export const formatTimeRange = (startTime: string, endTime: string): string => `${startTime}-${endTime}`;

export const isWeekend = (date: Date): boolean => isSaturday(date) || isSunday(date);

export const isHoliday = (date: Date, holidays: RhHoliday[]): RhHoliday | undefined => {
  const dateStr = format(date, "yyyy-MM-dd");
  return holidays.find(h => h.date === dateStr);
};

export const isBusinessDay = (date: Date, holidays: RhHoliday[]): boolean => {
  return !isWeekend(date) && !isHoliday(date, holidays);
};

export const countBusinessDays = (startDate: Date, endDate: Date, holidays: RhHoliday[]): number => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  return days.filter(day => isBusinessDay(day, holidays)).length;
};

export const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
  partially_approved: "Parcialmente Aprovado",
};

export const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
  partially_approved: "outline",
};

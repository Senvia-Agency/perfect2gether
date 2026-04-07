import { create } from "zustand";

interface DashboardPeriodState {
  selectedMonth: Date;
  setSelectedMonth: (date: Date) => void;
}

export const useDashboardPeriod = create<DashboardPeriodState>((set) => ({
  selectedMonth: new Date(),
  setSelectedMonth: (date) => set({ selectedMonth: date }),
}));

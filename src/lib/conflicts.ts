export interface StopConflictInput {
  id: string;
  placeId: string;
  placeName: string;
  dayIndex: number;
  startTime: string; // "10:00"
  endTime: string;   // "12:00"
  openingHours?: string | null; // e.g. "09:00-18:00"
  hoursConfidence?: string | null;
  estCostPaise: number;
}

export interface ConflictResult {
  type: "overlap" | "closed" | "transfer_gap" | "window_exceeded" | "budget_exceeded";
  severity: "error" | "warning";
  affectedStopIds: string[];
  message: string;
  suggestedFix: string;
}

const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function checkItineraryConflicts(
  stops: StopConflictInput[],
  dailyStart: string = "09:00",
  dailyEnd: string = "21:00",
  budgetPaise: number = 0
): ConflictResult[] {
  const conflicts: ConflictResult[] = [];
  const dailyStartMin = timeToMinutes(dailyStart);
  const dailyEndMin = timeToMinutes(dailyEnd);

  // Group by dayIndex
  const days = new Map<number, StopConflictInput[]>();
  let totalCostPaise = 0;

  for (const stop of stops) {
    totalCostPaise += stop.estCostPaise;
    const current = days.get(stop.dayIndex) || [];
    current.push(stop);
    days.set(stop.dayIndex, current);
  }

  // 1. Budget Check (FR-44)
  if (budgetPaise > 0 && totalCostPaise > budgetPaise) {
    conflicts.push({
      type: "budget_exceeded",
      severity: "warning",
      affectedStopIds: stops.map((s) => s.id),
      message: `Total estimated cost (₹${(totalCostPaise / 100).toLocaleString()}) exceeds the trip budget (₹${(budgetPaise / 100).toLocaleString()}).`,
      suggestedFix: "Adjust stop activities or increase trip budget.",
    });
  }

  // Check each day's stops
  for (const [dayIndex, dayStops] of days.entries()) {
    // Sort chronologically by start time
    const sorted = [...dayStops].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];
      const curStart = timeToMinutes(current.startTime);
      const curEnd = timeToMinutes(current.endTime);

      // Check daily window boundaries (FR-43)
      if (curStart < dailyStartMin || curEnd > dailyEndMin) {
        conflicts.push({
          type: "window_exceeded",
          severity: "warning",
          affectedStopIds: [current.id],
          message: `Day ${dayIndex}: Stop "${current.placeName}" (${current.startTime} - ${current.endTime}) falls outside the daily active window (${dailyStart} - ${dailyEnd}).`,
          suggestedFix: "Reschedule within the daily window or extend day hours.",
        });
      }

      // Check operating hours closure (FR-41, FR-45)
      if (current.openingHours && current.openingHours.includes("-")) {
        const [openStr, closeStr] = current.openingHours.split("-");
        const openMin = timeToMinutes(openStr);
        const closeMin = timeToMinutes(closeStr);

        if (curStart < openMin || curEnd > closeMin) {
          const isWarning = current.hoursConfidence === "unknown";
          conflicts.push({
            type: "closed",
            severity: isWarning ? "warning" : "error",
            affectedStopIds: [current.id],
            message: `Day ${dayIndex}: "${current.placeName}" is scheduled at ${current.startTime}-${current.endTime}, but opening hours are ${current.openingHours}.`,
            suggestedFix: `Visit during open hours (${current.openingHours}).`,
          });
        }
      }

      // Check overlaps and transfer gaps (FR-40, FR-42)
      if (i > 0) {
        const prev = sorted[i - 1];
        const prevEnd = timeToMinutes(prev.endTime);

        if (curStart < prevEnd) {
          // Overlap!
          conflicts.push({
            type: "overlap",
            severity: "error",
            affectedStopIds: [prev.id, current.id],
            message: `Day ${dayIndex}: Overlap detected between "${prev.placeName}" (ends ${prev.endTime}) and "${current.placeName}" (starts ${current.startTime}).`,
            suggestedFix: `Shift "${current.placeName}" to start at or after ${prev.endTime}.`,
          });
        } else if (curStart === prevEnd) {
          // Zero transfer gap warning
          conflicts.push({
            type: "transfer_gap",
            severity: "warning",
            affectedStopIds: [prev.id, current.id],
            message: `Day ${dayIndex}: No transit buffer between "${prev.placeName}" and "${current.placeName}".`,
            suggestedFix: "Add a 15-30 minute travel buffer between locations.",
          });
        }
      }
    }
  }

  return conflicts;
}

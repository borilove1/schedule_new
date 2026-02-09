import { norm } from '../../utils/eventHelpers';

export const getCalendarDays = (currentDate) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const firstDow = firstDay.getDay();
  const mondayOffset = firstDow === 0 ? 6 : firstDow - 1;
  const start = new Date(year, month, 1 - mondayOffset);

  const lastDow = lastDay.getDay();
  const sundayOffset = lastDow === 0 ? 0 : 7 - lastDow;
  const end = new Date(year, month + 1, sundayOffset);

  const totalDays = Math.round((end - start) / 86400000) + 1;
  const weekCount = Math.max(5, Math.ceil(totalDays / 7));

  const days = [];
  for (let i = 0; i < weekCount * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
};

export const getWeeks = (days) => {
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
};

export const isMultiDay = (event) => {
  return norm(new Date(event.startAt)).getTime() !== norm(new Date(event.endAt)).getTime();
};

export const getMultiDayEventsForWeek = (weekDays, events) => {
  const wStart = norm(weekDays[0]);
  const wEnd = norm(weekDays[6]);

  return events
    .filter(ev => {
      if (!isMultiDay(ev)) return false;
      const s = norm(new Date(ev.startAt));
      const e = norm(new Date(ev.endAt));
      return e >= wStart && s <= wEnd;
    })
    .map(ev => {
      const s = norm(new Date(ev.startAt));
      const e = norm(new Date(ev.endAt));
      let startCol = 1, endCol = 7;

      for (let i = 0; i < 7; i++) {
        const dn = norm(weekDays[i]);
        if (dn.getTime() === s.getTime()) startCol = i + 1;
        if (dn.getTime() === e.getTime()) endCol = i + 1;
      }
      if (s < wStart) startCol = 1;
      if (e > wEnd) endCol = 7;

      const isStartInWeek = s >= wStart;
      const isEndInWeek = e <= wEnd;

      return { event: ev, startCol, endCol, isStartInWeek, isEndInWeek };
    })
    .sort((a, b) => a.startCol - b.startCol || (b.endCol - b.startCol) - (a.endCol - a.startCol));
};

export const getSingleDayEventsForDate = (date, events) => {
  if (!date) return [];
  const dn = norm(date);
  return events.filter(ev => {
    if (isMultiDay(ev)) return false;
    return norm(new Date(ev.startAt)).getTime() === dn.getTime();
  });
};

export const getEventsForDate = (date, events) => {
  if (!date) return [];
  const dn = norm(date);
  return events.filter(ev => {
    const s = norm(new Date(ev.startAt));
    const e = norm(new Date(ev.endAt));
    return dn >= s && dn <= e;
  });
};

export const assignLanes = (multiDayBars) => {
  const lanes = [];
  for (const bar of multiDayBars) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const canFit = lanes[i].every(existing =>
        bar.startCol > existing.endCol || bar.endCol < existing.startCol
      );
      if (canFit) {
        lanes[i].push(bar);
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([bar]);
    }
  }
  return lanes;
};

export const filterEventsByTab = (list, tab) => {
  switch (tab) {
    case 'ongoing': return list.filter(e => e.status === 'PENDING' || e.status === 'IN_PROGRESS');
    case 'due_soon': return list.filter(e => e.isDueSoon);
    case 'completed': return list.filter(e => e.status === 'DONE');
    case 'overdue': return list.filter(e => e.status === 'OVERDUE');
    default: return list;
  }
};

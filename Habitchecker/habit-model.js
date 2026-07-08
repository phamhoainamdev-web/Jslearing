/* habit-model — domain thói quen của Habit Checker.
   Toàn bộ là hàm thuần: `state` truyền vào tường minh, không đọc global,
   không đọc đồng hồ (ngày "hôm nay" cũng truyền vào) — nhờ vậy test được
   bằng Node mà không cần trình duyệt.

   Định nghĩa "ngày hoàn thành" (xem CONTEXT.md):
   - Mẫu số (total) và ngưỡng (threshold) chỉ tính VIỆC HẰNG NGÀY.
   - Việc một lần đã tick "chỉ cộng, không trừ": cộng vào done,
     không làm tăng ngưỡng. Vì vậy done có thể vượt total (vd 5/3).
   - Ngày không có việc hằng ngày nào → không hoàn thành. */

/* ===== Toán ngày ===== */
export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/* ===== Việc & ngày có hiệu lực ===== */
export function isOnce(t) { return t.repeat === 'once'; }
export function onceDate(t) { return t.date || t.createdAt; }

/* Một việc có hiệu lực vào một ngày hay không */
export function isActive(t, key) {
  if (isOnce(t)) return key === onceDate(t);
  return t.createdAt <= key && (!t.archivedAt || key < t.archivedAt);
}

/* Các việc có hiệu lực trong ngày. scope: 'all' (kể cả một lần) | 'daily' */
export function tasksFor(state, key, scope = 'all') {
  return state.tasks.filter(t => (scope === 'all' || !isOnce(t)) && isActive(t, key));
}

export function isDone(state, key, taskId) {
  return !!(state.records[key] && state.records[key][taskId]);
}

/* ===== Ngày hoàn thành ===== */
export function dayStats(state, key) {
  const total = tasksFor(state, key, 'daily').length;
  const done = tasksFor(state, key, 'all').filter(t => isDone(state, key, t.id)).length;
  const threshold = total === 0 ? 0
    : state.minDone > 0 ? Math.min(state.minDone, total) : total;
  const complete = total > 0 && done >= threshold;
  return { total, done, threshold, complete };
}

/* ===== Chuỗi ===== */
/* Chuỗi ngày hoàn thành liên tiếp, tính lùi từ hôm nay
   (hôm nay chưa đạt thì tính lùi từ hôm qua) */
export function currentStreak(state, todayKey) {
  let streak = 0;
  if (dayStats(state, todayKey).complete) streak++;
  const d = keyToDate(todayKey);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(d);
    const s = dayStats(state, key);
    if (s.total === 0 || !s.complete) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* Chuỗi của riêng một việc: hiện tại (lùi từ hôm nay) + dài nhất */
export function taskStreaks(state, t, todayKey) {
  let current = 0;
  if (isActive(t, todayKey) && isDone(state, todayKey, t.id)) current++;
  const d = keyToDate(todayKey);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(d);
    if (!isActive(t, key) || !isDone(state, key, t.id)) break;
    current++;
    d.setDate(d.getDate() - 1);
  }
  let longest = 0, run = 0;
  const it = keyToDate(t.createdAt);
  while (dateKey(it) <= todayKey) {
    const key = dateKey(it);
    if (isActive(t, key) && isDone(state, key, t.id)) { run++; if (run > longest) longest = run; }
    else run = 0;
    it.setDate(it.getDate() + 1);
  }
  return { current, longest };
}

/* ===== Tháng ===== */
/* Các việc xuất hiện trong một tháng (kể cả đã lưu trữ giữa chừng). month: 0-11 */
export function tasksForMonth(state, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = dateKey(new Date(year, month, 1));
  const monthEnd = dateKey(new Date(year, month, daysInMonth));
  const daily = state.tasks.filter(t => !isOnce(t) &&
    t.createdAt <= monthEnd && (!t.archivedAt || t.archivedAt > monthStart));
  const once = state.tasks.filter(t => isOnce(t) &&
    onceDate(t) >= monthStart && onceDate(t) <= monthEnd);
  return [...daily, ...once];
}

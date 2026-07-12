/* habit-model — domain thói quen của Habit Checker.
   Toàn bộ là hàm thuần: `state` truyền vào tường minh, không đọc global,
   không đọc đồng hồ (ngày "hôm nay" cũng truyền vào) — nhờ vậy test được
   bằng Node mà không cần trình duyệt.

   Định nghĩa "ngày hoàn thành" (xem CONTEXT.md):
   - Mẫu số (total) và ngưỡng (threshold) chỉ tính VIỆC HẰNG NGÀY.
   - Việc một lần đã tick "chỉ cộng, không trừ": cộng vào done,
     không làm tăng ngưỡng. Vì vậy done có thể vượt total (vd 5/3).
   - Việc hằng ngày có cờ `required` (bắt buộc): ngày chỉ hoàn thành khi
     tick đủ MỌI việc bắt buộc có hiệu lực ngày đó, ngoài việc đạt ngưỡng.
   - Ngày không có việc hằng ngày nào → không hoàn thành.

   Ngày nghỉ (skip): state.skips = { 'YYYY-MM-DD': 'lý do' } (lý do có thể rỗng).
   Với MỌI loại chuỗi, ngày nghỉ là ngày TRUNG LẬP: không làm đứt chuỗi,
   cũng không cộng thêm — kể cả hôm đó có tick đủ. dayStats vẫn đếm tick
   như thường (số liệu là thật); người gọi xét cờ `skipped` trước. */

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

/* ===== Ngày nghỉ ===== */
/* Dùng `in` chứ không đọc giá trị: lý do rỗng '' vẫn là ngày nghỉ */
export function isSkipped(state, key) {
  return !!state.skips && key in state.skips;
}

/* ===== Ngày hoàn thành =====
   done = số đã tick gộp (hằng ngày + một lần); dailyDone = chỉ hằng ngày —
   dùng phân biệt ngày "trọn vẹn" (dailyDone === total), vì việc một lần
   không thế chỗ được một việc hằng ngày bỏ sót. */
export function dayStats(state, key) {
  const daily = tasksFor(state, key, 'daily');
  const total = daily.length;
  const dailyDone = daily.filter(t => isDone(state, key, t.id)).length;
  const done = tasksFor(state, key, 'all').filter(t => isDone(state, key, t.id)).length;
  // Việc bắt buộc còn thiếu: chỉ xét việc hằng ngày có hiệu lực ngày đó
  const requiredMissing = daily.filter(t => t.required && !isDone(state, key, t.id)).length;
  const threshold = total === 0 ? 0
    : state.minDone > 0 ? Math.min(state.minDone, total) : total;
  const complete = total > 0 && done >= threshold && requiredMissing === 0;
  return { total, done, dailyDone, threshold, requiredMissing, skipped: isSkipped(state, key), complete };
}

/* ===== Chuỗi ===== */
/* Chuỗi ngày hoàn thành liên tiếp, tính lùi từ hôm nay
   (hôm nay chưa đạt thì tính lùi từ hôm qua) */
export function currentStreak(state, todayKey) {
  let streak = 0;
  const today = dayStats(state, todayKey);
  if (!today.skipped && today.complete) streak++;
  const d = keyToDate(todayKey);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(d);
    const s = dayStats(state, key);
    if (!s.skipped) {                       // ngày nghỉ: xuyên qua, không cộng
      if (s.total === 0 || !s.complete) break;
      streak++;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/* Chuỗi của riêng một việc: hiện tại (lùi từ hôm nay) + dài nhất */
export function taskStreaks(state, t, todayKey) {
  let current = 0;
  if (!isSkipped(state, todayKey) && isActive(t, todayKey) && isDone(state, todayKey, t.id)) current++;
  const d = keyToDate(todayKey);
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3650; i++) {
    const key = dateKey(d);
    if (!isSkipped(state, key)) {           // ngày nghỉ trung lập với cả chuỗi từng việc
      if (!isActive(t, key) || !isDone(state, key, t.id)) break;
      current++;
    }
    d.setDate(d.getDate() - 1);
  }
  let longest = 0, run = 0;
  const it = keyToDate(t.createdAt);
  while (dateKey(it) <= todayKey) {
    const key = dateKey(it);
    if (isSkipped(state, key)) { /* trung lập: không cộng, không reset */ }
    else if (isActive(t, key) && isDone(state, key, t.id)) { run++; if (run > longest) longest = run; }
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

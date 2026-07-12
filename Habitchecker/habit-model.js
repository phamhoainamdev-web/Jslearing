/* habit-model — domain thói quen của Habit Checker.
   Toàn bộ là hàm thuần: `state` truyền vào tường minh, không đọc global,
   không đọc đồng hồ (ngày "hôm nay" cũng truyền vào) — nhờ vậy test được
   bằng Node mà không cần trình duyệt.

   Định nghĩa "ngày hoàn thành" (xem CONTEXT.md):
   - Ngày hoàn thành = tick đủ MỌI việc bắt buộc (cờ `required`) có hiệu lực
     ngày đó. Việc thường không ảnh hưởng — chỉ hiện trong tiến độ/thống kê.
   - Ngày không có việc bắt buộc nào có hiệu lực → không hoàn thành
     (chuỗi cần ít nhất một việc bắt buộc để có ý nghĩa).
   - Mẫu số (total) chỉ tính VIỆC HẰNG NGÀY; việc một lần đã tick
     "chỉ cộng, không trừ": cộng vào done nên done có thể vượt total (vd 5/3),
     nhưng không thế chỗ được việc bắt buộc bỏ sót.

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

/* ===== Nhóm hiển thị =====
   Chia một danh sách việc thành các mục theo nhóm (tab Hôm nay dùng):
   - Việc bắt buộc vào mục ảo 'required', LUÔN đứng đầu — dù nó thuộc nhóm nào
     (groupId của việc giữ nguyên, đây chỉ là cách hiển thị).
   - Các nhóm thật theo đúng thứ tự trong state.groups (người dùng sắp xếp được).
   - Việc không có nhóm (hoặc nhóm đã bị xóa) vào mục 'none' cuối cùng.
   Mục không có việc nào thì bỏ. Trả về [{ key, name, tasks }] —
   key: 'required' | id nhóm | 'none'; name chỉ có ở nhóm thật. */
export function groupTasks(state, tasks) {
  const groups = state.groups || [];
  const sections = [{ key: 'required', name: null, tasks: tasks.filter(t => t.required) }];
  for (const g of groups) {
    sections.push({ key: g.id, name: g.name, tasks: tasks.filter(t => !t.required && t.groupId === g.id) });
  }
  const known = new Set(groups.map(g => g.id));
  sections.push({ key: 'none', name: null, tasks: tasks.filter(t => !t.required && !known.has(t.groupId)) });
  return sections.filter(s => s.tasks.length > 0);
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
  // Việc bắt buộc: chỉ xét việc hằng ngày có hiệu lực ngày đó
  const required = daily.filter(t => t.required);
  const requiredTotal = required.length;
  const requiredMissing = required.filter(t => !isDone(state, key, t.id)).length;
  // Hoàn thành = có ít nhất một việc bắt buộc và tick đủ tất cả chúng
  const complete = requiredTotal > 0 && requiredMissing === 0;
  return { total, done, dailyDone, requiredTotal, requiredMissing, skipped: isSkipped(state, key), complete };
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
      if (!s.complete) break;
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

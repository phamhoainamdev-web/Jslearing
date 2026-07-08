import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, keyToDate, isActive, tasksFor, isDone,
  dayStats, currentStreak, taskStreaks, tasksForMonth,
} from './habit-model.js';

/* ===== Dựng dữ liệu giả ===== */
const daily = (id, createdAt, archivedAt = null) =>
  ({ id, name: id, repeat: 'daily', createdAt, archivedAt });
const once = (id, date) =>
  ({ id, name: id, repeat: 'once', date, createdAt: date });

function makeState({ tasks = [], records = {}, minDone = 3 } = {}) {
  return { tasks, records, minDone };
}

/* ===== Toán ngày ===== */
test('dateKey/keyToDate: đổi qua lại không lệch ngày', () => {
  assert.equal(dateKey(keyToDate('2026-02-05')), '2026-02-05');
  assert.equal(dateKey(keyToDate('2026-12-31')), '2026-12-31');
});

/* ===== isActive: các biên ===== */
test('isActive: việc hằng ngày tính từ createdAt, dừng trước archivedAt', () => {
  const t = daily('t1', '2026-07-01', '2026-07-10');
  assert.equal(isActive(t, '2026-06-30'), false); // trước ngày bắt đầu
  assert.equal(isActive(t, '2026-07-01'), true);  // đúng ngày bắt đầu
  assert.equal(isActive(t, '2026-07-09'), true);  // ngày cuối trước khi lưu trữ
  assert.equal(isActive(t, '2026-07-10'), false); // ngày lưu trữ không còn hiệu lực
});

test('isActive: việc một lần chỉ có hiệu lực đúng ngày của nó', () => {
  const t = once('o1', '2026-07-08');
  assert.equal(isActive(t, '2026-07-07'), false);
  assert.equal(isActive(t, '2026-07-08'), true);
  assert.equal(isActive(t, '2026-07-09'), false);
});

/* ===== tasksFor: scope ===== */
test('tasksFor: scope daily loại việc một lần, scope all gồm cả', () => {
  const state = makeState({
    tasks: [daily('t1', '2026-07-01'), once('o1', '2026-07-08')],
  });
  assert.deepEqual(tasksFor(state, '2026-07-08', 'daily').map(t => t.id), ['t1']);
  assert.deepEqual(tasksFor(state, '2026-07-08', 'all').map(t => t.id), ['t1', 'o1']);
  assert.deepEqual(tasksFor(state, '2026-07-07', 'all').map(t => t.id), ['t1']);
});

/* ===== dayStats: định nghĩa "ngày hoàn thành" ===== */
test('dayStats: đạt ngưỡng minDone thì hoàn thành', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01'), daily('b', '2026-07-01'),
            daily('c', '2026-07-01'), daily('d', '2026-07-01')],
    records: { '2026-07-08': { a: true, b: true } },
    minDone: 3,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 4, done: 2, dailyDone: 2, threshold: 3, complete: false });
  state.records['2026-07-08'].c = true;
  assert.equal(dayStats(state, '2026-07-08').complete, true);
});

test('dayStats: minDone=0 nghĩa là phải đủ tất cả việc hằng ngày', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01'), daily('b', '2026-07-01')],
    records: { '2026-07-08': { a: true } },
    minDone: 0,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 2, done: 1, dailyDone: 1, threshold: 2, complete: false });
});

test('dayStats: việc một lần đã tick chỉ cộng vào done, không tăng ngưỡng', () => {
  // 2 việc hằng ngày (1 tick) + 1 việc một lần đã tick, minDone=3
  // → ngưỡng vẫn là min(3, 2) = 2, done = 2 → hoàn thành nhờ việc một lần
  const state = makeState({
    tasks: [daily('a', '2026-07-01'), daily('b', '2026-07-01'), once('o1', '2026-07-08')],
    records: { '2026-07-08': { a: true, o1: true } },
    minDone: 3,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 2, done: 2, dailyDone: 1, threshold: 2, complete: true });
});

test('dayStats: việc một lần CHƯA tick không làm ngày khó đạt hơn', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01'), once('o1', '2026-07-08')],
    records: { '2026-07-08': { a: true } },
    minDone: 0, // phải đủ tất cả — nhưng "tất cả" chỉ tính việc hằng ngày
  });
  assert.equal(dayStats(state, '2026-07-08').complete, true);
});

test('dayStats: done có thể vượt total (5/3)', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01'), daily('b', '2026-07-01'), daily('c', '2026-07-01'),
            once('o1', '2026-07-08'), once('o2', '2026-07-08')],
    records: { '2026-07-08': { a: true, b: true, c: true, o1: true, o2: true } },
    minDone: 3,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 3, done: 5, dailyDone: 3, threshold: 3, complete: true });
});

test('dayStats: ngày không có việc hằng ngày → không hoàn thành, kể cả có tick một lần', () => {
  const state = makeState({
    tasks: [once('o1', '2026-07-08')],
    records: { '2026-07-08': { o1: true } },
    minDone: 3,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 0, done: 1, dailyDone: 0, threshold: 0, complete: false });
});

test('dayStats: dailyDone phân biệt ngày "đạt ngưỡng" với ngày "trọn vẹn"', () => {
  // 9 việc hằng ngày, ngưỡng 3, tick 3 → đạt ngưỡng nhưng CHƯA trọn vẹn
  const tasks = 'abcdefghi'.split('').map(id => daily(id, '2026-07-01'));
  const state = makeState({
    tasks,
    records: { '2026-07-08': { a: true, b: true, c: true } },
    minDone: 3,
  });
  let s = dayStats(state, '2026-07-08');
  assert.equal(s.complete, true);
  assert.equal(s.dailyDone < s.total, true); // heatmap: mức 3, không phải 4
  // tick đủ cả 9 → trọn vẹn
  for (const t of tasks) state.records['2026-07-08'][t.id] = true;
  s = dayStats(state, '2026-07-08');
  assert.equal(s.dailyDone, s.total); // heatmap: mức 4
});

/* ===== currentStreak ===== */
test('currentStreak: đếm lùi, hôm nay chưa đạt thì bắt đầu từ hôm qua', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01')],
    records: {
      '2026-07-06': { a: true },
      '2026-07-07': { a: true },
      // 2026-07-08 (hôm nay) chưa tick
    },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 2);
  state.records['2026-07-08'] = { a: true };
  assert.equal(currentStreak(state, '2026-07-08'), 3);
});

test('currentStreak: đứt ở ngày không đạt', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01')],
    records: {
      '2026-07-05': { a: true },
      // 2026-07-06 bỏ trống → đứt
      '2026-07-07': { a: true },
      '2026-07-08': { a: true },
    },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 2);
});

test('currentStreak: dừng đếm trước ngày bắt đầu theo dõi', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-07')],
    records: { '2026-07-07': { a: true }, '2026-07-08': { a: true } },
    minDone: 1,
  });
  // trước 07/07 không có việc nào → total = 0 → dừng, không đếm vô hạn
  assert.equal(currentStreak(state, '2026-07-08'), 2);
});

/* ===== taskStreaks ===== */
test('taskStreaks: chuỗi hiện tại và chuỗi dài nhất qua khoảng nghỉ', () => {
  const t = daily('a', '2026-07-01');
  const state = makeState({
    tasks: [t],
    records: {
      '2026-07-01': { a: true },
      '2026-07-02': { a: true },
      '2026-07-03': { a: true },
      // 04–06 nghỉ
      '2026-07-07': { a: true },
      '2026-07-08': { a: true },
    },
    minDone: 1,
  });
  assert.deepEqual(taskStreaks(state, t, '2026-07-08'), { current: 2, longest: 3 });
});

/* ===== tasksForMonth ===== */
test('tasksForMonth: việc hằng ngày giao với tháng, việc một lần đúng tháng', () => {
  const state = makeState({
    tasks: [
      daily('inMonth', '2026-07-15'),            // bắt đầu giữa tháng 7
      daily('old', '2026-05-01', '2026-06-20'),  // lưu trữ trước tháng 7
      daily('archMid', '2026-05-01', '2026-07-05'), // lưu trữ giữa tháng 7 → vẫn hiện
      once('oJul', '2026-07-20'),
      once('oAug', '2026-08-02'),
    ],
  });
  assert.deepEqual(tasksForMonth(state, 2026, 6).map(t => t.id), // tháng 7 = index 6
    ['inMonth', 'archMid', 'oJul']);
});

/* ===== isDone ===== */
test('isDone: đọc records, ngày trống trả false', () => {
  const state = makeState({ records: { '2026-07-08': { a: true } } });
  assert.equal(isDone(state, '2026-07-08', 'a'), true);
  assert.equal(isDone(state, '2026-07-08', 'b'), false);
  assert.equal(isDone(state, '2026-07-01', 'a'), false);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dateKey, keyToDate, isActive, tasksFor, isDone, isSkipped,
  dayStats, currentStreak, taskStreaks, tasksForMonth, groupTasks,
} from './habit-model.js';

/* ===== Dựng dữ liệu giả ===== */
const daily = (id, createdAt, archivedAt = null) =>
  ({ id, name: id, repeat: 'daily', createdAt, archivedAt });
const required = (id, createdAt, archivedAt = null) =>
  ({ ...daily(id, createdAt, archivedAt), required: true });
const once = (id, date) =>
  ({ id, name: id, repeat: 'once', date, createdAt: date });

function makeState({ tasks = [], records = {}, minDone = 3, skips = {} } = {}) {
  return { tasks, records, minDone, skips };
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
    { total: 4, done: 2, dailyDone: 2, threshold: 3, requiredMissing: 0, skipped: false, complete: false });
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
    { total: 2, done: 1, dailyDone: 1, threshold: 2, requiredMissing: 0, skipped: false, complete: false });
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
    { total: 2, done: 2, dailyDone: 1, threshold: 2, requiredMissing: 0, skipped: false, complete: true });
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
    { total: 3, done: 5, dailyDone: 3, threshold: 3, requiredMissing: 0, skipped: false, complete: true });
});

test('dayStats: ngày không có việc hằng ngày → không hoàn thành, kể cả có tick một lần', () => {
  const state = makeState({
    tasks: [once('o1', '2026-07-08')],
    records: { '2026-07-08': { o1: true } },
    minDone: 3,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 0, done: 1, dailyDone: 0, threshold: 0, requiredMissing: 0, skipped: false, complete: false });
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

/* ===== dayStats: việc bắt buộc ===== */
test('dayStats: đạt ngưỡng nhưng thiếu việc bắt buộc → chưa hoàn thành', () => {
  // 3 việc, ngưỡng 2, tick 2 việc thường — việc bắt buộc 'r' chưa tick
  const state = makeState({
    tasks: [required('r', '2026-07-01'), daily('a', '2026-07-01'), daily('b', '2026-07-01')],
    records: { '2026-07-08': { a: true, b: true } },
    minDone: 2,
  });
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 3, done: 2, dailyDone: 2, threshold: 2, requiredMissing: 1, skipped: false, complete: false });
  // tick nốt việc bắt buộc → hoàn thành
  state.records['2026-07-08'].r = true;
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 3, done: 3, dailyDone: 3, threshold: 2, requiredMissing: 0, skipped: false, complete: true });
});

test('dayStats: đủ việc bắt buộc nhưng chưa đạt ngưỡng → vẫn chưa hoàn thành', () => {
  // ngưỡng 3, chỉ tick đúng 1 việc bắt buộc → thiếu số lượng
  const state = makeState({
    tasks: [required('r', '2026-07-01'), daily('a', '2026-07-01'),
            daily('b', '2026-07-01'), daily('c', '2026-07-01')],
    records: { '2026-07-08': { r: true } },
    minDone: 3,
  });
  const s = dayStats(state, '2026-07-08');
  assert.equal(s.requiredMissing, 0);
  assert.equal(s.complete, false);
});

test('dayStats: việc bắt buộc chỉ tính vào những ngày nó có hiệu lực', () => {
  // 'r' bắt đầu 07/07 và lưu trữ 07/10 → ngày 06/07 và 10/07 không đòi 'r'
  const state = makeState({
    tasks: [required('r', '2026-07-07', '2026-07-10'), daily('a', '2026-07-01')],
    records: { '2026-07-06': { a: true }, '2026-07-10': { a: true } },
    minDone: 1,
  });
  assert.equal(dayStats(state, '2026-07-06').complete, true);  // trước ngày bắt đầu của r
  assert.equal(dayStats(state, '2026-07-10').complete, true);  // r đã lưu trữ
  assert.equal(dayStats(state, '2026-07-08').requiredMissing, 1); // trong khoảng hiệu lực
});

test('dayStats: việc một lần đã tick không thế chỗ được việc bắt buộc', () => {
  const state = makeState({
    tasks: [required('r', '2026-07-01'), once('o1', '2026-07-08')],
    records: { '2026-07-08': { o1: true } },
    minDone: 1,
  });
  // done = 1 ≥ ngưỡng 1, nhưng r chưa tick → chưa hoàn thành
  assert.deepEqual(dayStats(state, '2026-07-08'),
    { total: 1, done: 1, dailyDone: 0, threshold: 1, requiredMissing: 1, skipped: false, complete: false });
});

test('currentStreak: bỏ việc bắt buộc một ngày trong quá khứ là đứt chuỗi ở đó', () => {
  const state = makeState({
    tasks: [required('r', '2026-07-01'), daily('a', '2026-07-01')],
    records: {
      '2026-07-06': { r: true, a: true },
      '2026-07-07': { a: true },          // đủ ngưỡng nhưng thiếu r → đứt
      '2026-07-08': { r: true, a: true },
    },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 1);
});

/* ===== Ngày nghỉ ===== */
test('isSkipped: đọc map skips; lý do rỗng vẫn là nghỉ; state cũ không có skips → false', () => {
  const state = makeState({ skips: { '2026-07-07': 'ốm', '2026-07-08': '' } });
  assert.equal(isSkipped(state, '2026-07-07'), true);
  assert.equal(isSkipped(state, '2026-07-08'), true);  // lý do rỗng
  assert.equal(isSkipped(state, '2026-07-09'), false);
  assert.equal(isSkipped({ tasks: [], records: {} }, '2026-07-07'), false); // dữ liệu cũ
});

test('currentStreak: chuỗi xuyên qua ngày nghỉ, không cộng ngày nghỉ', () => {
  // 05✓ 06✓ [07 nghỉ] 08✓(hôm nay) → chuỗi 3, không phải 4
  const state = makeState({
    tasks: [daily('a', '2026-07-01')],
    records: { '2026-07-05': { a: true }, '2026-07-06': { a: true }, '2026-07-08': { a: true } },
    skips: { '2026-07-07': 'ốm' },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 3);
});

test('currentStreak: hôm nay nghỉ → trung lập kể cả đã tick đủ, đếm từ hôm qua', () => {
  const state = makeState({
    tasks: [daily('a', '2026-07-01')],
    records: { '2026-07-06': { a: true }, '2026-07-07': { a: true }, '2026-07-08': { a: true } },
    skips: { '2026-07-08': 'đi chơi' },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 2); // 06 + 07, hôm nay không cộng
});

test('currentStreak: ngày nghỉ không cứu được ngày trượt thật', () => {
  // 06 trượt, 07 nghỉ, 08✓ → chuỗi vẫn đứt ở 06, còn 1
  const state = makeState({
    tasks: [daily('a', '2026-07-01')],
    records: { '2026-07-05': { a: true }, '2026-07-08': { a: true } },
    skips: { '2026-07-07': '' },
    minDone: 1,
  });
  assert.equal(currentStreak(state, '2026-07-08'), 1);
});

test('taskStreaks: ngày nghỉ trung lập với chuỗi từng việc (hiện tại + dài nhất)', () => {
  const t = daily('a', '2026-07-01');
  const state = makeState({
    tasks: [t],
    records: {
      '2026-07-01': { a: true }, '2026-07-02': { a: true },
      // 03 nghỉ, 04 trượt thật → chuỗi đầu dừng ở 2
      '2026-07-05': { a: true }, '2026-07-06': { a: true },
      // 07 nghỉ (xuyên qua)
      '2026-07-08': { a: true },
    },
    skips: { '2026-07-03': '', '2026-07-07': 'ốm' },
    minDone: 1,
  });
  assert.deepEqual(taskStreaks(state, t, '2026-07-08'), { current: 3, longest: 3 });
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

/* ===== groupTasks: chia việc theo nhóm để hiển thị ===== */
test('groupTasks: bắt buộc luôn đứng đầu, kéo việc ra khỏi nhóm gốc của nó', () => {
  const state = makeState({
    tasks: [
      { ...daily('gym', '2026-07-01'), groupId: 'g1' },
      { ...required('js', '2026-07-01'), groupId: 'g2' }, // bắt buộc dù thuộc g2
      { ...daily('read', '2026-07-01'), groupId: 'g2' },
      daily('note', '2026-07-01'), // không nhóm
    ],
  });
  state.groups = [{ id: 'g1', name: 'Sức khỏe' }, { id: 'g2', name: 'Học tập' }];
  const secs = groupTasks(state, state.tasks);
  assert.deepEqual(secs.map(s => s.key), ['required', 'g1', 'g2', 'none']);
  assert.deepEqual(secs.map(s => s.tasks.map(t => t.id)), [['js'], ['gym'], ['read'], ['note']]);
  assert.equal(secs[1].name, 'Sức khỏe');
});

test('groupTasks: theo đúng thứ tự state.groups — đổi thứ tự nhóm là đổi thứ tự mục', () => {
  const state = makeState({
    tasks: [
      { ...daily('gym', '2026-07-01'), groupId: 'g1' },
      { ...daily('read', '2026-07-01'), groupId: 'g2' },
    ],
  });
  state.groups = [{ id: 'g2', name: 'Học tập' }, { id: 'g1', name: 'Sức khỏe' }];
  assert.deepEqual(groupTasks(state, state.tasks).map(s => s.key), ['g2', 'g1']);
});

test('groupTasks: mục rỗng bị bỏ; nhóm đã xóa coi như không nhóm', () => {
  const state = makeState({
    tasks: [{ ...daily('a', '2026-07-01'), groupId: 'gDeleted' }],
  });
  state.groups = [{ id: 'g1', name: 'Trống' }]; // g1 không có việc nào
  const secs = groupTasks(state, state.tasks);
  assert.deepEqual(secs.map(s => s.key), ['none']);
  assert.deepEqual(secs[0].tasks.map(t => t.id), ['a']);
});

test('groupTasks: không nhóm, không bắt buộc → một mục none duy nhất (state cũ chưa có groups)', () => {
  const state = makeState({ tasks: [daily('a', '2026-07-01'), daily('b', '2026-07-01')] });
  const secs = groupTasks(state, state.tasks);
  assert.deepEqual(secs.map(s => s.key), ['none']);
  assert.equal(secs[0].tasks.length, 2);
});

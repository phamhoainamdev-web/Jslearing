import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, keyToDate } from './habit-model.js';
import {
  mondayOf, firstTrackedKey, lifetimeStats, earnedBadges, nextMilestone,
  economySummary, spinPick,
} from './reward-model.js';

/* ===== Dựng dữ liệu giả =====
   Mốc thời gian dùng chung: 2026-06-01 là THỨ HAI — các test luật tuần
   dựa vào điều đó (T2=01, T3=02 ... CN=07; tuần sau bắt đầu 08). */
const required = (id, createdAt) =>
  ({ id, name: id, repeat: 'daily', createdAt, archivedAt: null, required: true });
const daily = (id, createdAt) =>
  ({ id, name: id, repeat: 'daily', createdAt, archivedAt: null });

function makeState({ tasks = [], records = {}, skips = {}, spins = [], pool = [] } = {}) {
  return { tasks, records, skips, economy: { spins, pool } };
}

/* Tick những việc `ids` vào từng ngày trong `keys` */
function tick(records, keys, ids) {
  for (const key of keys) {
    records[key] ||= {};
    for (const id of ids) records[key][id] = true;
  }
  return records;
}

/* Dãy ngày liên tiếp [from..to] */
function range(from, to) {
  const keys = [];
  const d = keyToDate(from);
  while (dateKey(d) <= to) { keys.push(dateKey(d)); d.setDate(d.getDate() + 1); }
  return keys;
}

/* ===== Toán tuần ===== */
test('mondayOf: về đúng Thứ 2 của tuần, kể cả Chủ nhật', () => {
  assert.equal(mondayOf('2026-06-01'), '2026-06-01'); // Thứ 2 giữ nguyên
  assert.equal(mondayOf('2026-06-04'), '2026-06-01'); // Thứ 5
  assert.equal(mondayOf('2026-06-07'), '2026-06-01'); // Chủ nhật vẫn thuộc tuần cũ
  assert.equal(mondayOf('2026-06-08'), '2026-06-08'); // Thứ 2 tuần sau
});

test('firstTrackedKey: ngày bắt đầu sớm nhất; chưa có việc → null', () => {
  assert.equal(firstTrackedKey(makeState()), null);
  const s = makeState({ tasks: [required('r', '2026-06-03'), daily('a', '2026-06-01')] });
  assert.equal(firstTrackedKey(s), '2026-06-01');
});

/* ===== Mảnh ngày hoàn hảo ===== */
test('ngày hoàn hảo (tick hết MỌI việc) → 1 mảnh', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  tick(s.records, ['2026-06-01'], ['r']);
  assert.equal(economySummary(s, '2026-06-01').pieces, 1);
});

test('ngày hoàn thành nhưng còn việc thường chưa tick → KHÔNG có mảnh', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01'), daily('a', '2026-06-01')] });
  tick(s.records, ['2026-06-01'], ['r']); // đủ bắt buộc, thiếu việc thường
  assert.equal(economySummary(s, '2026-06-01').pieces, 0);
});

test('ngày nghỉ tick đủ vẫn KHÔNG sinh gì (trung lập)', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')], skips: { '2026-06-01': '' } });
  tick(s.records, ['2026-06-01'], ['r']);
  assert.equal(economySummary(s, '2026-06-01').pieces, 0);
});

/* ===== Luật tuần =====
   Dùng cặp [r bắt buộc + a thường], chỉ tick r: ngày hoàn thành nhưng
   KHÔNG hoàn hảo → cô lập nguồn mảnh/vé của riêng luật tuần. */
function weekState() {
  return makeState({ tasks: [required('r', '2026-06-01'), daily('a', '2026-06-01')] });
}

test('tuần: 3 ngày liên tiếp → 1 mảnh, chỉ 1 lần/tuần', () => {
  const s = weekState();
  tick(s.records, ['2026-06-01', '2026-06-02', '2026-06-03'], ['r']);
  const sum = economySummary(s, '2026-06-03');
  assert.equal(sum.pieces, 1);
  assert.equal(sum.weekRun, 3);
  assert.equal(sum.weekPieceEarned, true);
  // thêm ngày 4, 5 — vẫn chỉ 1 mảnh (chưa chạm mốc 6)
  tick(s.records, ['2026-06-04', '2026-06-05'], ['r']);
  assert.equal(economySummary(s, '2026-06-05').pieces, 1);
});

test('tuần: 6 ngày liên tiếp → thêm 1 vé thẳng', () => {
  const s = weekState();
  tick(s.records, range('2026-06-01', '2026-06-06'), ['r']);
  const sum = economySummary(s, '2026-06-06');
  assert.equal(sum.pieces, 1);   // mốc 3 ngày
  assert.equal(sum.tickets, 1);  // mốc 6 ngày
  assert.equal(sum.weekTicketEarned, true);
  // ngày thứ 7 (Chủ nhật) không sinh thêm — mỗi mốc 1 lần/tuần
  tick(s.records, ['2026-06-07'], ['r']);
  assert.equal(economySummary(s, '2026-06-07').tickets, 1);
});

test('tuần: skip xen giữa không đứt, không cộng (T2✓ T3✓ T4😷 T5✓ → run 3)', () => {
  const s = weekState();
  s.skips['2026-06-03'] = 'ốm';
  tick(s.records, ['2026-06-01', '2026-06-02', '2026-06-04'], ['r']);
  const sum = economySummary(s, '2026-06-04');
  assert.equal(sum.weekRun, 3);
  assert.equal(sum.pieces, 1);
});

test('tuần: ngày trượt thật làm đứt đếm liên tiếp trong tuần', () => {
  const s = weekState();
  tick(s.records, ['2026-06-01', '2026-06-02', '2026-06-04', '2026-06-05'], ['r']);
  // 03 trượt (có việc bắt buộc mà không tick) → run về 0, 04-05 mới đếm 2
  const sum = economySummary(s, '2026-06-05');
  assert.equal(sum.weekRun, 2);
  assert.equal(sum.pieces, 0);
});

test('tuần: chuỗi vắt qua CN→T2 KHÔNG tính — tuần mới đếm lại từ đầu', () => {
  const s = weekState();
  // T7 06, CN 07, T2 08 — ba ngày liên tiếp nhưng thuộc hai tuần
  tick(s.records, ['2026-06-06', '2026-06-07', '2026-06-08'], ['r']);
  const sum = economySummary(s, '2026-06-08');
  assert.equal(sum.pieces, 0);
  assert.equal(sum.weekRun, 1); // tuần mới chỉ mới có T2
});

test('hôm nay chưa hoàn thành: weekRun giữ số của hôm qua, không coi là đứt', () => {
  const s = weekState();
  tick(s.records, ['2026-06-01', '2026-06-02'], ['r']);
  assert.equal(economySummary(s, '2026-06-03').weekRun, 2);
});

/* ===== Quy đổi & trần ===== */
test('3 mảnh tự quy đổi thành 1 vé', () => {
  // Chỉ có việc bắt buộc → mỗi ngày hoàn thành là ngày hoàn hảo (1 mảnh/ngày)
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  tick(s.records, ['2026-06-01', '2026-06-02'], ['r']);
  let sum = economySummary(s, '2026-06-02');
  assert.deepEqual([sum.pieces, sum.tickets], [2, 0]);
  // ngày 3: +1 mảnh hoàn hảo → đủ 3 đổi vé; +1 mảnh mốc tuần → còn 1 mảnh
  tick(s.records, ['2026-06-03'], ['r']);
  sum = economySummary(s, '2026-06-03');
  assert.deepEqual([sum.pieces, sum.tickets], [1, 1]);
});

test('trần 2 vé + 2 mảnh: kho đầy thì nguồn sinh mất luôn, không tích vô hạn', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  // 2 tuần hoàn hảo liên tục: kiếm được nhiều hơn trần rất nhiều
  tick(s.records, range('2026-06-01', '2026-06-14'), ['r']);
  const sum = economySummary(s, '2026-06-14');
  assert.equal(sum.tickets, 2);
  assert.equal(sum.pieces, 2);
});

test('replay ≠ tổng trừ tổng: tiêu sạch ở cuối thì số dư 0, phần sinh khi kho đầy không sống lại', () => {
  const s = makeState({
    tasks: [required('r', '2026-06-01')],
    spins: [
      { id: 's1', date: '2026-06-14', rewardId: 'p1', rewardName: 'Trà sữa', kind: 'normal' },
      { id: 's2', date: '2026-06-14', rewardId: 'p1', rewardName: 'Trà sữa', kind: 'normal' },
    ],
  });
  tick(s.records, range('2026-06-01', '2026-06-14'), ['r']);
  // Nếu tính "tổng kiếm − tổng tiêu rồi clamp" thì vẫn ra 2 vé (kiếm ~6 − tiêu 2).
  // Replay đúng: đến 14/06 kho 2 vé, quay 2 lượt → 0, sau đó không kiếm gì nữa.
  assert.equal(economySummary(s, '2026-06-14').tickets, 0);
});

test('tiêu xong mới có chỗ tích tiếp: vé sinh sau lượt quay được giữ lại', () => {
  const s = makeState({
    tasks: [required('r', '2026-06-01')],
    spins: [{ id: 's1', date: '2026-06-07', rewardId: 'p1', rewardName: 'Trà sữa', kind: 'normal' }],
  });
  tick(s.records, range('2026-06-01', '2026-06-14'), ['r']);
  // Đến 07/06 kho đầy 2 vé, quay 1 → còn 1; tuần sau kiếm tiếp → đầy lại 2
  assert.equal(economySummary(s, '2026-06-14').tickets, 2);
});

test('clamp hồi tố: bỏ tick quá khứ sau khi đã quay → số dư 0, không âm, log giữ nguyên', () => {
  const s = makeState({
    tasks: [required('r', '2026-06-01')],
    spins: [{ id: 's1', date: '2026-06-03', rewardId: 'p1', rewardName: 'Trà sữa', kind: 'normal' }],
  });
  tick(s.records, ['2026-06-01'], ['r']); // chỉ còn 1 ngày — kiếm 1 mảnh, 0 vé
  const sum = economySummary(s, '2026-06-03');
  assert.equal(sum.tickets, 0);
  assert.equal(sum.pieces, 1);
  assert.equal(s.economy.spins.length, 1); // hàm thuần không đụng vào log
});

/* ===== Jackpot ===== */
test('mốc chuỗi 100 → 1 lượt jackpot, đứt rồi đạt lại 100 KHÔNG thêm (1 lần vĩnh viễn)', () => {
  const s = makeState({ tasks: [required('r', '2026-01-01')] });
  tick(s.records, range('2026-01-01', '2026-04-10'), ['r']); // 100 ngày
  assert.equal(economySummary(s, '2026-04-10').jackpotSpins, 1);
  // trượt 11/04 rồi lại 100 ngày nữa (12/04 → 20/07)
  tick(s.records, range('2026-04-12', '2026-07-20'), ['r']);
  assert.equal(economySummary(s, '2026-07-20').jackpotSpins, 1);
});

test('quay jackpot trừ lượt jackpot, không trừ vé', () => {
  const s = makeState({
    tasks: [required('r', '2026-01-01')],
    spins: [{ id: 's1', date: '2026-04-10', rewardId: 'p1', rewardName: 'Buffet', kind: 'jackpot' }],
  });
  tick(s.records, range('2026-01-01', '2026-04-10'), ['r']);
  const sum = economySummary(s, '2026-04-10');
  assert.equal(sum.jackpotSpins, 0);
  assert.equal(sum.tickets, 2); // vé thường vẫn nguyên (đầy trần)
});

/* ===== Tầng danh dự ===== */
test('huy hiệu giữ vĩnh viễn: chuỗi 30 rồi đứt, longestStreak vẫn 30', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  tick(s.records, range('2026-06-01', '2026-06-30'), ['r']); // 30 ngày
  // 01–05/07 trượt, hôm nay 06/07
  const stats = lifetimeStats(s, '2026-07-06');
  assert.equal(stats.longestStreak, 30);
  assert.deepEqual(earnedBadges(stats.longestStreak), [7, 14, 30]);
});

test('"Trở lại" đếm lặp: mỗi lần hoàn thành ngay sau ngày trượt thật là ×1', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  // ✓ 01, trượt 02, ✓ 03 (trở lại ×1), trượt 04, ✓ 05 (trở lại ×2)
  tick(s.records, ['2026-06-01', '2026-06-03', '2026-06-05'], ['r']);
  assert.equal(lifetimeStats(s, '2026-06-05').comebackCount, 2);
});

test('"Trở lại" KHÔNG kích hoạt sau ngày nghỉ, và lần hoàn thành đầu đời không tính', () => {
  const s = makeState({ tasks: [required('r', '2026-06-01')] });
  // trượt 01 (chưa từng hoàn thành) → ✓ 02: không phải "trở lại"
  // ✓ 02, nghỉ 03, ✓ 04: nghỉ không phải trượt → không tính
  s.skips['2026-06-03'] = '';
  tick(s.records, ['2026-06-02', '2026-06-04'], ['r']);
  assert.equal(lifetimeStats(s, '2026-06-04').comebackCount, 0);
});

test('nextMilestone: mốc kế của chuỗi hiện tại; qua 365 thì null', () => {
  assert.deepEqual(nextMilestone(0), { target: 7, remaining: 7 });
  assert.deepEqual(nextMilestone(28), { target: 30, remaining: 2 });
  assert.equal(nextMilestone(365), null);
});

/* ===== Gacha ===== */
test('spinPick: chọn theo trọng số với rng cố định', () => {
  const pool = [
    { id: 'a', name: 'Cà phê', weight: 1, tier: 'normal' },
    { id: 'b', name: 'Trà sữa', weight: 3, tier: 'normal' },
  ];
  // tổng weight 4: r < 1 → a, r ≥ 1 → b
  assert.equal(spinPick(pool, 'normal', () => 0).id, 'a');
  assert.equal(spinPick(pool, 'normal', () => 0.5).id, 'b');   // 0.5×4 = 2 → b
  assert.equal(spinPick(pool, 'normal', () => 0.999).id, 'b');
});

test('spinPick: kind jackpot chỉ ra món tier jackpot; quay thường thì cả pool', () => {
  const pool = [
    { id: 'a', name: 'Cà phê', weight: 100, tier: 'normal' },
    { id: 'j', name: 'Buffet', weight: 1, tier: 'jackpot' },
  ];
  assert.equal(spinPick(pool, 'jackpot', () => 0.99).id, 'j');
  assert.equal(spinPick(pool, 'normal', () => 0).id, 'a'); // món jackpot vẫn nằm trong pool thường
});

test('spinPick: pool rỗng hoặc không có món hợp lệ → null', () => {
  assert.equal(spinPick([], 'normal', () => 0), null);
  assert.equal(spinPick([{ id: 'a', name: 'x', weight: 0, tier: 'normal' }], 'normal', () => 0), null);
  assert.equal(spinPick([{ id: 'a', name: 'x', weight: 5, tier: 'normal' }], 'jackpot', () => 0), null);
});

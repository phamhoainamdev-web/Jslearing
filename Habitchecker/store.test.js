import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStore, normalize } from './store.js';

/* Bộ nhớ giả thay cho localStorage — store không biết nó đang chạy ở Node */
function makeStorage(initial = null) {
  let data = initial === null ? null : JSON.stringify(initial);
  return {
    get: () => data,
    set: (json) => { data = json; },
    /* tiện cho test: đọc lại thứ đã lưu */
    saved: () => JSON.parse(data),
  };
}

/* ===== normalize ===== */
test('normalize: dữ liệu trống/hỏng ra đủ trường mặc định', () => {
  const s = normalize(null);
  assert.deepEqual(s.tasks, []);
  assert.deepEqual(s.records, {});
  assert.deepEqual(s.achievements, []);
  assert.deepEqual(s.skips, {});
  assert.deepEqual(s.groups, []);
  assert.deepEqual(s.js, { weekPlans: {}, checkpoints: {}, checkins: {} });
});

test('normalize: nhật ký dạng cũ { ngày: text } thành mảng', () => {
  const s = normalize({ achievements: { '2026-07-01': 'học xong store' } });
  assert.equal(s.achievements.length, 1);
  assert.equal(s.achievements[0].date, '2026-07-01');
  assert.equal(s.achievements[0].text, 'học xong store');
});

/* ===== commit: lưu + báo listener ===== */
test('mutation nào cũng tự lưu và báo listener nguồn local', () => {
  const storage = makeStorage();
  const store = createStore(storage);
  const events = [];
  store.onChange(src => events.push(src));

  store.addTask({ name: 'Học JS' });
  assert.deepEqual(events, ['local']);
  assert.equal(storage.saved().tasks[0].name, 'Học JS');
  assert.equal(typeof storage.saved().updatedAt, 'number'); // đóng dấu để so với bản online
});

test('toggleTick: tick rồi bỏ tick thì records sạch (không còn ngày rỗng)', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'a' });
  const id = store.state.tasks[0].id;
  store.toggleTick('2026-07-10', id);
  assert.equal(store.state.records['2026-07-10'][id], true);
  store.toggleTick('2026-07-10', id);
  assert.equal('2026-07-10' in store.state.records, false);
});

test('toggleRequired: bật rồi tắt cờ bắt buộc của việc', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'Tập thể dục' });
  const id = store.state.tasks[0].id;
  store.toggleRequired(id);
  assert.equal(store.state.tasks[0].required, true);
  store.toggleRequired(id);
  assert.equal(store.state.tasks[0].required, false);
});

test('setSkip/clearSkip: thêm ngày nghỉ (lý do có thể rỗng) rồi xóa sạch', () => {
  const store = createStore(makeStorage());
  store.setSkip('2026-07-10', 'ốm');
  store.setSkip('2026-07-11', '');
  assert.deepEqual(store.state.skips, { '2026-07-10': 'ốm', '2026-07-11': '' });
  store.clearSkip('2026-07-10');
  assert.deepEqual(store.state.skips, { '2026-07-11': '' });
});

test('deleteTask: xóa việc thì lịch sử tick của nó cũng sạch', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'a' });
  store.addTask({ name: 'b' });
  const [a, b] = store.state.tasks.map(t => t.id);
  store.toggleTick('2026-07-10', a);
  store.toggleTick('2026-07-10', b);
  store.deleteTask(a);
  assert.equal(store.state.tasks.length, 1);
  assert.equal(a in (store.state.records['2026-07-10'] || {}), false);
  assert.equal(store.state.records['2026-07-10'][b], true); // việc khác không bị vạ lây
});

test('moveOnceTask: dấu tick đi theo ngày mới', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'khám răng', repeat: 'once', date: '2026-07-10' });
  const id = store.state.tasks[0].id;
  store.toggleTick('2026-07-10', id);
  store.moveOnceTask(id, '2026-07-12');
  assert.equal('2026-07-10' in store.state.records, false);
  assert.equal(store.state.records['2026-07-12'][id], true);
});

test('reorderDaily: đổi thứ tự việc hằng ngày, việc khác dồn về cuối', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'a' });
  store.addTask({ name: 'b' });
  store.addTask({ name: 'khám răng', repeat: 'once', date: '2026-07-10' });
  const [a, b] = store.state.tasks.map(t => t.id);
  store.reorderDaily([b, a]);
  assert.deepEqual(store.state.tasks.map(t => t.name), ['b', 'a', 'khám răng']);
});

/* ===== nhóm việc ===== */
test('addTask: gắn nhóm ngay lúc tạo việc', () => {
  const store = createStore(makeStorage());
  store.addGroup('💪 Sức khỏe');
  const g = store.state.groups[0].id;
  store.addTask({ name: 'gym', groupId: g });
  assert.equal(store.state.tasks[0].groupId, g);
});

test('reorderGroups: đổi thứ tự nhóm, nhóm không nằm trong mảng dồn về cuối', () => {
  const store = createStore(makeStorage());
  store.addGroup('Sức khỏe');
  store.addGroup('Học tập');
  store.addGroup('Gia đình');
  const [g1, g2, g3] = store.state.groups.map(g => g.id);
  store.reorderGroups([g3, g1]);
  assert.deepEqual(store.state.groups.map(g => g.name), ['Gia đình', 'Sức khỏe', 'Học tập']);
});

test('deleteGroup: xóa nhóm thì việc trong nhóm về "chưa phân nhóm", không mất việc', () => {
  const store = createStore(makeStorage());
  store.addTask({ name: 'gym' });
  store.addGroup('💪 Sức khỏe');
  const g = store.state.groups[0].id;
  const t = store.state.tasks[0].id;
  store.setTaskGroup(t, g);
  assert.equal(store.state.tasks[0].groupId, g);
  store.deleteGroup(g);
  assert.deepEqual(store.state.groups, []);
  assert.equal(store.state.tasks[0].groupId, null);
  assert.equal(store.state.tasks.length, 1);
});

/* ===== nhật ký ===== */
test('editAchievement: sửa thành chuỗi rỗng nghĩa là xóa', () => {
  const store = createStore(makeStorage());
  store.addAchievement('2026-07-12', 'mệt vì mất ngủ');
  const id = store.state.achievements[0].id;
  store.editAchievement(id, '   ');
  assert.deepEqual(store.state.achievements, []);
});

/* ===== dữ liệu từ online ===== */
test('applyRemote: giữ updatedAt của bản online và báo nguồn remote (không đẩy ngược)', () => {
  const storage = makeStorage({ tasks: [], records: {} });
  const store = createStore(storage);
  const events = [];
  store.onChange(src => events.push(src));

  const stateRef = store.state; // index.html giữ tham chiếu này suốt vòng đời trang
  store.applyRemote({ tasks: [{ id: 'x', name: 'từ online', repeat: 'daily', createdAt: '2026-07-01' }],
    records: {}, updatedAt: 12345 });

  assert.deepEqual(events, ['remote']);
  assert.equal(store.state.updatedAt, 12345);          // không lấy giờ máy đè lên
  assert.equal(store.state, stateRef);                 // vẫn là object cũ, chỉ thay ruột
  assert.equal(stateRef.tasks[0].name, 'từ online');
  assert.equal(storage.saved().updatedAt, 12345);
});

test('importData: thay toàn bộ và tính là sửa trên máy (source local)', () => {
  const store = createStore(makeStorage());
  const events = [];
  store.onChange(src => events.push(src));
  store.importData({ tasks: [], records: {}, achievements: { '2026-07-01': 'nhập từ file' } });
  assert.deepEqual(events, ['local']);
  assert.equal(store.state.achievements[0].text, 'nhập từ file');
});

/* ===== Kinh tế vé (economy) ===== */
test('normalize: dữ liệu cũ chưa có economy → khởi tạo rỗng, phần tử hỏng bị lọc', () => {
  assert.deepEqual(normalize(null).economy, { spins: [], pool: [] });
  const s = normalize({ economy: {
    spins: [{ date: '2026-07-01', rewardName: 'Trà sữa' }, { rewardName: 'thiếu ngày' }, null],
    pool: [{ name: 'Cà phê', weight: '-2', tier: 'lạ' }, { weight: 5 }, 'rác'],
  } });
  assert.equal(s.economy.spins.length, 1); // spin thiếu date bị loại
  assert.equal(s.economy.spins[0].kind, 'normal');
  assert.ok(s.economy.spins[0].id);
  assert.equal(s.economy.pool.length, 1); // item thiếu tên bị loại
  assert.equal(s.economy.pool[0].weight, 1);      // weight hỏng về 1
  assert.equal(s.economy.pool[0].tier, 'normal'); // tier lạ về normal
});

test('pool: thêm / sửa / xóa món phần thưởng', () => {
  const store = createStore(makeStorage());
  store.addPoolItem({ name: '  Trà sữa Phúc Long  ', weight: 10 });
  store.addPoolItem({ name: 'Buffet ABC', weight: 1, tier: 'jackpot' });
  assert.equal(store.state.economy.pool.length, 2);
  assert.equal(store.state.economy.pool[0].name, 'Trà sữa Phúc Long');

  const id = store.state.economy.pool[0].id;
  store.updatePoolItem(id, { weight: 3, tier: 'jackpot' });
  assert.equal(store.state.economy.pool[0].weight, 3);
  assert.equal(store.state.economy.pool[0].tier, 'jackpot');
  store.updatePoolItem(id, { name: '   ' }); // tên rỗng: giữ tên cũ
  assert.equal(store.state.economy.pool[0].name, 'Trà sữa Phúc Long');

  store.deletePoolItem(id);
  assert.equal(store.state.economy.pool.length, 1);
});

test('recordSpin: ghi log lượt quay kèm tên món chụp tại thời điểm quay', () => {
  const store = createStore(makeStorage());
  store.recordSpin({ date: '2026-07-16', rewardId: 'r1', rewardName: 'Trà sữa', kind: 'jackpot' });
  const sp = store.state.economy.spins[0];
  assert.equal(sp.rewardName, 'Trà sữa');
  assert.equal(sp.kind, 'jackpot');
  assert.ok(sp.id);
});

test('importData/applyRemote: economy đi theo dữ liệu, không bị rơi mất', () => {
  const store = createStore(makeStorage());
  store.importData({ tasks: [], records: {}, economy: {
    spins: [{ id: 's1', date: '2026-07-01', rewardId: null, rewardName: 'Cà phê', kind: 'normal' }],
    pool: [{ id: 'r1', name: 'Cà phê', weight: 10, tier: 'normal' }],
  } });
  assert.equal(store.state.economy.spins.length, 1);
  assert.equal(store.state.economy.pool[0].name, 'Cà phê');
});

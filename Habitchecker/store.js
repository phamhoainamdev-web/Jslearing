/* store.js — "một cửa" của dữ liệu Habit Checker.

   Trước đây ~30 event handler trong index.html tự sửa `state` rồi phải nhớ
   gọi save() + render(); quên một trong hai là sinh bug âm thầm. Giờ mọi
   thao tác sửa dữ liệu đi qua các hàm có tên ở đây — commit() (đóng dấu
   thời gian, lưu, báo listener) nằm bên trong nên muốn quên cũng không được.

   Store nhận `storage` ({ get, set } chuỗi JSON) từ ngoài: trình duyệt đưa
   localStorage vào, test đưa bộ nhớ giả vào — nhờ vậy test được bằng Node.

   Listener: onChange(fn) — fn(source) với source:
   - 'local'  : người dùng sửa trên máy này (cần đẩy lên online)
   - 'remote' : vừa tải bản online về (KHÔNG được đẩy ngược lên) */

import { dateKey } from './habit-model.js';

export function newId(prefix) { return prefix + Date.now() + Math.random().toString(36).slice(2, 6); }

function todayKey() { return dateKey(new Date()); }

/* ===== Chuẩn hóa dữ liệu thô (localStorage, Gist, file sao lưu) ===== */

/* Nhật ký về mảng [{id, date, text}] — chấp nhận cả dạng cũ { 'YYYY-MM-DD': 'text' } */
function toAchievementArray(value) {
  if (Array.isArray(value)) {
    return value
      .filter(a => a && a.text)
      .map(a => ({ id: a.id || newId('a'), date: a.date || todayKey(), text: String(a.text) }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, t]) => t)
      .map(([date, text]) => ({ id: newId('a'), date, text: String(text) }));
  }
  return [];
}

function normalizeJsState(v) {
  const o = (v && typeof v === 'object') ? v : {};
  if (!o.weekPlans || typeof o.weekPlans !== 'object') o.weekPlans = {};
  if (!o.checkpoints || typeof o.checkpoints !== 'object') o.checkpoints = {};
  if (!o.checkins || typeof o.checkins !== 'object') o.checkins = {};
  return o;
}

export function normalize(raw) {
  const s = (raw && typeof raw === 'object') ? raw : {};
  if (!Array.isArray(s.tasks)) s.tasks = [];
  if (!s.records || typeof s.records !== 'object') s.records = {};
  s.achievements = toAchievementArray(s.achievements);
  if (!s.skips || typeof s.skips !== 'object') s.skips = {};
  if (!Array.isArray(s.groups)) s.groups = [];
  s.js = normalizeJsState(s.js);
  return s;
}

/* Chép dữ liệu mới vào object state ĐANG CÓ — giữ nguyên tham chiếu,
   vì index.html giữ tham chiếu `state` đó suốt vòng đời trang */
function copyInto(state, src) {
  state.tasks = src.tasks;
  state.records = src.records;
  state.achievements = src.achievements;
  state.skips = src.skips;
  state.groups = src.groups;
  state.js = src.js;
}

export function createStore(storage) {
  let raw = null;
  try { raw = JSON.parse(storage.get()); } catch (e) { /* dữ liệu hỏng thì bắt đầu mới */ }
  const state = normalize(raw);
  const listeners = [];
  const notify = (source) => { for (const fn of listeners) fn(source); };

  function persist() { storage.set(JSON.stringify(state)); }
  function commit() {
    state.updatedAt = Date.now(); // để so với bản online — bản mới hơn thắng
    persist();
    notify('local');
  }

  const findTask = (id) => state.tasks.find(t => t.id === id);

  /* records là map thưa: xóa tick cuối cùng của một ngày thì xóa luôn ngày đó.
     Trả về true nếu trước đó có tick. */
  function clearTick(key, taskId) {
    const day = state.records[key];
    if (!day || !day[taskId]) return false;
    delete day[taskId];
    if (Object.keys(day).length === 0) delete state.records[key];
    return true;
  }

  return {
    state,
    onChange(fn) { listeners.push(fn); },

    /* ===== Tick & ngày nghỉ ===== */
    toggleTick(key, taskId) {
      if (!clearTick(key, taskId)) (state.records[key] ||= {})[taskId] = true;
      commit();
    },
    setSkip(key, reason) { state.skips[key] = reason; commit(); },
    clearSkip(key) { delete state.skips[key]; commit(); },

    /* ===== Việc ===== */
    addTask({ name, repeat = 'daily', date, groupId } = {}) {
      const task = { id: newId('t'), name, repeat, createdAt: todayKey(), archivedAt: null };
      if (repeat === 'once') task.date = date;
      if (groupId) task.groupId = groupId;
      state.tasks.push(task);
      commit();
    },
    renameTask(id, name) { findTask(id).name = name; commit(); },
    setTaskStart(id, key) { findTask(id).createdAt = key; commit(); },
    /* Đổi ngày của việc một lần — dấu tick (nếu có) đi theo ngày mới */
    moveOnceTask(id, key) {
      const t = findTask(id);
      const wasDone = clearTick(t.date || t.createdAt, id);
      t.date = key;
      if (wasDone) (state.records[key] ||= {})[id] = true;
      commit();
    },
    toggleRequired(id) { const t = findTask(id); t.required = !t.required; commit(); },
    archiveTask(id) { findTask(id).archivedAt = todayKey(); commit(); },
    restoreTask(id) { findTask(id).archivedAt = null; commit(); },
    deleteTask(id) {
      for (const key of Object.keys(state.records)) clearTick(key, id);
      state.tasks = state.tasks.filter(t => t.id !== id);
      commit();
    },
    /* Thứ tự mới của việc hằng ngày (mảng id, từ DOM sau khi kéo thả);
       việc một lần / đã lưu trữ không nằm trong mảng → dồn về cuối */
    reorderDaily(orderedIds) {
      const daily = orderedIds.map(findTask).filter(Boolean);
      const rest = state.tasks.filter(t => !orderedIds.includes(t.id));
      state.tasks = [...daily, ...rest];
      commit();
    },

    /* ===== Nhóm việc ===== */
    addGroup(name) {
      name = name.trim();
      if (!name) return;
      state.groups.push({ id: newId('g'), name });
      commit();
    },
    renameGroup(id, name) {
      const g = state.groups.find(x => x.id === id);
      if (g && name.trim()) { g.name = name.trim(); commit(); }
    },
    /* Xóa nhóm KHÔNG xóa việc — việc trong nhóm về "chưa phân nhóm" */
    deleteGroup(id) {
      state.groups = state.groups.filter(g => g.id !== id);
      for (const t of state.tasks) if (t.groupId === id) t.groupId = null;
      commit();
    },
    setTaskGroup(taskId, groupId) { findTask(taskId).groupId = groupId || null; commit(); },
    /* Thứ tự mới của nhóm (mảng id, từ DOM sau khi kéo thả) —
       thứ tự này quyết định thứ tự các mục ở tab Hôm nay */
    reorderGroups(orderedIds) {
      const ordered = orderedIds.map(id => state.groups.find(g => g.id === id)).filter(Boolean);
      const rest = state.groups.filter(g => !orderedIds.includes(g.id));
      state.groups = [...ordered, ...rest];
      commit();
    },

    /* ===== Nhật ký (state.achievements) ===== */
    addAchievement(date, text) {
      text = text.trim();
      if (!text) return;
      state.achievements.push({ id: newId('a'), date, text });
      commit();
    },
    /* Sửa thành chuỗi rỗng = xóa */
    editAchievement(id, text) {
      const a = state.achievements.find(x => x.id === id);
      if (!a) return;
      text = text.trim();
      if (text) a.text = text;
      else state.achievements = state.achievements.filter(x => x.id !== id);
      commit();
    },
    deleteAchievement(id) {
      state.achievements = state.achievements.filter(a => a.id !== id);
      commit();
    },

    /* ===== Cửa chung cho phần chưa có hàm riêng (tab Học JS) =====
       Tab Học JS sẽ tách thành module riêng sau (candidate 4); trong lúc
       chờ, nó sửa state qua đây để mọi thay đổi vẫn đi qua một cửa. */
    update(mutate) { mutate(state); commit(); },

    /* ===== Thay cả cụm dữ liệu ===== */
    /* Nhập từ file sao lưu — thay toàn bộ, coi như người dùng vừa sửa (sẽ đẩy online) */
    importData(data) {
      copyInto(state, normalize(data));
      commit();
    },
    /* Bản online mới hơn thắng — GIỮ updatedAt của bản online và không đẩy ngược lên,
       nếu không hai máy sẽ ping-pong đè nhau mãi */
    applyRemote(data) {
      copyInto(state, normalize(data));
      state.updatedAt = data.updatedAt || Date.now();
      persist();
      notify('remote');
    },
  };
}

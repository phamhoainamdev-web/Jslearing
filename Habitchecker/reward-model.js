/* reward-model — kinh tế vé & tầng danh dự của Habit Checker.

   Cùng nguyên tắc với habit-model: toàn bộ là hàm thuần, `state` và ngày
   "hôm nay" truyền vào tường minh; hàm quay nhận cả `rng` từ ngoài —
   nhờ vậy test được bằng Node, không cần trình duyệt hay Math.random thật.

   Triết lý (xem CONTEXT.md mục "Kinh tế vé"):
   - Thưởng cho hành vi, không thưởng cho con số tự lớn. Mọi tài nguyên
     KIẾM ĐƯỢC suy ra từ records/skips thật — sửa tick hồi tố là số dư
     tự tính lại. KHÔNG có cửa cộng vé/mảnh thủ công.
   - Chỉ việc TIÊU (lượt quay) là sự kiện phải lưu log: state.economy.spins.
   - Số dư KHÔNG phải "tổng kiếm − tổng tiêu": vì có TRẦN, phải replay
     dòng thời gian từng ngày — trần áp tại thời điểm sinh (kho đầy thì
     nguồn sinh mất luôn, tiêu bớt rồi mới tích lại được), lượt quay trừ
     vào đúng ngày quay (đáy 0, không âm, không xóa log).

   Luật kiếm:
   - Ngày hoàn hảo (mức 4 heatmap: complete && dailyDone >= total) → 1 mảnh.
   - Tuần (bắt đầu Thứ 2, chỉ xét ngày trong tuần, không vắt qua CN→T2):
     3 ngày hoàn thành liên tiếp → 1 mảnh; 6 ngày → 1 vé; mỗi mốc 1 lần/tuần.
     Ngày nghỉ trung lập với đếm liên tiếp: không đứt, không cộng.
   - 3 mảnh = 1 vé (tự động). Trần: 2 vé, 2 mảnh.
   - Mốc chuỗi 100/365 ngày → 1 lượt quay jackpot, 1 lần vĩnh viễn mỗi mốc.

   Tầng danh dự (không sinh vé): huy hiệu mốc chuỗi tính từ chuỗi dài nhất
   trong LỊCH SỬ (đứt rồi vẫn giữ); huy hiệu "Trở lại" đếm số lần hoàn thành
   ngay sau ngày trượt thật (ngày nghỉ không phải trượt). */

import { dateKey, keyToDate, dayStats } from './habit-model.js';

/* ===== Hằng số luật chơi ===== */
export const PIECES_PER_TICKET = 3; // 3 mảnh đổi 1 vé
export const MAX_TICKETS = 2;       // trần kho vé
export const MAX_PIECES = 2;        // trần kho mảnh (mảnh thứ 3 tự đổi thành vé)
export const WEEK_PIECE_RUN = 3;    // 3 ngày liên tiếp trong tuần → mảnh
export const WEEK_TICKET_RUN = 6;   // 6 ngày liên tiếp trong tuần → vé
export const JACKPOT_MILESTONES = [100, 365]; // mốc chuỗi tặng lượt jackpot
export const BADGE_MILESTONES = [7, 14, 30, 60, 100, 180, 365];

/* ===== Toán tuần ===== */
/* Key ngày Thứ 2 của tuần chứa `key` (tuần bắt đầu Thứ 2) */
export function mondayOf(key) {
  const d = keyToDate(key);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7); // CN=0 → lùi 6, T2=1 → lùi 0
  return dateKey(d);
}

/* Ngày sớm nhất có dữ liệu để quét: ngày bắt đầu sớm nhất của các việc */
export function firstTrackedKey(state) {
  let min = null;
  for (const t of state.tasks) {
    const k = t.repeat === 'once' ? (t.date || t.createdAt) : t.createdAt;
    if (k && (!min || k < min)) min = k;
  }
  return min;
}

/* ===== Tầng danh dự =====
   Một lượt quét từ ngày đầu tiên đến hôm nay, luật đứt/nối giống
   currentStreak (ngày nghỉ trung lập). Trả:
   - longestStreak: chuỗi dài nhất TỪNG đạt — huy hiệu suy từ đây nên
     "đạt rồi giữ vĩnh viễn" dù chuỗi đã đứt.
   - comebackCount: số lần "Trở lại" — ngày hoàn thành đứng ngay sau ngày
     trượt thật (bỏ qua ngày nghỉ ở giữa), và trước đó phải từng có ít nhất
     một ngày hoàn thành (lần đầu tiên trong đời không phải là "trở lại"). */
export function lifetimeStats(state, todayKey) {
  const start = firstTrackedKey(state);
  let longest = 0, comebacks = 0;
  if (!start) return { longestStreak: 0, comebackCount: 0 };

  let run = 0;
  let everComplete = false; // đã từng có ngày hoàn thành nào chưa
  let prevMissed = false;   // ngày thật gần nhất là ngày trượt?
  const d = keyToDate(start);
  while (dateKey(d) <= todayKey) {
    const s = dayStats(state, dateKey(d));
    if (!s.skipped) {                 // ngày nghỉ: xuyên qua, không đổi gì
      if (s.complete) {
        if (prevMissed && everComplete) comebacks++;
        run++;
        if (run > longest) longest = run;
        everComplete = true;
        prevMissed = false;
      } else {
        run = 0;
        prevMissed = true;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return { longestStreak: longest, comebackCount: comebacks };
}

/* Các huy hiệu đã đạt, suy từ chuỗi dài nhất lịch sử */
export function earnedBadges(longestStreak) {
  return BADGE_MILESTONES.filter(m => longestStreak >= m);
}

/* Mốc kế tiếp của chuỗi HIỆN TẠI — cho dòng "còn N ngày → 🔥X".
   Qua hết mọi mốc thì trả null. */
export function nextMilestone(currentStreak) {
  const target = BADGE_MILESTONES.find(m => m > currentStreak);
  return target ? { target, remaining: target - currentStreak } : null;
}

/* ===== Kinh tế vé =====
   Replay từng ngày từ ngày đầu tiên đến hôm nay. Trong MỘT ngày, thứ tự:
   kiếm (mảnh hoàn hảo + mốc tuần) → quy đổi 3 mảnh thành vé → áp trần
   → trừ các lượt quay của ngày đó. Trả số dư tại `todayKey` kèm tiến độ
   tuần hiện tại cho UI. */
export function economySummary(state, todayKey) {
  let pieces = 0, tickets = 0, jackpotSpins = 0;

  /* Cộng mảnh rồi quy đổi + áp trần ngay — trần áp tại thời điểm sinh */
  function earnPieces(n) {
    pieces += n;
    while (pieces >= PIECES_PER_TICKET && tickets < MAX_TICKETS) {
      pieces -= PIECES_PER_TICKET;
      tickets++;
    }
    if (pieces > MAX_PIECES) pieces = MAX_PIECES; // kho vé đầy: mảnh dư mất luôn
  }

  /* Gom lượt quay theo ngày để trừ đúng chỗ trong replay */
  const spinsByDate = {};
  const spins = (state.economy && state.economy.spins) || [];
  for (const sp of spins) (spinsByDate[sp.date] ||= []).push(sp);

  let weekRun = 0;                 // số ngày hoàn thành liên tiếp trong tuần
  let weekPieceEarned = false;     // tuần này đã nhận mảnh mốc 3 chưa
  let weekTicketEarned = false;    // tuần này đã nhận vé mốc 6 chưa
  let run = 0;                     // chuỗi lịch sử — cho mốc jackpot
  const jackpotAwarded = new Set();

  const start = firstTrackedKey(state);
  if (start) {
    const d = keyToDate(start);
    while (dateKey(d) <= todayKey) {
      const key = dateKey(d);
      if (d.getDay() === 1) {      // sang Thứ 2: tuần mới, đếm lại từ đầu
        weekRun = 0;
        weekPieceEarned = false;
        weekTicketEarned = false;
      }
      const s = dayStats(state, key);
      if (!s.skipped) {            // ngày nghỉ trung lập: không đứt, không cộng
        if (s.complete) {
          run++;
          weekRun++;
          // Mốc chuỗi dài → lượt jackpot, mỗi mốc chỉ 1 lần trong đời
          for (const m of JACKPOT_MILESTONES) {
            if (run >= m && !jackpotAwarded.has(m)) { jackpotAwarded.add(m); jackpotSpins++; }
          }
          // Ngày hoàn hảo: trọn vẹn mọi việc hằng ngày (mức 4 heatmap)
          if (s.dailyDone >= s.total) earnPieces(1);
          if (weekRun >= WEEK_PIECE_RUN && !weekPieceEarned) { weekPieceEarned = true; earnPieces(1); }
          if (weekRun >= WEEK_TICKET_RUN && !weekTicketEarned) {
            weekTicketEarned = true;
            tickets = Math.min(MAX_TICKETS, tickets + 1);
          }
        } else if (key !== todayKey) {
          run = 0;
          weekRun = 0;
        }
        /* key === todayKey && chưa hoàn thành: hôm nay còn dang dở, chưa coi
           là đứt (giống currentStreak) — để UI vẫn hiện "Tuần: N ngày". */
      }
      // Tiêu: các lượt quay của ngày này — đáy 0, không âm, giữ nguyên log
      for (const sp of spinsByDate[key] || []) {
        if (sp.kind === 'jackpot') jackpotSpins = Math.max(0, jackpotSpins - 1);
        else tickets = Math.max(0, tickets - 1);
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return { pieces, tickets, jackpotSpins, weekRun, weekPieceEarned, weekTicketEarned };
}

/* ===== Gacha =====
   Chọn món theo trọng số — lượt nào cũng trúng, không có ô trượt.
   kind 'jackpot' chỉ quay các món tier 'jackpot'; kind thường quay CẢ pool
   (món jackpot vẫn nằm trong đó với weight nhỏ = món hiếm).
   `rng` là hàm trả số [0,1) truyền từ ngoài để test được.
   Không có món hợp lệ nào → null (UI giữ nguyên lượt, nhắc nạp món). */
export function spinPick(pool, kind, rng = Math.random) {
  const items = (pool || []).filter(i =>
    (kind === 'jackpot' ? i.tier === 'jackpot' : true) && Number(i.weight) > 0);
  const total = items.reduce((sum, i) => sum + Number(i.weight), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const i of items) {
    r -= Number(i.weight);
    if (r < 0) return i;
  }
  return items[items.length - 1]; // phòng sai số dấu phẩy động
}

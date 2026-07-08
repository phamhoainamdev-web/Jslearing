# CONTEXT.md — Từ điển domain

## Habitchecker

- **Việc (Task)** — một mục người dùng theo dõi. Hai loại: `repeat: 'daily'` (việc hằng ngày, có hiệu lực từ `createdAt`, kết thúc khi `archivedAt`) và `repeat: 'once'` (việc một lần, chỉ có hiệu lực đúng ngày `date`).
- **Ngày có hiệu lực (Active day)** — ngày mà một việc được tính: daily: `createdAt ≤ ngày` và (`archivedAt` trống hoặc `ngày < archivedAt`); once: `ngày === date`.
- **Tick (Record)** — đánh dấu đã làm một việc vào một ngày; lưu trong `records[ngày][taskId]`.
- **Ngưỡng (minDone)** — số việc tối thiểu để một ngày tính là hoàn thành; `0` nghĩa là phải đủ tất cả việc hằng ngày của ngày đó.
- **Ngày hoàn thành (Day complete)** — *(quyết định 08/07/2026, grilling candidate habit-model)*: mẫu số (`total`) và ngưỡng chỉ tính trên **việc hằng ngày**; việc một lần đã tick **"chỉ cộng, không trừ"** — cộng vào số việc đã làm (`done`) nhưng không làm tăng ngưỡng. Định nghĩa này dùng thống nhất ở mọi nơi: chuỗi, heatmap Năm, hàng Tổng của Bảng. Ngày không có việc hằng ngày có hiệu lực (trong thực tế chỉ là những ngày trước khi bắt đầu theo dõi) → không tính hoàn thành, chuỗi dừng đếm tại đó. Số `done` hiển thị (hàng Tổng, tooltip heatmap) là số gộp — có thể vượt `total`, ví dụ `5/3`.
- **Chuỗi (Streak)** — số ngày hoàn thành liên tiếp, đếm lùi từ hôm nay; hôm nay chưa đạt thì đếm lùi từ hôm qua.
- **Thành tựu (Achievement)** — ghi chú tự do theo ngày, độc lập với Việc/Tick.
- **habit-model** — module domain thói quen đang được tách ra (`Habitchecker/habit-model.js`, ES module, hàm thuần nhận `state` tường minh).

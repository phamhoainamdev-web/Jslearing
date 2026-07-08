# Jslearing

Repo học JavaScript (chủ repo là người mới học — trao đổi bằng **tiếng Việt**, comment code tiếng Việt, giải thích khái niệm mới bằng ví dụ cụ thể).

## Habitchecker/ — app chính

PWA một trang, deploy GitHub Pages: https://phamhoainamdev-web.github.io/Jslearing/Habitchecker/ (luôn chạy qua HTTP, không có use case `file://`).

- **`habit-model.js`** — module domain thói quen: ES module, **hàm thuần** (`state` và ngày "hôm nay" truyền vào tường minh, không đọc global/đồng hồ). Mọi logic "ngày hoàn thành", chuỗi, thống kê tháng nằm ở đây — **đừng** viết lại logic domain trong `index.html`.
- **`index.html`** — render + mutation (event handler). Script chính là `<script type="module">`.
- **`sw.js`** — service worker network-first; thêm asset mới thì **phải thêm vào mảng `ASSETS`**.
- Từ điển domain + các quyết định thiết kế đã chốt: **`CONTEXT.md`** — đọc trước khi sửa logic domain, đừng chốt lại điều đã quyết ở đó.

## Test

`npm test` — `node --test`, không dependency. Sửa/thêm logic trong `habit-model.js` thì cập nhật `Habitchecker/habit-model.test.js` và chạy test trước khi đấu dây vào UI.

## Khác

- `Todo/` — bài tập học, không phải app chính, không cần refactor.
- Dữ liệu người dùng nằm trong `localStorage` (+ đồng bộ GitHub Gist) — cẩn trọng với thay đổi làm lệch định dạng `state`.

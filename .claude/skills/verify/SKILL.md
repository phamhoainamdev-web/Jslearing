---
name: verify
description: Cách chạy và kiểm chứng Habitchecker thật (Chromium headless) sau khi sửa habit-model.js / index.html
---

# Kiểm chứng Habitchecker

App là PWA tĩnh — surface là trình duyệt, không có bước build.

## Dựng môi trường (~1 phút nếu Chromium đã cache)

```bash
# 1. Serve app (chạy nền)
python3 -m http.server 8777 --directory /workspaces/Jslearing/Habitchecker

# 2. Playwright-core + Chromium (cài vào thư mục scratchpad, KHÔNG vào repo)
cd <scratchpad> && npm init -y && npm i playwright-core
npx playwright-core install chromium   # bỏ qua nếu ~/.cache/ms-playwright đã có
```

## Lái app

Script mẫu: mở `http://localhost:8777/index.html`, `localStorage.clear()` + reload để bắt đầu sạch, rồi thao tác qua các selector chính:

- Tab: `#tab-today`, `#tab-history`, `#tab-manage`, `#tab-js`
- Thêm việc: `#newTaskInput` + `#addTaskBtn` (select `#newTaskRepeat` cho việc một lần)
- Ngưỡng: `#minDoneInput` (fill xong phải `dispatchEvent 'change'`)
- Hôm nay: `#todayList li .checkbox`, nhãn `#streakLabel`, `#progressLabel`
- Lịch sử: subtab `.subtabs button[data-mode="matrix|year|stats|journal"]`; bảng `table.matrix`, heatmap `.yr-cell` (tooltip nằm trong `title`)
- Quản lý: hàng việc `#activeList li`, nút `⭐/☆ Bắt buộc`, `Sửa tên`, `Lưu trữ`, `Xóa`; nhóm: `#newGroupInput` + `#addGroupBtn`, danh sách `#groupList li`, ô chọn nhóm mỗi việc `select.group-select`

Bắt lỗi: `page.on('pageerror')` + `console` type error; `page.on('dialog', d => d.accept())` vì app dùng `confirm/prompt`.

## Gotcha

- **Click bị nuốt sau khi sửa ô ngưỡng**: `#minDoneInput` đang focus mà click nút khác thì blur → `change` → `render()` xây lại DOM giữa mousedown/mouseup, cú click rơi vào khoảng không. Blur trước (click chỗ trung tính + đợi ~100ms) rồi mới bấm nút.
- Cổng 8777 có thể còn server của phiên trước — `curl` kiểm tra trước khi than "Address already in use".
- `/tmp` gốc bị dọn giữa phiên; để node_modules và script trong scratchpad.

# Roadmap chi tiết — Giai đoạn 1: JavaScript & Nền tảng lập trình

Phiên bản: 1.1 — 06/07/2026 (khớp Master Roadmap v1.1: bài tốt nghiệp là project **100% cá nhân**; project nhóm IELTS Reading = thread phụ về teamwork)
Thời lượng mục tiêu: **8 tuần** (khoảng cho phép 6–10 tuần) · ~3h code/ngày (sau khi trừ 30–45 phút tiếng Anh)

**Mục tiêu ra khỏi giai đoạn:** từ "biết cú pháp" → "một mình build và deploy được ứng dụng web tương tác hoàn chỉnh bằng vanilla JS, không nhìn tutorial."

---

## Hai thread của giai đoạn

**Thread chính (~toàn bộ 3h code/ngày): project cá nhân.**
Flagship: **Vocab Trainer** — app luyện từ vựng tiếng Anh cá nhân: thêm từ → gọi dictionary API lấy nghĩa/phát âm/ví dụ → ôn kiểu flashcard → lưu tiến độ bằng localStorage. Lý do chọn: cùng domain học tiếng Anh (bạn là người dùng thật → product thinking có sẵn), không giẫm chân sản phẩm nhóm, phủ đủ DOM + async/API + localStorage, gộp luôn yêu cầu "project có gọi API bên ngoài" vào một sản phẩm. *Có thể đổi đề trước tuần 1 nếu có vấn đề cá nhân khác muốn giải quyết hơn — tiêu chí: mình dùng thật hằng tuần, scope ≤ 5 tuần, có API call + DOM + localStorage.*

**Thread phụ (KHÔNG tính vào 4h, trừ khi task trùng đúng thứ đang học): project nhóm IELTS Reading.**
- Vai trò: sân tập Git nhiều người + bằng chứng teamwork. Đã có 2 đóng góp cụ thể: feature xử lý 1 loại câu hỏi; tính năng scan/convert PDF-doc → text.
- Việc cần làm ngay (tuần 1, ~30 phút): gom link commit/PR của 2 đóng góp trên vào ghi chú portfolio; từ giờ mọi đóng góp mới đi qua branch → pull request để có bằng chứng rõ.
- Chuẩn bị dần câu trả lời "cụ thể bạn làm phần nào, giải thích code đó" — đặc biệt phần PDF→text: nếu có dùng thư viện/AI hỗ trợ, phải hiểu lại đủ để giải thích từng bước.

## Nguyên tắc thực thi (đọc lại mỗi tuần)

1. **Không học lại thứ đã biết.** Variables, functions, arrays, objects: bỏ qua, chỉ ôn khi vấp trong lúc build.
2. **Mỗi tuần ít nhất 1 thứ tự build được.**
3. **Quy tắc AI: tự viết trước, hỏi AI sau.** AI giải thích lỗi/khái niệm, review code đã viết — KHÔNG viết code hộ. Lý do: live-coding interview ở Giai đoạn 5.
4. **Deploy sớm.** Vocab Trainer bản 1 lên mạng từ cuối tuần 2, cập nhật dần.
5. **Mỗi ngày code là mỗi ngày commit.** Message tiếng Anh.

## Tài nguyên chuẩn (không thêm nguồn giữa chừng)

- **MDN Web Docs** — tra cứu chính; đọc tiếng Anh = luyện Reading docs (track tiếng Anh).
- **javascript.info** — phần II (Browser) và chương Promises/async.

---

## Module 1 — DOM & Events (Tuần 1–2)

**Mục tiêu:** thao tác DOM và xử lý sự kiện đủ để tự build mọi tương tác của Vocab Trainer không cần thư viện.

Nội dung: `querySelector/querySelectorAll`; `textContent` vs `innerHTML` (và khi nào không nên dùng innerHTML); `classList`, dataset; `createElement/append/remove`; `addEventListener`, event object, `preventDefault`; **event delegation** (dùng cho danh sách từ); form: đọc input, validate cơ bản, event `submit`. Array methods trong ngữ cảnh render: `map`, `filter`, `find`, `forEach` (mức dùng được).

**Build:**
- Tuần 1: lõi Vocab Trainer bản tĩnh — form thêm từ (chưa gọi API, nghĩa nhập tay) → render danh sách từ từ mảng object → xóa/sửa từ → chế độ flashcard lật mặt.
- Tuần 2: hoàn thiện tương tác (delegation cho danh sách, validate form, đánh dấu thuộc/chưa thuộc) → **deploy bản 1 lên GitHub Pages/Netlify cuối tuần 2.**

**Definition of done:** tự viết được render-từ-mảng + event delegation + form không xem lại mẫu.

## Module 2 — Async, Fetch & API (Tuần 3–4)

**Mục tiêu:** dùng được bất đồng bộ — điểm yếu hiện tại (baseline ~2/10) và là kiến thức quyết định tốc độ Giai đoạn 2–4.

Nội dung: event loop mức khái niệm (giải thích được bằng lời); Promise → chuyển hẳn sang **`async/await` + `try/catch`**; `fetch` GET, đọc JSON, `response.ok`, phân biệt lỗi mạng vs lỗi HTTP; **loading/error/empty state trên UI** (thói quen dùng lại nguyên xi ở React); `Promise.all` cơ bản.

**Build:**
- Tuần 3: 2–3 bài tập nhỏ với API công khai (dictionaryapi.dev, open-meteo) — gọi API, hiện loading, kết quả, lỗi khi tắt mạng. Chưa đụng vào app chính để lỗi dễ cô lập.
- Tuần 4: **tích hợp dictionary API vào Vocab Trainer** — thêm từ → tự động lấy nghĩa/phiên âm/audio/ví dụ; xử lý từ không tồn tại, mất mạng. Deploy bản 2.

**Definition of done:** viết được hàm async gọi API kèm xử lý lỗi không copy mẫu; giải thích được vì sao code sau `await` chạy sau.

## Module 3 — Debug với DevTools (xuyên suốt, trọng tâm tuần 3)

Áp vào lỗi thật khi làm Module 2: `console.log` có chủ đích, `console.table`; breakpoint trong Sources, step over/into; **Network tab** (request/response, status code — bắt buộc thành thạo trước Giai đoạn 3). Quy trình chuẩn khi gặp lỗi: đọc error + stack trace → đoán nguyên nhân → kiểm chứng bằng DevTools → kẹt quá 30–45 phút mới hỏi AI.

## Module 4 — Git/GitHub đúng quy trình (xuyên suốt)

- Tuần 1: nhịp `add → commit → push` hằng ngày; `.gitignore`; README có cấu trúc. **+ Gom link commit/PR 2 đóng góp ở project nhóm.**
- Tuần 3: branch → merge cho tính năng mới trên project cá nhân; ở project nhóm, mọi đóng góp mới đi qua PR.
- Mục tiêu: contribution graph xanh ≥ 5 ngày/tuần suốt giai đoạn.

## Module 5 — Hoàn thiện Vocab Trainer (Tuần 5–6)

Checkpoint "bài tốt nghiệp" của giai đoạn. Yêu cầu bản hoàn thiện:
- Lưu toàn bộ dữ liệu bằng `localStorage` (từ vựng, trạng thái thuộc/chưa thuộc, lịch sử ôn).
- Chế độ ôn tập thông minh đơn giản: ưu tiên hiện từ chưa thuộc/sai nhiều (chưa cần thuật toán spaced repetition chuẩn — phiên bản tự nghĩ là đủ và là điểm kể chuyện hay khi phỏng vấn).
- Thống kê cơ bản: số từ đã học, tỷ lệ nhớ.
- Responsive cơ bản (dùng được trên điện thoại — vì sẽ ôn từ trên điện thoại thật).
- README trả lời: **Ai dùng? Giải quyết vấn đề gì? Tại sao làm?** (tập product thinking sớm hơn yêu cầu — chi phí gần 0).

Tuần 6: refactor + sửa lỗi + README. **Được cắt tính năng để kịp deadline; không được kéo deadline để thêm tính năng.**

## Module 6 — Capstone: build không tutorial (Tuần 7–8)

**Mini-project kiểm chứng:** một app vanilla JS khác, **tự chọn đề, tự build từ số 0, không nhìn tutorial** (được tra MDN, được hỏi AI về lỗi). Đây là bài kiểm tra "dấu hiệu sẵn sàng chuyển giai đoạn" — Vocab Trainer build có lộ trình dẫn dắt, còn bài này chứng minh tự đi một mình.

Tiêu chí đề: việc thật bạn làm hằng tuần; scope ≤ 2 tuần; ≥ 1 API call + tương tác DOM + localStorage.

Cuối tuần 8: **tự chấm confidence** 4 mục (DOM & events, async/fetch, array methods, DevTools). Tất cả ≥ 6/10 → sang Giai đoạn 2. Mục nào < 6 → dùng buffer tuần 9–10 build thêm đúng mục đó, không quay lại đọc lý thuyết.

---

## Lịch tuần tổng hợp

| Tuần | Trọng tâm | Sản phẩm cuối tuần |
|---|---|---|
| 1 | DOM, events, render từ mảng | Vocab Trainer bản tĩnh chạy được + gom bằng chứng project nhóm |
| 2 | Delegation, form, flashcard | Vocab Trainer bản 1 **đã deploy** |
| 3 | Promise, async/await, fetch, DevTools | 2–3 bài tập API có loading/error |
| 4 | Tích hợp dictionary API | Vocab Trainer bản 2 (có API) **đã deploy** |
| 5 | localStorage, chế độ ôn tập, thống kê | Bản gần đủ tính năng |
| 6 | Refactor, responsive, README | **Vocab Trainer hoàn thiện** ✅ — bài tốt nghiệp |
| 7 | Capstone không tutorial | Bản chạy được của capstone |
| 8 | Hoàn thiện capstone, tự chấm confidence | Capstone deploy ✅ · Quyết định chuyển giai đoạn |
| 9–10 | (Buffer) chỉ dùng nếu có mục < 6/10 | Bài build củng cố đúng điểm yếu |

## Tín hiệu cảnh báo (tự kiểm mỗi check-in)

- 2 tuần liên tiếp không deploy được gì mới → scope quá to, cắt bớt.
- Xem tutorial > 30% thời gian code → tutorial hell, quay về build.
- AI viết đoạn code mà mình không giải thích lại được → dừng, tự viết lại.
- Task project nhóm bắt đầu ăn vào 3h code cá nhân → nhắc lại nguyên tắc: nhóm là thread phụ, không tính vào 4h trừ khi trùng đúng thứ đang học.
- Quá tuần 10 chưa xong → đưa vào weekly check-in cùng chẩn đoán (thời gian? scope? kiến thức nền?), không tự kéo dài trong im lặng.

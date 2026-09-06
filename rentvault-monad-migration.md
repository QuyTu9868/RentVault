# RentVault - Port sang Monad + thay Latch bằng policy nội bộ

Mục tiêu: dự thi **Monad Metropolis**, track 04 (Trust, Identity & AI Infrastructure).
Deadline nộp: **13/10/2026**.

Hai việc độc lập nhau, làm tuần tự, đừng trộn vào một branch.

---

## Nguyên tắc bắt buộc

1. **Mỗi việc một branch riêng.** `feat/monad-port` và `feat/inhouse-policy`. Giám khảo có
   đọc lịch sử commit, và Metropolis yêu cầu phần nộp phải được làm trong window
   (1/9 – 13/10). Commit rời rạc, message rõ, ngày nằm trong window.
2. **Không đụng Solidity trừ khi bắt buộc.** Monad chạy nguyên bytecode EVM.
   Nếu thấy mình đang sửa `RentalEscrow.sol` để "cho hợp Monad" thì dừng lại - gần như
   chắc chắn là sai hướng.
3. **Ghi vào `ERROR.md` mỗi lỗi gặp phải**, đúng thói quen sẵn có của repo.
4. **Không xóa code cũ trước khi bản mới chạy được.** Comment out, chạy xong mới xóa.

---

# PHẦN A - Port sang Monad Testnet

## A0. Thông số cần biết

| Thứ | Giá trị |
|---|---|
| Chain ID (testnet) | `10143` |
| Chain ID (mainnet) | `143` |
| Native token | `MON` |
| Gas | Xin từ faucet Monad, miễn phí |

Privy hỗ trợ Monad Testnet ở mức đầy đủ (có cả gas sponsorship), nên không có rào cản
kỹ thuật nào ở lớp ví.

## A1. Thêm network vào Hardhat

Trong `contracts/hardhat.config.*`, thêm network `monadTestnet`:
- `chainId: 10143`
- `url`: RPC lấy từ docs chính thức của Monad (tra lúc làm, đừng chép từ blog cũ)
- `accounts`: đọc từ biến môi trường, **không bao giờ hardcode private key**

Dùng ví riêng cho testnet, không dùng ví có tiền thật.

## A2. Deploy lại hai contract

Thứ tự bắt buộc: `MockUSDC` trước, `RentalEscrow` sau - vì địa chỉ token là constructor
argument và immutable.

1. Deploy `MockUSDC`, ghi lại địa chỉ
2. Deploy `RentalEscrow` với địa chỉ vừa có
3. Verify cả hai lên explorer của Monad
4. Chép hai địa chỉ vào bảng trong `README.md`, **tạo bảng mới cho Monad, giữ lại bảng
   Sepolia** - nó là bằng chứng dự án đã chạy thật trước đó

### Điểm phải kiểm tra, không được bỏ qua

`RentalEscrow` dùng **USDC permit** (một chữ ký thay cho hai giao dịch approve + transfer).
Permit ký theo chuẩn EIP-712, và trong đó có trường `chainId`. Đổi chain là đổi domain
separator. Nếu `MockUSDC` hoặc frontend hardcode chainId ở đâu đó, permit sẽ ký đúng nhưng
contract từ chối, và lỗi hiện ra rất khó hiểu.

Việc cần làm: grep toàn repo tìm `11155111` và `chainId`, đảm bảo mọi chỗ đọc động chứ
không phải số cứng.

## A3. Sửa frontend

Trong `frontend/`:

- `.env.local`: `NEXT_PUBLIC_CHAIN_ID=10143`, cập nhật địa chỉ hai contract
- Cấu hình `PrivyProvider`: `defaultChain` và `supportedChains` trỏ Monad Testnet
- Định nghĩa chain cho wagmi/viem (viem có thể đã có sẵn `monadTestnet`, kiểm tra trước
  khi tự định nghĩa tay)
- Mọi link block explorer trong UI đang trỏ `sepolia.etherscan.io` → đổi sang explorer Monad
- Script `npm run dev:all` đang phân nhánh theo `NEXT_PUBLIC_CHAIN_ID` (Sepolia vs 31337) -
  thêm nhánh cho 10143

## A4. Test lại toàn luồng bằng tay

Chạy hết một vòng trên Monad testnet, không được bỏ bước:

- [ ] Đăng nhập bằng email (embedded wallet của Privy) - đây là chỗ dễ vỡ nhất khi đổi chain
- [ ] Đăng nhập bằng browser wallet
- [ ] Mint MockUSDC
- [ ] Tạo listing, agent kiểm duyệt chạy
- [ ] Request rental - **kiểm tra kỹ bước permit**
- [ ] Approve, check in, check out, tiền về đúng
- [ ] Mở dispute, agent phán quyết, deposit chia đúng

## A5. Sửa hai thứ vặt nhưng mất điểm oan

- README ghi live demo là `trustfall-latch.vercel.app`, phần About lại là
  `trustfall-ten.vercel.app`. Thống nhất một cái. Giám khảo bấm link chết là mất điểm.
- Tên `trustfall-latch` sẽ vô nghĩa sau khi gỡ Latch - cân nhắc đổi tên deployment.

---

# PHẦN B - Thay Latch bằng policy nội bộ

## B1. Hiểu đúng thứ đang gỡ

Latch hiện chặn **sáu filter**: năm cái kiểm tra hình dạng request, một cái kiểm tra agent
có thẩm quyền yêu cầu việc đó không. Trong đó có luật quan trọng nhất của cả dự án:

> Ngưỡng chung 0.6, nhưng riêng `pay_owner` phải đạt 0.9, vì đó là phán quyết mà sai một
> lần là một bên mất trắng. Không cấm hẳn - dưới 0.9 admin vẫn quyết tay được.

**Luật này phải sống sót.** Nếu sau khi gỡ Latch mà ngưỡng 0.9 biến mất, bạn vừa xóa điểm
mạnh nhất của bài dự thi.

## B2. Tạo module policy trong repo

Vị trí: `frontend/lib/policy/` (theo đúng luật kiến trúc của repo - integration code nằm
trong `frontend/`, `services/` chỉ chứa thứ dán vào dashboard người khác).

Module này là **cổng bắt buộc**: mọi lệnh của agent phải đi qua nó trước khi server ký.
Nguyên tắc giữ nguyên như Latch - agent đề xuất, policy duyệt, server mới ký.

Cấu trúc gợi ý:

```
frontend/lib/policy/
  rules.ts        # sáu filter, mỗi filter một hàm thuần
  evaluate.ts     # chạy tất cả filter, trả allow/deny + lý do
  types.ts        # kiểu dữ liệu của proposal và kết quả
```

### Yêu cầu với `evaluate.ts`

- Trả về **lý do từ chối cụ thể**, không phải boolean. `/admin` đang hiện đường đi của mỗi
  proposal, nên phải giữ được thông tin đó.
- **Fail closed**: filter ném lỗi thì kết quả là từ chối, không phải cho qua.
- Hàm thuần, không gọi mạng, không đọc database bên trong filter. Dữ liệu cần thì truyền vào.
  Như vậy mới test được.

## B3. Sáu filter - đọc từ `services/latch/` mà chuyển sang

Đừng viết lại từ trí nhớ. Mở file policy trong `services/latch/`, dịch từng filter một sang
TypeScript, giữ nguyên ý nghĩa. Mỗi filter chuyển xong viết test ngay, đừng chuyển hết rồi
mới test.

Filter thẩm quyền (cái thứ sáu) là cái khó nhất, làm sau cùng.

## B4. Viết test cho policy

Đây là phần biến việc "gỡ dependency" thành điểm cộng. Tối thiểu:

- [ ] `pay_owner` với confidence 0.85 → **bị từ chối**
- [ ] `pay_owner` với confidence 0.91 → cho qua
- [ ] `refund_renter` với confidence 0.65 → cho qua (ngưỡng chung 0.6)
- [ ] Mọi verdict với confidence 0.5 → bị từ chối
- [ ] Verdict không nằm trong ba giá trị hợp lệ → bị từ chối
- [ ] Proposal thiếu trường bắt buộc → bị từ chối
- [ ] Finding trích nguồn không tồn tại → bị từ chối
- [ ] Filter ném exception → kết quả là từ chối (fail closed)

Cho test này chạy trong CI. Một policy có test là bằng chứng mạnh hơn nhiều so với một
policy chỉ được mô tả trong README.

## B5. Cắt Latch ra

Chỉ làm sau khi B4 xanh hết:

1. Tìm mọi chỗ gọi Latch trong `frontend/app/api/` - thay bằng gọi `evaluate()`
2. Gỡ biến môi trường của Latch khỏi `.env.local` và tài liệu
3. Gỡ package Latch khỏi `package.json`
4. **Không xóa `services/latch/`** - đổi thành `services/latch-legacy/` kèm một dòng README
   giải thích đây là bản policy cũ chạy trên vendor, giữ lại để đối chiếu. Đây là bằng chứng
   bạn không xóa luật mà chuyển luật.
5. Cập nhật `/admin`: đường đi của proposal giờ là `agent → policy → server`, không còn Latch
6. Cập nhật README: bảng tech stack bỏ dòng "Agent gateway: Latch", phần Status viết lại

## B6. Chạy lại e2e agent

```
npm run e2e:moderation     # 37 listings
npm run e2e:arbitration    # 36 checks
```

Kết quả phải khớp với trước khi gỡ Latch. Lệch chỗ nào là filter chuyển sai chỗ đó.

---

# PHẦN C - Feature mới cho track 04

Hai phần trên là **port và refactor**, chưa phải thứ được chấm. Metropolis chấm phần bạn
làm mới trong window.

Đề xuất, hợp track "agent trust" nhất:

**Đưa sổ phán quyết của agent lên chain.**

Hiện log nằm ở Supabase, và README bạn đã tự thừa nhận admin xóa được - tức người dùng
phải tin backend. Việc cần làm: mỗi phán quyết ghi một record on-chain gồm rental id,
verdict, confidence, và hash của bộ bằng chứng. Nội dung vẫn ở Supabase cho rẻ, nhưng
hash thì bất biến, ai cũng đối chiếu được.

Vì sao nó khớp track 04: biến "tôi hứa agent công tâm" thành "bạn tự kiểm được", và tận
dụng đúng thứ Monad rẻ - ghi thường xuyên, gas thấp.

Chi tiết thiết kế bàn sau, sau khi Phần A và B xong.

---

# Thứ tự làm

```
Tuần 1   Phần A (port Monad) - xong là dApp chạy trên Monad
Tuần 2   Phần B (policy nội bộ) - xong là hết phụ thuộc vendor
Tuần 3-4 Phần C (feature mới) - đây là phần được chấm
Tuần 5   Demo video, project profile, viết bài, nộp trước 13/10
```

Đừng để Phần C xuống tuần cuối. Demo và write-up ăn nhiều thời gian hơn bạn tưởng.

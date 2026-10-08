# FinAdvisor Loop Kit: o'rnatish va ishlatish

Bu komplekt loyihani "nashr qilinadigan va daromad topadigan" holatga olib borish uchun AI agent (Copilot yoki boshqa)
bilan tartibli ishlash tizimi. Ichida 131 ta agent vazifasi va 16 ta sizning (inson) vazifangiz bor.

## Ichida nima bor

| Fayl | Vazifasi |
|---|---|
| `scripts/verify.mjs` | Bitta tekshiruv buyrug'i: lint, tiplar, unit testlar, til testi, ruff, pytest, maxfiy kalit skaneri. |
| `scripts/loop.mjs` | Tsikl: vazifa tanlaydi, agentni chaqiradi, tekshiradi, o'zi belgilaydi va commit qiladi. `--status` va `--review` rejimlari bor. |
| `specs/TASKS.md` | Butun loyiha vazifalari (0-13 bosqich + inson vazifalari H1-H16). |
| `specs/LOOP_PROMPT.md` | Agentga har tsiklda beriladigan prompt. |
| `specs/REVIEW_PROMPT.md` | Alohida "tekshiruvchi" agent uchun prompt. |
| `specs/DECISIONS.md` | Qaror qilinmagan masalalar va standart qiymatlar (narxlar, limitlar, komissiya, palitra). |
| `.github/copilot-instructions.md` | Agent qoidalari (eskisini almashtiradi). |
| `gitignore.additions` | `.gitignore` ga qo'shiladigan qatorlar. |

## 1. O'rnatish (bir marta, 10 daqiqa)

1. Zip ichidagi hamma narsani loyiha ildiziga (`FinAdvisor-main/`) nusxalang. `.github/copilot-instructions.md` almashadi.
2. `gitignore.additions` ichidagi qatorlarni `.gitignore` oxiriga qo'shing. Busiz `verify` maxfiy fayl himoyasini yiqitadi.
3. Bog'liqliklarni o'rnating (CI dagi kabi):
   ```
   npm install
   python -m pip install -e "./apps/api[dev]" -e "./packages/finance-engine[dev]"
   ```
4. Git'da alohida branch oching (loop `main` da ishlashdan bosh tortadi):
   ```
   git add -A && git commit -m "add loop kit"
   git switch -c loop/work
   ```
5. Holatni ko'ring: `node scripts/loop.mjs --status`

## 2. Ishlatish: ikki yo'l

### A. Copilot Agent bilan (tavsiya, boshlash uchun)
VS Code'dagi Copilot Agent'ni tashqi skript chaqira olmaydi, shuning uchun tsiklni siz yurgizasiz:
1. `DRY_RUN=1 node scripts/loop.mjs` (PowerShell: `$env:DRY_RUN=1; node scripts/loop.mjs`) keyingi vazifa promptini chiqaradi (`.loop/prompt.md` ga ham yoziladi).

## 3. Loop qanday himoya qiladi (sinab ko'rilgan)
- `main`/`master` da yoki iflos ish papkasida ishga tushmaydi.
- Vazifani agent emas, loop yopadi: `verify` yashil bo'lishi va vazifadagi barcha tekshiruvlar (`exists`, `contains`, `cmd`...) o'tishi kerak.
- Agent boshqa vazifalarni o'zi belgilasa, loop belgini qaytaradi.
- Test fayllari o'chirilsa, tsikl rad etiladi.
- `.env` yoki `ai.config.json` o'zgarsa, loop darhol to'xtaydi.
- Bir vazifada ketma-ket `MAX_FAILS` marta yiqilsa, `.loop/blocked.md` yozib to'xtaydi va sizni chaqiradi.
- Inson vazifasiga (`H*`) bog'liq vazifalar o'tkazib yuboriladi va `--status` nima kutayotganini ko'rsatadi.

## 4. Har bosqich oxirida
`node scripts/loop.mjs --review` ni **boshqa** sessiyada ishga tushiring (tekshiruvchi agent). U `.loop/review.md` yozadi va topilgan muammolarni `## Review findings` ga vazifa qilib qo'shadi. Ular boshqa vazifalardan oldin bajariladi. Bosqichdan keyin `FULL=1 node scripts/verify.mjs` ni ham ishga tushiring (build va e2e).

## 5. Sizning vazifalaringiz (H1-H16): daromad uchun eng muhimlari
Kod tayyor bo'lishi daromad degani emas. Quyidagilarsiz mahsulotni ochib bo'lmaydi:
- **H7 + H12:** to'lov provayderi va to'lov qabul qilish uchun yuridik shaxs/soliq ro'yxati. Provayder sizning mamlakatingiz va yuridik shaklingizni qo'llab-quvvatlashi shart. Buni men tasdiqlay olmayman.
- **H8:** yurist: shartlar, maxfiylik, qaytarish siyosati va ayniqsa komissiya shartnomasi (mijoz daromadidan foiz olish aniq shartnoma talab qiladi), shaxsiy ma'lumotlar qayerda saqlanishi.
- **H5:** soliq va bank stavkalarini rasmiy manbalardan tekshirish. Agent ularni o'zi tasdiqlay olmaydi; tasdiqlanmaguncha UI "taxminiy" belgisini ko'rsatadi, `launch-gate` esa chiqarishga yo'l qo'ymaydi.
- **H4:** AI kaliti `apps/api/ai.config.json` ga (fayl git'ga kirmaydi) va oylik xarajat limiti.
- **H1-H3, H9-H11:** Google/Facebook, email, desktop imzo, domen va server, ishlab chiqarish kalitlari.
- **H14-H16:** haqiqiy foydalanuvchilar bilan sinov va haqiqiy kichik to'lovni oxirigacha sinash.
Har birini bajargach `specs/TASKS.md` da `[ ]` ni `[x]` qiling. Unga bog'liq vazifalar ochiladi.

## 6. Nima sinalgan, nima sinalmagan
- Sinalgan: `loop.mjs` mantig'i soxta agent bilan alohida sinov repozitoriyasida (muvaffaqiyat, xatodan keyin qayta urinish, belgilash himoyasi, inson vazifasini kutish, test o'chirish himoyasi, tiqilib qolish). `verify.mjs` ning maxfiy skaneri va `--status`/`DRY_RUN` real loyiha nusxasida (soxta ogohlantirishsiz).
- Sinalmagan: `verify.mjs` ning lint/tiplar/pytest/ruff qadamlari real loyihada (bu muhitda bog'liqliklar o'rnatilmagan). Birinchi vazifa (0.1) aynan shuni yashil qiladi, shuning uchun dastlab qizil chiqishi normal.
- Real AI agent bilan to'liq tsikl sinalmagan, chunki sizning agent buyrug'ingiz menga ma'lum emas.

## 7. Cheklov
Bu komplekt ishni tartibga soladi va tezlashtiradi, lekin mahsulot sifati, bozor talabi va daromadni kafolatlamaydi. Vazifalarning "done" shartlari yaxshi, lekin har bosqich oxirida natijani o'zingiz ko'zdan kechiring.

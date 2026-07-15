# Life Management

Həyatın 4 istiqamətini bir yerdən idarə etmək üçün minimalist desktop tətbiq:

1. **Azerconnect** — tam zamanlı iş (AI Content Creator)
2. **Azliderqrup** — frilans (Qrafik və Motion dizayn)
3. **Brendinq** — YouTube və sosial media
4. **Şəxsi həyat** — işdən kənar məsələlər

## Hissə 1 — Ana Səhifə (Highlights)

4 kanalın hər biri üçün şaquli termometr paneli. Termometrin "istiliyi" həmin kanaldakı
açıq taskların sayına, deadline yaxınlığına və prioritetə əsasən hesablanır:

- **Açıq göy** — az risk (task azdır, deadlinelar uzaqdır)
- **Al qırmızı** — yüksək risk (task çoxdur, deadlinelar yaxındır və ya gecikib)

Hesablama hər gün avtomatik təzələnir (gecə yarısı keçəndə yenidən hesablanır).
Termometrin altında hərarət dərəcəsi və açıq/gecikmiş task sayı görünür.
Aşağıdakı xülasə kartları kanalları ən "isti"dən ən "sakit"ə sıralayır.

### Hərarət düsturu

Hər açıq task üçün çəki: deadline gecikibsə 5, bu gün/sabahdırsa 4, ≤3 gündürsə 3,
≤7 gündürsə 2, əks halda 1 bal. Prioritet çarpanı: Aşağı ×0.7, Orta ×1, Yüksək ×1.5.
Balların cəmi yumşaq doyma əyrisi ilə (100 × (1 − e^(−bal/12))) 0–100 aralığına çevrilir —
beləcə yüklənmiş kanallar arasında da fərq görünür. "Tamamlanmış" işarəli sütunlardakı tasklar hesablanmır.

## Hissə 2 — Kanban (hər kanal üçün ayrıca)

Trello tərzi lövhə:

- Sütun əlavə et / sil / adını dəyiş (ada klikləyib birbaşa yazın)
- Hər sütunun altından task əlavə et
- Taskı sürüklə-burax (drag & drop) ilə sütunlar arasında köçür
- Taska klik etdikdə pop-up açılır: ad, təsvir, deadline, prioritet, sütun dəyişmək və silmək
- "Tamamlanmış sütun" işarəsi — bu sütundakı tasklar termometrə təsir etmir (məs. "Bitdi")

## Veb versiya (GitHub Pages — pulsuz, heç nə yükləmədən)

Tətbiq `docs/` qovluğundan birbaşa brauzerdə işləyir. GitHub Pages ilə pulsuz yayımlamaq üçün:

1. GitHub-da repozitoriyanı açın → **Settings** → **Pages**
2. **Source:** "Deploy from a branch" seçin
3. **Branch:** istifadə etdiyiniz branch-ı seçin, qovluq olaraq **/docs** seçin → **Save**
4. 1-2 dəqiqə sonra sayt hazır olur: `https://<istifadəçi-adı>.github.io/lifemanagement/`

Qeyd: pulsuz GitHub hesabında Pages yalnız **public** repozitoriyalarda işləyir.
Tasklarınız repozitoriyada yox, brauzerin lokal yaddaşında (localStorage) saxlanıldığı
üçün repozitoriyanı public etmək məlumatlarınızı açıq etmir.

### Veb versiyada məlumatların saxlanması

- Tasklar brauzerin **localStorage** yaddaşında saxlanılır — yəni hər brauzer/kompüter özünə görə ayrıdır.
- Sol paneldəki **⤓ Yedəklə** düyməsi bütün məlumatları JSON faylı kimi endirir,
  **⤒ Bərpa et** isə həmin faylı geri yükləyir.

### Cihazlar arası sinxronizasiya (pulsuz)

Sol paneldəki **☁ Sinxronizasiya** düyməsi ilə bütün cihazlarınız eyni məlumatları görə bilər.
Məlumatlar sizin GitHub hesabınızdakı **gizli Gist**-də saxlanılır — pulsuz və yalnız sizə görünür.

Qurulma (bir dəfəlik):

1. GitHub-da **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. **Generate new token (classic)** → ad yazın → icazələrdən yalnız **gist** seçin → yaradın
3. Yaranan `ghp_...` tokeni kopyalayın
4. Saytda **☁ Sinxronizasiya** → tokeni yapışdırın → **Qoşul**
5. Eyni tokeni digər cihazlarınızda da bir dəfə daxil edin — hamısı avtomatik sinxronlaşacaq

Sinxronizasiya avtomatikdir: hər dəyişiklik bir neçə saniyə içində buluda göndərilir,
başqa cihazdakı yeniliklər isə pəncərə fokusa gələndə və hər 90 saniyədən bir yoxlanılır.
Münaqişə halında ən son dəyişiklik qalib gəlir (last-write-wins).

⚠️ Token brauzerin yaddaşında saxlanılır. Ortaq istifadə olunan kompüterdə
qoşulmayın və tokenə yalnız **gist** icazəsi verin.

## Desktop versiya — quraşdırma və işə salma

```bash
npm install
npm start
```

## Paketləmə (quraşdırma faylı yaratmaq)

```bash
npm run dist
```

Windows üçün NSIS installer, macOS üçün .app, Linux üçün AppImage yaradır (`dist/` qovluğunda).

## Desktop versiyada məlumatların saxlanması

Bütün tasklar lokal olaraq JSON faylında saxlanılır:
`%APPDATA%/Life Management/data.json` (Windows) və ya
`~/Library/Application Support/Life Management/data.json` (macOS).

## Font haqqında

Anthropic-in istifadə etdiyi **Styrene** fontu kommersial lisenziyalıdır və tətbiqlə
paylana bilməz. Lisenziyanız varsa, font fayllarını `docs/fonts/` qovluğuna qoyub
`docs/styles.css` faylının əvvəlindəki `@font-face` bloklarını aktivləşdirin.
Əks halda tətbiq vizual olaraq ən yaxın sistem fontlarını (SF Pro / Segoe UI) istifadə edir.

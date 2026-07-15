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

## Quraşdırma və işə salma

```bash
npm install
npm start
```

## Paketləmə (quraşdırma faylı yaratmaq)

```bash
npm run dist
```

Windows üçün NSIS installer, macOS üçün .app, Linux üçün AppImage yaradır (`dist/` qovluğunda).

## Məlumatların saxlanması

Bütün tasklar lokal olaraq JSON faylında saxlanılır:
`%APPDATA%/Life Management/data.json` (Windows) və ya
`~/Library/Application Support/Life Management/data.json` (macOS).

## Font haqqında

Anthropic-in istifadə etdiyi **Styrene** fontu kommersial lisenziyalıdır və tətbiqlə
paylana bilməz. Lisenziyanız varsa, font fayllarını `src/fonts/` qovluğuna qoyub
`src/styles.css` faylının əvvəlindəki `@font-face` bloklarını aktivləşdirin.
Əks halda tətbiq vizual olaraq ən yaxın sistem fontlarını (SF Pro / Segoe UI) istifadə edir.

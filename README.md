# ☀️ Morning English

매일 아침 **TOEIC 10문항**, **OPIc 말하기 3문항**, **단어 10개**를 연습하는 웹앱입니다.
서버나 빌드 과정 없이 HTML·CSS·JavaScript만으로 동작합니다. 기록은 브라우저에 저장되고, 로그인하면 Supabase로 여러 기기에서 동기화됩니다.

**사이트:** https://morning-english-sage.vercel.app

## 기능

- **TOEIC**: 듣기 3(Part 2) · 문법/어휘 5(Part 5) · 독해 지문 1개 2문항(Part 7)
  - 듣기는 브라우저 내장 음성으로 읽어 주고, 보기는 답을 고른 뒤에 공개
- **OPIc**: 묘사 · 습관 · 경험/비교 또는 롤플레이 3문항, 녹음 후 다시 듣기와 셀프 체크
- **단어**: 하루 새 단어 10개를 카드로 외우고 뜻 맞히기 퀴즈로 확인
  - 간격 반복 복습: 틀린 단어는 다음 날, 맞힌 단어는 단계에 따라 2·4·7·15·30일 뒤 다시 출제
  - **단어장** 화면에서 학습한 단어를 단계별로 보고 검색, 발음 듣기
- **순환 출제**: 문제 은행을 한 바퀴 다 돌기 전에는 같은 문제가 다시 나오지 않음
- **오답 복습**: 틀린 문제를 다음 날부터 하루 최대 2문제씩 다시 출제, 맞히면 목록에서 제외
- **기록**: 연속 학습일, 날짜별 점수, 백업 내보내기·가져오기
- **계정 동기화**: 이메일·비밀번호로 로그인하면 기록이 Supabase에 저장돼 여러 기기에서 이어서 학습
- 같은 날에는 같은 문제 세트, 다시 풀면 연습 모드(기록에는 첫 시도만)

| 문제 은행 | 수량 | 한 바퀴 |
|---|---|---|
| 듣기 | 150 | 약 50일 |
| 문법/어휘 | 321 | 약 64일 |
| 독해 지문 | 90 | 90일 |
| OPIc | 165 | 45~90일 |
| 단어 | 1,008 | 약 100일 (새 단어 기준) |

## 폴더 구성

```
├── index.html          화면 뼈대
├── app.js              앱 로직
├── style.css           디자인 (라이트/다크 모드)
├── data/               문제 은행
│   ├── bank.js         공통 설정 + 문제 형식 설명
│   ├── listening*.js   듣기
│   ├── grammar*.js     문법/어휘
│   ├── reading*.js     독해
│   ├── opic.js         OPIc
│   └── vocab*.js       단어 (단어, 품사, 뜻, 예문)
├── favicon.png, apple-touch-icon.png
├── sync.js             로그인·기록 동기화 (Supabase)
├── config.js           Supabase 주소와 공개(publishable) 키, 사이트 주소
├── vendor/supabase.js  supabase-js 2.117.3 (MIT)
├── vercel.json         Vercel 설정 (보안 헤더, 캐시)
├── .vercelignore       배포에서 뺄 파일
└── windows/            Windows 실행 파일(.exe) 소스 — 웹 배포에는 포함되지 않음
```

## 로컬에서 실행

`index.html`을 더블클릭해서 브라우저로 열면 됩니다.
녹음 권한 문제를 피하려면 간단한 로컬 서버로 여는 것을 추천합니다.

```bash
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```

## 문제 추가하기

`data/bank.js` 맨 위에 형식이 설명되어 있습니다. **정답은 항상 첫 번째 보기**에 적으면 화면에서 자동으로 섞입니다.

```js
// data/grammar2.js 예시: [문장, 정답, 오답, 오답, 오답, 해설]
["The meeting was ___ until Friday.", "postponed", "postpone", "postponing", "postpones", "be + p.p. 수동태"],
```

```js
// data/vocab4.js 예시: [단어, 품사, 뜻, 예문]   품사: n v adj adv prep conj phr
["itinerary", "n", "여행 일정(표)", "I e-mailed you the travel itinerary."],
```

새 파일을 만들었다면 `index.html`의 `<script>` 목록에 한 줄 추가하세요.

## 배포하기

### 1. GitHub에 올리기

**웹에서 올리는 방법**

1. GitHub에서 **New repository** → 이름(예: `morning-english`) 입력 → **Create repository**
2. **uploading an existing file** 링크를 눌러 이 폴더 안의 파일과 폴더를 모두 끌어다 놓기
   (`.gitignore`, `.vercelignore`처럼 점으로 시작하는 파일도 포함)
3. **Commit changes**

**git 명령으로 올리는 방법**

```bash
git init
git add .
git commit -m "Morning English 첫 버전"
git branch -M main
git remote add origin https://github.com/<내-아이디>/morning-english.git
git push -u origin main
```

### 2. Vercel로 배포하기

1. [vercel.com](https://vercel.com)에 GitHub 계정으로 로그인
2. **Add New… → Project** → 방금 만든 저장소 **Import**
3. 설정은 아래처럼 두고 **Deploy**

   | 항목 | 값 |
   |---|---|
   | Framework Preset | Other |
   | Root Directory | `./` |
   | Build Command | 비워 둠 |
   | Output Directory | 비워 둠 |

4. 몇 초 뒤 `https://morning-english-xxxx.vercel.app` 주소가 생깁니다.

이후에는 GitHub에 변경 사항을 올릴 때마다 Vercel이 자동으로 다시 배포합니다.

### 3. Supabase (로그인·동기화)

1. Supabase에서 프로젝트를 만들고 **SQL Editor**에서 아래를 실행합니다.

   ```sql
   create table if not exists public.progress (
     user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );
   alter table public.progress enable row level security;
   create policy "read own progress" on public.progress for select to authenticated using ((select auth.uid()) = user_id);
   create policy "insert own progress" on public.progress for insert to authenticated with check ((select auth.uid()) = user_id);
   create policy "update own progress" on public.progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
   create policy "delete own progress" on public.progress for delete to authenticated using ((select auth.uid()) = user_id);
   grant select, insert, update, delete on public.progress to authenticated;
   revoke all on public.progress from anon;
   ```

2. **Settings → API Keys**의 Project URL과 **publishable** 키를 `config.js`에 넣고, `siteUrl`에 배포 주소를 넣습니다.
   (secret / service_role 키는 절대 넣지 마세요.)
3. `vercel.json`의 `connect-src`에 프로젝트 주소(`https://<프로젝트>.supabase.co`)를 넣습니다.
4. **Authentication → URL Configuration**에서 Site URL과 Redirect URLs에 배포 주소를 넣습니다.

기본 메일 발송은 시간당 횟수 제한이 있어서, 사용자가 많아지면 Authentication → Emails에서 SMTP를 따로 연결하세요.

### 배포 후 알아둘 점

- 로그인하지 않으면 기록은 각자의 브라우저에만 저장됩니다. 로그인하면 Supabase에 저장되고, 각 사용자는 보안 규칙(RLS)에 따라 자기 기록만 읽고 쓸 수 있습니다.
- 녹음은 HTTPS에서만 동작하는데, Vercel 주소는 기본이 HTTPS라 그대로 됩니다.
- 듣기 음성은 사용자 기기에 설치된 영어 음성을 사용하므로 기기마다 목소리가 다를 수 있습니다.

## Windows 실행 파일

`windows/` 폴더에 Edge 앱 모드로 이 웹앱을 띄우는 작은 실행 파일의 소스가 있습니다.

```bash
sudo apt install gcc-mingw-w64-x86-64   # Ubuntu 기준
bash windows/build.sh                   # → windows/build/MorningEnglish.exe
```

만든 `.exe`는 저장소에 커밋하지 말고 GitHub의 **Releases**에 첨부해 배포하는 것을 권장합니다 (`.gitignore`에서 제외되어 있음).

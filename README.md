# CastingN Crowling Project

## 11번가(11st) 및 쿠팡(Coupang)의 상품 정보를 크롤링하고 Supabase에 저장하는 크롬 확장 프로그램입니다.

## 🛠️ 기술 스택

- Node.js 22
- TypeScript
- Vite
- Supabase
- Chrome Extension API

## 프로젝트 구조

```bash
📦 crawling_extension
┣ 📂 public # 크롬 익스텐션 manifest, 아이콘 등 정적 자산
┃ ┣ 📂 icons
┃ ┃ ┗ 📜 crawl-128.png # 익스텐션 아이콘
┃ ┗ 📜 manifest.json # 크롬 익스텐션 매니페스트 파일
┣ 📂 src # 메인 소스코드
┃ ┣ 📂 interface # 타입스크립트 인터페이스 정의
┃ ┃ ┣ 📜 Crawling.ts
┃ ┃ ┗ 📜 Database.ts
┃ ┣ 📂 service # 웹사이트별 크롤링 서비스
┃ ┃ ┣ 📜 CoupangCrawling.ts
┃ ┃ ┗ 📜 ElevenstCrawling.ts
┃ ┣ 📂 utils # 유틸리티 함수
┃ ┃ ┣ 📜 supabaseClient.ts
┃ ┃ ┗ 📜 timeout.ts
┃ ┣ 📜 background.ts # 크롬 백그라운드 스크립트
┃ ┣ 📜 contents.ts # 콘텐츠 스크립트
┃ ┗ 📜 env.d.ts # 환경변수 타입 정의
┣ 📜 .env # 환경변수 설정파일 (Supabase 설정)
┣ 📜 .gitignore
┣ 📜 package-lock.json
┣ 📜 package.json
┣ 📜 README.md
┣ 📜 tsconfig.json
┗ 📜 vite.config.ts
```

## ⚙️ 설치 및 실행 방법

### 1. 레포지토리 클론 후 의존성 설치

```bash
git clone <repository-url>
cd crawling_extension
npm install
```

### 2. Supabase 설정 (.env 파일)

- .env 파일에 아래의 환경 변수를 설정합니다.

```env
VITE_SUPABASE_URL=여기에_supabase_url입력
VITE_SUPABASE_ANON_KEY=여기에_supabase_anon_key입력
```

### 3. 빌드하기

```bash
npm run build
```

### 4. 크롬 브라우저에서 확장 프로그램 로드하기

- 크롬 브라우저 주소창에서 chrome://extensions로 이동

- 개발자 모드 활성화 후, 압축해제된 확장 프로그램을 로드 선택

- 프로젝트 루트의 dist 폴더 선택

### 🚀 사용법

- 크롬 익스텐션 아이콘을 클릭하여 크롤링 시작

- 크롤링 진행상황과 완료 알림이 표시됩니다.

- 크롤링한 데이터는 Supabase의 DB에 저장됩니다.

### 🗃 데이터 스키마

- urls 테이블

```sql
CREATE TABLE urls (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  domain varchar(255),
  url text NOT NULL,
  name varchar(255),
  created_at timestamp DEFAULT CURRENT_TIMESTAMP
);
```

- results 테이블

```sql
CREATE TABLE results (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  url_id bigint REFERENCES urls(id),
  product_id varchar(50),
  title text,
  image text,
  price int,
  model_name text,
  shipping_fee int,
  return_fee int,
  soldout boolean,
  crawled_at timestamp DEFAULT CURRENT_TIMESTAMP
);
```

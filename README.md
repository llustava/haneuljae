## Sidebar Logo + MDX 템플릿

이 프로젝트는 슬라이딩 사이드바, MDX 기반 콘텐츠, 상단 배너, Firebase 추천/비추천 위젯을 한 번에 확인할 수 있는 Next.js 템플릿입니다.

### 주요 기능

- 사이드바에 로고 컬렉션을 배치하고 토글 버튼으로 폭을 조절합니다.
- 로고를 선택하면 대응되는 MDX 문서가 본문에 즉시 렌더링됩니다.
- 배너 컴포넌트는 공지/캠페인 문구를 강조하기 위한 상단 영역입니다.
- Firebase Authentication + Firestore를 사용해 실명 기반 추천/비추천을 기록합니다.

## 개발 서버

```bash
npm install
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어 결과를 확인하세요.

## MDX 콘텐츠 편집

- MDX 파일 위치: `content/*.mdx`
- 각 파일은 `components/mdx-image.tsx`를 활용해 캡션 있는 이미지를 쉽게 추가할 수 있습니다.
- 새로운 로고를 추가하려면 `public/logos`에 SVG/PNG를 넣고 `components/logo-showcase.tsx`의 `studios` 배열에 항목을 추가하세요.

## Firebase 설정 (실명제 추천/비추천)

1. Firebase 콘솔에서 프로젝트를 생성하고 Web App을 추가합니다.
2. Authentication > Sign-in method에서 Google 또는 원하는 로그인 방식을 활성화합니다.
3. Firestore Database를 생성하고 보안 규칙을 알맞게 구성합니다.
4. 다음 환경 변수를 `.env.local`에 설정합니다.

```bash
NEXT_PUBLIC_FIREBASE_API_KEY="..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="..."
NEXT_PUBLIC_FIREBASE_PROJECT_ID="..."
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="..."
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="..."
NEXT_PUBLIC_FIREBASE_APP_ID="..."
NEXT_PUBLIC_FIREBASE_ALLOWED_DOMAIN="@hansung-sh.hs.kr"
```

`components/vote-panel.tsx`는 `logoVotes` 컬렉션을 사용하며, 문서 ID는 `<slug>_<uid>` 형식으로 저장됩니다.

댓글 인터페이스는 현재 비활성화되어 있어 별도의 `logoComments` 컬렉션 구성은 필요하지 않습니다.

## 배포

일반적인 Next.js 프로젝트와 동일하게 `npm run build` 후 Vercel 등의 호스팅 서비스에 배포할 수 있습니다.

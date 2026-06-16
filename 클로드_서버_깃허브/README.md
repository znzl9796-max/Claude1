# 클로드 리워드 — 네이버 쇼핑 순위 자동 크롤러

GitHub만으로 네이버 쇼핑 순위를 **하루 2회 자동 수집**하는 구조입니다.
별도 서버(VPS) 없이 GitHub Actions가 크롤링을 대신 돌립니다.

## 전체 그림

```
[관리자 화면(클로드.html)] 
        │  슬롯 등록 (키워드 + 상품 MID)
        ▼
   data/slots.json   ←  크롤링 대상 목록
        │
        ▼
[GitHub Actions]  ──하루 2회──▶  scripts/crawl.js (Puppeteer로 네이버 쇼핑 검색)
        │
        ▼
   data/rankings.json  ←  순위 결과 저장 (자동 커밋)
        │
        ▼
[프론트엔드]  rankings.json 을 fetch 해서 화면에 순위 표시
```

## 폴더 구조

```
.
├── .github/workflows/crawl.yml   # 자동 실행 스케줄 (하루 2회)
├── scripts/crawl.js              # 크롤러 본체
├── data/slots.json               # 크롤링 대상 (키워드+MID)
├── data/rankings.json            # 크롤링 결과 (자동 생성/갱신)
└── package.json
```

## 설치 순서

1. **GitHub 레포 생성** 후 이 파일들을 전부 push

2. **Actions 권한 켜기**
   - 레포 → Settings → Actions → General
   - "Workflow permissions"에서 **Read and write permissions** 선택 후 저장
   - (크롤러가 결과를 레포에 커밋하려면 쓰기 권한 필요)

3. **수동 테스트 실행**
   - 레포 → Actions 탭 → "네이버 쇼핑 순위 크롤링" → "Run workflow"
   - 끝나면 `data/rankings.json`이 갱신되는지 확인

4. **자동 실행 확인**
   - 이후 매일 오전 10시 / 오후 3시(KST)에 자동으로 돕니다.

## 슬롯 추가 방법

`data/slots.json`에 항목을 추가하면 다음 크롤링부터 자동 포함됩니다.

```json
[
  { "id": 1, "user": "총판테스트", "keyword": "써큘레이터", "mid": "80123456789" }
]
```

> 관리자 화면(클로드.html)에서 슬롯을 추가할 때 이 파일도 같이 업데이트되도록
> 연동하면 완전 자동화됩니다. (아래 "프론트 연동" 참고)

## 프론트엔드 연동

`rankings.json`은 raw URL로 바로 읽을 수 있습니다:

```
https://raw.githubusercontent.com/<깃허브아이디>/<레포명>/main/data/rankings.json
```

클로드.html의 순위 조회 화면에서 이 URL을 fetch 하면 자동 수집된 순위가 표시됩니다:

```javascript
async function loadRankings() {
  const url = 'https://raw.githubusercontent.com/<아이디>/<레포>/main/data/rankings.json';
  const res = await fetch(url);
  const data = await res.json();
  // data.rankings[] 를 슬롯 표에 매핑
  // 예: { id, keyword, mid, rank, checkedAt }
  return data.rankings;
}
```

## 중요 — 현실적인 한계

1. **네이버는 봇 차단이 강합니다.** Stealth 플러그인을 써도 시간이 지나면
   GitHub Actions IP가 차단될 수 있습니다. 차단되면 순위가 null로 나옵니다.
2. 안정성이 필요하면 **네이버 검색 API(공식)** 또는 **유료 프록시**를 붙이는 게 좋습니다.
3. DOM 선택자(`nvMid=`)는 네이버가 페이지 구조를 바꾸면 깨질 수 있어
   `scripts/crawl.js`의 `page.evaluate` 부분을 그때그때 수정해야 합니다.
4. GitHub Actions 무료 사용량(월 2000분) 안에서 도는 규모인지 확인하세요.
   슬롯이 수백 개면 유료 또는 전용 서버가 필요합니다.

## 더 안정적으로 가려면

- **전용 서버(VPS)**: 카페24/AWS/가비아 등에 Node 서버를 두고
  cron + Puppeteer로 상시 크롤링 → DB 저장 → API 제공
- **네이버 검색 API**: 차단 걱정 없지만 "쇼핑 노출 순위"가 아닌
  "검색 API 결과 순서"라 실제 광고 순위와 다를 수 있음

필요하면 전용 서버 버전(Express + MySQL)도 만들어 드립니다.

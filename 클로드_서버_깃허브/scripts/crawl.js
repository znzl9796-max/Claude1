/**
 * 네이버 쇼핑 순위 크롤러
 * ------------------------------------------------------------
 * slots.json 에 등록된 슬롯(키워드 + 상품 MID)을 읽어서
 * 네이버 쇼핑 검색 결과에서 해당 상품의 순위를 찾아
 * data/rankings.json 으로 저장한다.
 *
 * GitHub Actions(crawl.yml)가 하루 2회 자동 실행한다.
 * ------------------------------------------------------------
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// 봇 감지 우회 (네이버는 봇을 강하게 막으므로 필수)
puppeteer.use(StealthPlugin());

// ── 경로 ──
const SLOTS_PATH = path.join(__dirname, '..', 'data', 'slots.json');
const OUT_PATH = path.join(__dirname, '..', 'data', 'rankings.json');

// 검색 결과 몇 페이지까지 뒤질지 (1페이지 = 약 40개 상품)
const MAX_PAGES = 5;

// 슬롯 로드
function loadSlots() {
  if (!fs.existsSync(SLOTS_PATH)) {
    console.log('slots.json 이 없습니다. 빈 배열로 진행합니다.');
    return [];
  }
  return JSON.parse(fs.readFileSync(SLOTS_PATH, 'utf-8'));
}

// 한 키워드에 대해 상품 MID 순위 찾기
async function findRank(page, keyword, targetMid) {
  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const url =
      'https://search.shopping.naver.com/search/all?query=' +
      encodeURIComponent(keyword) +
      '&pagingIndex=' + pageNum +
      '&pagingSize=40&sort=rel';

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    // 너무 빠르면 차단되므로 약간 대기
    await new Promise(function (r) { setTimeout(r, 1500 + Math.random() * 1500); });

    // 페이지 안에서 상품 목록의 MID(nvMid) 추출
    const mids = await page.evaluate(function () {
      var found = [];
      // 상품 링크의 nvMid 파라미터를 긁는다 (네이버 DOM 구조 변동 시 수정 필요)
      var anchors = document.querySelectorAll('a[href*="nvMid="]');
      anchors.forEach(function (a) {
        var m = a.href.match(/nvMid=(\d+)/);
        if (m) found.push(m[1]);
      });
      return found;
    });

    // 이번 페이지에서 타겟 MID 위치 확인
    const idx = mids.indexOf(String(targetMid));
    if (idx !== -1) {
      // 전체 순위 = 이전 페이지 누적 + 현재 인덱스 + 1
      return (pageNum - 1) * 40 + idx + 1;
    }
  }
  return null; // MAX_PAGES 내에 못 찾음
}

async function main() {
  const slots = loadSlots();
  console.log('크롤링 대상 슬롯: ' + slots.length + '개');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR'],
  });

  const results = [];

  for (const slot of slots) {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    );

    let rank = null;
    try {
      rank = await findRank(page, slot.keyword, slot.mid);
      console.log(
        '[' + slot.keyword + '] MID ' + slot.mid + ' → ' +
        (rank ? rank + '위' : '미노출(5p 밖)')
      );
    } catch (e) {
      console.error('에러 (' + slot.keyword + '): ' + e.message);
    }

    results.push({
      id: slot.id,
      user: slot.user,
      keyword: slot.keyword,
      mid: slot.mid,
      rank: rank,           // null = 5페이지 내 미노출
      checkedAt: new Date().toISOString(),
    });

    await page.close();
    // 슬롯 간 간격 (차단 방지)
    await new Promise(function (r) { setTimeout(r, 2000 + Math.random() * 2000); });
  }

  await browser.close();

  // 결과 저장
  const output = {
    updatedAt: new Date().toISOString(),
    rankings: results,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log('완료: ' + OUT_PATH + ' (' + results.length + '건)');
}

main().catch(function (e) {
  console.error('크롤러 전체 실패:', e);
  process.exit(1);
});

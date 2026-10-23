/* i18n.js - site-wide English <-> Korean toggle.
 *
 * Everything is hardcoded below (no network, no machine translation):
 *   DICT      exact UI strings (labels, buttons, tooltips, errors). Matching is on the WHOLE text node,
 *             case-insensitive, so prose ("This archive is a personal collection...") is never touched.
 *   PATTERNS  UI strings with numbers in them ("12 images", "3 days ago", ...).
 *   GROUPS / MEMBERS  Hangul names. Applied only to text that is all-caps (names, counts, separators),
 *             so a sentence that happens to mention TWICE stays as written.
 *
 * To add a string: put it in DICT (key = the English text exactly as it appears on screen).
 * To keep an element untouched: add data-i18n-skip to it (or add a selector to SKIP below).
 *
 * Translated text is wrapped in <span class="i18n-ko"> (that is what gets the Korean font and size, see
 * KO_SCALE / KO_FONT below), and its parent element gets a data-ko attribute. Both are removed in English mode.
 *
 * Public API: window.I18n = { lang, set(l), toggle(), ko(name), tr(str), original(el), jamo(s), choseong(s), groups, members }
 * Event: document 'lang-change' (detail: 'en' | 'ko').
 */
(function () {
  'use strict';

  var STORE_KEY = 'lang';

  var KO_SCALE = 1.1;
  var KO_FONT = '"Noto Sans KR", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  var KO_FONT_URL = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap';

  var GROUPS = {
    'UNIS': '유니스', 'ILLIT': '아일릿', 'NEWJEANS': '뉴진스', 'IVE': '아이브', 'STAYC': '스테이씨',
    'AESPA': '에스파', 'FROMIS': '프로미스나인', 'LOONA': '이달의 소녀', 'ITZY': '있지', 'IU': '아이유',
    'RED VELVET': '레드벨벳', 'TWICE': '트와이스'
  };

  var MEMBERS = {
    'YUNAH': '윤아', 'MINJU': '민주', 'MOKA': '모카', 'WONHEE': '원희', 'IROHA': '이로하',
    'HYEONJU': '현주', 'NANA': '나나', 'GEHLEE': '젤리', 'KOTOKO': '코토코', 'YUNHA': '윤하',
    'ELISIA': '엘리시아', 'YOONA': '윤아', 'SEOWON': '서원',
    'MINJI': '민지', 'HANNI': '하니', 'DANIELLE': '다니엘', 'HAERIN': '해린', 'HYEIN': '혜인',
    'GAEUL': '가을', 'YUJIN': '유진', 'REI': '레이', 'WONYOUNG': '원영', 'LIZ': '리즈', 'LEESEO': '이서',
    'SUMIN': '수민', 'SIEUN': '시은', 'ISA': '아이사', 'SEEUN': '세은', 'YOON': '윤', 'J': '제이',
    'KARINA': '카리나', 'GISELLE': '지젤', 'WINTER': '윈터', 'NINGNING': '닝닝',
    'SAEROM': '새롬', 'HAYOUNG': '하영', 'GYURI': '규리', 'JIWON': '지원', 'JISUN': '지선',
    'SOYEON': '서연', 'CHAEYOUNG': '채영', 'NAKYUNG': '나경', 'JIHEON': '지헌',
    'VIVI': '비비', 'YVES': '이브', 'JINSOUL': '진솔', 'HASEUL': '하슬', 'KIMLIP': '김립', 'CHUU': '츄',
    'HEEJIN': '희진', 'HYUNJIN': '현진', 'GOWON': '고원', 'CHOERRY': '최리', 'OLIVIA': '올리비아', 'YEOJIN': '여진',
    'YEJI': '예지', 'LIA': '리아', 'RYUJIN': '류진', 'CHAERYEONG': '채령', 'YUNA': '유나',
    'IU': '아이유',
    'IRENE': '아이린', 'SEULGI': '슬기', 'WENDY': '웬디', 'JOY': '조이', 'YERI': '예리',
    'NAYEON': '나연', 'JEONGYEON': '정연', 'MOMO': '모모', 'SANA': '사나', 'JIHYO': '지효', 'MINA': '미나',
    'DAHYUN': '다현', 'TZUYU': '쯔위'
  };

  var NAMES = {};
  Object.keys(GROUPS).forEach(function (k) { NAMES[k] = GROUPS[k]; });
  Object.keys(MEMBERS).forEach(function (k) { NAMES[k] = MEMBERS[k]; });

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var NAME_RE = new RegExp('\\b(' + Object.keys(NAMES)
    .sort(function (a, b) { return b.length - a.length; }).map(esc).join('|') + ')\\b', 'g');

  var DICT = {
    'Home': '홈', 'Volume Tree': '용량 트리', 'Get Premium': '프리미엄 구매',
    'Random member': '무작위 멤버',
    'Premium active (open profile)': '프리미엄 이용 중 (프로필 열기)',
    'Toggle dark mode': '다크 모드 전환', 'Dark mode': '다크 모드',
    'search': '검색', 'Search groups and members': '그룹/멤버 검색',
    'Recent': '최근', 'Groups': '그룹', 'Members': '멤버',
    'Expand all': '모두 펼치기', 'Collapse all': '모두 접기',
    'Expand all folders': '모든 폴더 펼치기', 'Collapse all folders': '모든 폴더 접기',
    'Expand recent': '최근 항목 펼치기', 'Collapse recent': '최근 항목 접기',
    'Remove from recent': '최근 목록에서 삭제', 'No matches': '검색 결과 없음',
    'prev / next': '이전 / 다음', 'Archive navigation': '아카이브 탐색', 'Archive': '아카이브',
    'Recently viewed': '최근 본 항목',

    'Server': '서버', 'Online': '온라인', 'Offline': '오프라인', 'Login': '로그인',
    'Mute sound effects': '효과음 끄기', 'Unmute sound effects': '효과음 켜기',
    'Accent color': '강조 색상', 'Accent': '강조색', 'Hue': '색조', 'Saturation': '채도', 'Lightness': '명도',
    'Random': '무작위', 'Reset': '초기화',
    'Save': '저장', 'Pick a slot to save this color': '이 색을 저장할 칸을 선택하세요',
    
    'Donate': '후원하기', 'Support the archive': '아카이브 후원하기',
    'Donate with PayPal': 'PayPal로 후원하기', 'Opens PayPal in a new tab.': 'PayPal이 새 탭에서 열립니다.',
    'Premium & Support': '프리미엄 및 후원',
    'Your preset (right-click to restore)': '내 프리셋 (우클릭하여 복원)',
    'Your preset (right-click or long-press to restore)': '내 프리셋 (우클릭 또는 길게 눌러 복원)',
    'Premium active': '프리미엄 이용 중',

    'Reset view': '보기 초기화', 'Save as image': '이미지로 저장', 'generated': '생성',
    'Hue value': '색조 값', 'Saturation value': '채도 값', 'Lightness value': '명도 값',
    'Click to copy, paste or type a value, then press Enter': '클릭하여 복사하거나 값을 붙여넣기/입력한 뒤 Enter를 누르세요',
    'Gold': '골드', 'Rose': '로즈', 'Coral': '코랄', 'Lime': '라임', 'Emerald': '에메랄드',
    'Teal': '틸', 'Sky': '스카이', 'Violet': '바이올렛',

    'Image Gallery': '이미지 갤러리', 'Image Volume Tree': '이미지 용량 트리',

    'Building gallery': '갤러리 생성 중', 'Images': '이미지', 'Budget': '한도', 'Full': '가득 참',
    'Open a random image': '무작위 이미지 열기', 'GO': '이동', 'Jump to the entered date': '입력한 날짜로 이동',
    'Invalid format - use YYMMDD': '형식 오류 - YYMMDD로 입력하세요',
    'Sort descending': '내림차순 정렬', 'Sort ascending': '오름차순 정렬', 'Desc': '내림차순', 'Asc': '오름차순',
    'Sort Chronological': '날짜순 정렬', 'Sort by recent uploads': '최근 저장순 정렬',
    'Chronological': '시간순',
    'Sort': '정렬', 'Order': '순서', 'Layout': '레이아웃',
    'Grid': '그리드', 'Masonry': '메이슨리', 'Grid layout': '그리드 레이아웃', 'Masonry layout': '메이슨리 레이아웃',
    'Filter gallery': '갤러리 필터', 'Sorting…': '정렬 중…', 'Scroll to top': '맨 위로',

    'Visual search': '시각 검색', 'Visual Search': '시각 검색', 'About visual search': '시각 검색 정보',
    'Clear search': '검색 지우기',
    'Member count': '멤버 수', 'Member Filter': '멤버 필터', 'With member': '함께한 멤버',
    'Orientation': '방향', 'Portrait': '세로', 'Landscape': '가로', 'Square': '정사각형',
    'Assignment': '날짜 할당', 'Assigned': '지정됨', 'Unassigned': '미지정',
    'Date range': '기간', 'File size': '파일 크기', 'Resolution': '해상도',
    'Reset all filters': '모든 필터 초기화', 'Clear all filters': '모든 필터 초기화',
    'Filter by this author': '이 작성자로 필터', 'Authors': '작성자',
    'Image actions': '이미지 작업', 'Copy deep link': '직접 링크 복사', 'Updated': '업데이트',
    'Author': '작성자', 'Reset authors': '작성자 초기화',
    'Unknown source': '출처 불명', 'Search authors…': '작성자 검색',
    'Loading authors…': '작성자 불러오는 중…', 'No matching authors': '일치하는 작성자 없음',
    'Reset member count': '멤버 수 초기화', 'Reset co-member filter': '함께한 멤버 초기화',
    'Reset orientation': '방향 초기화', 'Reset assignment': '날짜 할당 초기화',
    'Reset date range': '기간 초기화', 'Reset file size': '파일 크기 초기화', 'Reset resolution': '해상도 초기화',
    'Deselect a member to add another': '다른 멤버를 추가하려면 선택을 해제하세요',
    'No images with this combination': '이 조합의 이미지가 없습니다',
    'Filtered': '필터됨', 'searching…': '검색 중…', 'too many requests': '요청이 너무 많습니다',
    'search failed': '검색 실패', 'Reset filters and open': '필터 초기화 후 열기',

    'Image info': '이미지 정보', 'Saved': '저장 날짜', 'Aspect ratio': '가로세로 비율',
    'Pixel count': '픽셀 수', 'Megapixels': '메가픽셀', 'Avg colors': '평균 색상', 'Brightness': '밝기',
    'Color diversity': '색상 다양성', 'Fill ratio': '채움 비율', 'With': '함께', 'Source': '출처',
    'Translate': '번역', 'Show original': '원문 보기', 'Failed': '실패',
    'Not assigned': '날짜 미지정', 'Not assigned to a date yet': '아직 날짜가 지정되지 않음',
    'Unavailable': '사용 불가',
    'Toggle image details': '이미지 정보 표시 전환', 'Toggle image details (I)': '이미지 정보 표시 전환 (I)',
    'Toggle source panel': '출처 패널 표시 전환', 'Toggle source panel (O)': '출처 패널 표시 전환 (O)',
    'No source for this image': '이 이미지의 출처 없음',
    'Download image': '이미지 다운로드', 'Download': '다운로드',
    'Favorite': '즐겨찾기', 'Unfavorite': '즐겨찾기 해제', 'Report': '신고', 'Favorite [F]': '즐겨찾기 [F]', 'Unfavorite [F]': '즐겨찾기 해제 [F]', 'Report [X]': '신고 [X]',
    'Theatre [T]': '극장 모드 [T]', 'Show panels [T]': '패널 표시 [T]', 'Theatre mode': '극장 모드', 'Show panels': '패널 표시',
    'Find in gallery [G]': '갤러리에서 찾기 [G]', 'Show in gallery': '갤러리에서 보기',
    'Copy link': '링크 복사', 'Copy link [C]': '링크 복사 [C]', 'Click to copy': '클릭하여 복사', 'Random [R]': '무작위 [R]', 'Copied': '복사됨', 'Copy failed': '복사 실패', 'Copy link to this image': '이미지 링크 복사',
    'Previous Image': '이전 이미지', 'Next Image': '다음 이미지', 'Close': '닫기', 'Open tweet': '트윗 열기',
    'Image preview': '이미지 미리보기', 'Ctrl click + scroll to zoom': 'Ctrl+클릭 후 스크롤하여 확대',
    'Image unavailable': '이미지를 불러올 수 없음', 'Failed to load image.': '이미지를 불러오지 못했습니다.',
    'Retry': '다시 시도', 'Upgrade to Premium': '프리미엄 업그레이드',
    'Rate limited': '요청 제한',
    'Too many requests. Premium removes this limit entirely.': '요청이 너무 많습니다. 프리미엄은 이 제한이 없습니다.',
    'Too many requests, please wait a moment and try again.': '요청이 너무 많습니다. 잠시 후 다시 시도하세요.',
    "This image couldn't be found. It may have been moved or removed.": '이미지를 찾을 수 없습니다. 이동되었거나 삭제되었을 수 있습니다.',
    'Load failed': '불러오기 실패', 'Connection error': '연결 오류',
    "Couldn't load this image. Check your connection and try again.": '이미지를 불러오지 못했습니다. 연결을 확인하고 다시 시도하세요.',
    'Assigned date': '할당 날짜',

    'No other members': '다른 멤버 없음', 'No set assigned': '지정된 세트 없음',
    'Coverage unknown': '커버리지 확인 불가',
    'Resolved via primary database': '주 데이터베이스에서 확인됨',
    'Resolved via fallback database': '보조 데이터베이스에서 확인됨',
    'Resolved via news database': '뉴스 데이터베이스에서 확인됨',
    'No matching source data': '일치하는 출처 데이터 없음',
    'Source coverage': '출처 커버리지', 'loading coverage...': '커버리지 로딩 중...',
    'coverage unavailable': '커버리지를 불러올 수 없음',

    'Report image': '이미지 신고', 'Reason': '사유', 'required': '필수', 'optional': '선택',
    'Incorrect date': '잘못된 날짜', 'Incorrect member': '잘못된 멤버', 'Incorrect group': '잘못된 그룹',
    'Missing or incorrect featured member': '누락되었거나 잘못된 참여 멤버', 'Other': '기타',
    'Comment': '댓글', 'Add a note...': '메모를 추가하세요...', 'Cancel': '취소', 'Submit': '제출',
    'thanks!': '감사합니다!',

    'Profile': '프로필', 'Username': '아이디', 'Password': '비밀번호',
    'Register': '회원가입', "Don't have an account?": '계정이 없으신가요?', 'Register →': '회원가입 →',
    'Already have an account?': '이미 계정이 있으신가요?', 'Login →': '로그인 →',
    'Forgot password?': '비밀번호를 잊으셨나요?', 'Recover Account': '계정 복구',
    'Recovery code (XXXX-XXXX-XXXX)': '복구 코드 (XXXX-XXXX-XXXX)', 'New password': '새 비밀번호',
    'Recover': '복구', '← Back to login': '← 로그인으로 돌아가기',
    'Save Your Recovery Code': '복구 코드를 저장하세요', 'New Recovery Code': '새 복구 코드',
    'Account Recovered': '계정이 복구되었습니다', 'Click to reveal': '클릭하여 보기',
    'A new recovery code has been generated.': '새 복구 코드가 생성되었습니다.',
    'This code is the only way to recover your account if you forget your password. It will not be shown again.': '이 코드는 비밀번호를 잊었을 때 계정을 복구할 수 있는 유일한 방법입니다. 다시 표시되지 않습니다.',
    'Your password has been changed and a new recovery code has been generated. Your old code no longer works.': '비밀번호가 변경되었으며 새 복구 코드가 생성되었습니다. 이전 코드는 더 이상 사용할 수 없습니다.',
    "Can't reach the server right now. Please try again later.": '지금은 서버에 연결할 수 없습니다. 나중에 다시 시도하세요.',
    'Copy code': '코드 복사', 'Copied!': '복사됨!',
    "I've saved this code somewhere safe": '안전한 곳에 코드를 저장했습니다', 'Continue': '계속',
    'Rank': '순위', 'Progress': '진행률', 'Account recovery': '계정 복구',
    'Generate code': '코드 생성', 'Regenerate code': '코드 재생성', 'Code active': '코드 활성화됨', 'No code yet': '코드 없음',
    'Most viewed': '가장 많이 본', 'No data yet': '데이터 없음', 'Favorites': '즐겨찾기', 'view all': '모두 보기',
    'Free plan': '무료 플랜', 'Premium': '프리미엄', 'Logout': '로그아웃', 'Expired': '만료됨',
    'Loading…': '불러오는 중…', 'Loading progress…': '진행률 불러오는 중…', 'Not logged in': '로그인되지 않음',
    'Error loading progress': '진행률 불러오기 오류',
    'Premium Access': '프리미엄 이용권', 'Continue to purchase': '구매 진행', '90 days': '90일',
    'Open image': '이미지 열기', 'Go to member page': '멤버 페이지로 이동',
    'age →': '가입 경과 →',
    'group': '그룹', 'member': '멤버', 'all': '전체',
    'Please enter both username and password.': '아이디와 비밀번호를 모두 입력하세요.',
    'Please enter both fields.': '두 항목을 모두 입력하세요.', 'Please fill out both fields.': '두 항목을 모두 입력하세요.',
    'Please fill out all fields.': '모든 항목을 입력하세요.',
    'Too many attempts. Please wait a moment.': '시도 횟수가 너무 많습니다. 잠시 기다려 주세요.',
    'Server error. Please try again later.': '서버 오류입니다. 나중에 다시 시도하세요.',
    'Logged in successfully!': '로그인되었습니다!',
    'Incorrect username or password.': '아이디 또는 비밀번호가 올바르지 않습니다.',
    'Login failed. Try again.': '로그인에 실패했습니다. 다시 시도하세요.',
    'That username is already taken.': '이미 사용 중인 아이디입니다.',
    'Username must be at least 3 characters.': '아이디는 3자 이상이어야 합니다.',
    'Password must be at least 6 characters.': '비밀번호는 6자 이상이어야 합니다.',
    'Registration failed.': '회원가입에 실패했습니다.',
    'Username or recovery code is incorrect.': '아이디 또는 복구 코드가 올바르지 않습니다.',
    'Recovery failed. Please try again.': '복구에 실패했습니다. 다시 시도하세요.',

    'About': '소개', 'Usage/Features': '사용법/기능', 'Feedback': '의견', 'Update Log': '업데이트 기록',
    'Recent Uploads': '최근 업로드', 'Read more': '더 보기', 'Show less': '접기', 'Send feedback': '의견 보내기',
    'Report issues, suggest improvements…': '문제 제보, 개선 제안…', 'last updated': '마지막 업데이트',
    'Search for a member': '멤버 검색', 'Date search': '날짜 검색', 'Timeline scrubber': '타임라인 스크러버',
    'Random image button': '무작위 이미지 버튼', 'Asc / desc date sort': '날짜 오름/내림차순 정렬',
    'Chronological / recent': '시간순 / 최근순', 'Grid / masonry layouts': '그리드 / 메이슨리 레이아웃',
    'Filter by other members': '다른 멤버로 필터', 'CLIP Visual search': 'CLIP 시각 검색',
    'Size & resolution filters': '크기 및 해상도 필터', 'Ctrl+click to magnify': 'Ctrl+클릭으로 확대',
    'Download full resolution': '원본 해상도 다운로드',
    'Birthdays': '생일', 'On this day': '과거의 오늘',
    'today': '오늘', 'tomorrow': '내일', 'yesterday': '어제',
    'Next birthday': '다음 생일', 'Happy birthday!': '생일 축하해요!', 'Earlier': '이전', 'day': '일', 'days': '일',
    'Back to today': '오늘로 돌아가기', 'Shuffle': '섞기', 'Throwback': '추억', 'No photos from this day': '이 날의 사진이 없습니다',
    'Previous day': '이전 날', 'Next day': '다음 날',

    'VOLUME': '용량', 'GENERAL STATS': '전체 통계',
    'TOTAL IMAGES:': '전체 이미지:', 'UNIQUE IMAGES:': '고유 이미지:', 'UNDATED IMAGES:': '날짜 미지정 이미지:',
    'ARCHIVE SIZE:': '아카이브 크기:', 'AVG SIZE PER IMAGE:': '이미지당 평균 크기:', 'IMAGES PER GB:': 'GB당 이미지 수:',
    'GROUPS:': '그룹:', 'AVG PER GROUP:': '그룹당 평균:', 'MEMBERS:': '멤버:', 'AVG PER MEMBER:': '멤버당 평균:',
    'Contribution = images_i ÷ images_top': '기여도 = images_i ÷ images_top',
    'Groupings': '조합', 'Show all': '모두 보기', 'graph': '그래프', 'Changelog': '변경 기록',
    'Update History': '업데이트 기록', '2021 – present': '2021 – 현재',
    'Full history (2012 – present)': '전체 기록 (2012 – 현재)',
    'Open interactive graph': '인터랙티브 그래프 열기', 'Show 2021 to present': '2021년부터 현재까지 보기',
    'Show full history': '전체 기록 보기', 'Interactive member activity graph': '멤버 활동 인터랙티브 그래프',
    'Member Activity': '멤버 활동',
    'Tags only': '태그만 보기', 'Collapse all entries': '모든 항목 접기',
    'Latest open': '최신 항목만 펼침', 'Open the latest entry only': '최신 항목만 펼치기',
    'Expand all entries': '모든 항목 펼치기', 'loading graphs…': '그래프 불러오는 중…',
    'Open the interactive graph': '인터랙티브 그래프 열기',
    'graph data unavailable': '그래프 데이터를 불러올 수 없음', 'changelog unavailable': '변경 기록을 불러올 수 없음',
    'N/A': '해당 없음',
    'Failed to load recent uploads.': '최근 업로드를 불러오지 못했습니다.',

    'Too many requests.': '요청이 너무 많습니다.', 'No images found.': '이미지를 찾을 수 없습니다.',
    'Thanks for your feedback!': '의견 감사합니다!', 'Failed to send feedback.': '의견을 보내지 못했습니다.',
    'Error: could not send feedback.': '오류: 의견을 보내지 못했습니다.',
    "Couldn't start checkout. Please try again in a moment.": '결제를 시작하지 못했습니다. 잠시 후 다시 시도하세요.',
    "Couldn't generate a recovery code. Please try again.": '복구 코드를 생성하지 못했습니다. 다시 시도하세요.'
  };

  var LOOKUP = {};
  Object.keys(DICT).forEach(function (k) { LOOKUP[k.toLowerCase()] = DICT[k]; });

  function tn(s) { return s.replace(NAME_RE, function (x) { return NAMES[x]; }); }
  var MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
  var MONRE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
  var UNIT = { year: '년', month: '개월', week: '주', day: '일', hour: '시간', minute: '분' };

  var PATTERNS = [
    [/^Image ([\d,]+) of ([\d,]+)$/, function (m) { return '이미지 ' + m[1] + ' / ' + m[2]; }],
    [/^Download failed \(HTTP (\d+)\)\.$/, function (m) { return '다운로드 실패 (HTTP ' + m[1] + ').'; }],
    [/^(\d{4}-\d{2}) \u00b7 All$/, function (m) { return m[1] + ' \u00b7 전체'; }],
    [/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})( \(\d+\))?$/, function (m) {
      var mo = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(m[1]) + 1;
      return m[3] + '년 ' + mo + '월 ' + parseInt(m[2], 10) + '일' + (m[4] || '');
    }],
    [/^created_at → (\d{6})$/, function (m) { return '가입_일 → ' + m[1]; }],
    [/^Filtered: (.+) of (.+) images$/, function (m) { return '필터됨: ' + m[1] + ' / ' + m[2] + '장'; }],
    [/^([\d,]+) of ([\d,]+) assigned \(([\d.]+)%\)$/, function (m) { return m[1] + ' / ' + m[2] + '장 지정됨 (' + m[3] + '%)'; }],
    [/^(Assigned|Saved): (\d{6})$/, function (m) { return (m[1] === 'Assigned' ? '할당 날짜' : '저장 날짜') + ': ' + m[2]; }],
    [/^([\d,]+) images?( · saved)?$/, function (m) { return m[1] + '장' + (m[2] ? ' · 저장 날짜 기준' : ''); }],
    [/^([\d,]+) favorites$/, function (m) { return '즐겨찾기 ' + m[1] + '개'; }],
    [/^Next \+1 in (\d+)s$/, function (m) { return '다음 +1: ' + m[1] + '초 후'; }],
    [/^\+1 in (\d+)s$/, function (m) { return m[1] + '초 후 +1'; }],
    [/^(· )?(\d+) (year|month|week|day|hour|minute)s? ago$/, function (m) {
      var u = UNIT[m[3]];
      return (m[1] || '') + m[2] + u + ' 전';
    }],
    [/^(· )?just now$/, function (m) { return (m[1] || '') + '방금'; }],
    [/^\+([\d,]+) this update$/, function (m) { return '이번 업데이트 +' + m[1]; }],
    [/^(\d+) other members?$/, function (m) { return '다른 멤버 ' + m[1] + '명'; }],
    [/^Also filed under (\d+) other member folders?$/, function (m) { return '다른 멤버 폴더 ' + m[1] + '곳에도 있음'; }],
    [/^Set (\S+)$/, function (m) { return '세트 ' + m[1]; }],
    [/^Remove (.+) from recent$/, function (m) { return '최근 목록에서 ' + tn(m[1]) + ' 삭제'; }],
    [/^Couldn't load this image \(HTTP (\d+)\)\.$/, function (m) { return '이미지를 불러오지 못했습니다 (HTTP ' + m[1] + ').'; }],
    [/^in (\d+) days?$/, function (m) { return m[1] + '일 후'; }],
    [/^([\d,]+) images \u00b7 (\d{4})$/, function (m) { return m[1] + '장 \u00b7 ' + m[2] + '년'; }],
    [/^(\d+) days?$/, function (m) { return m[1] + '일'; }],
    [new RegExp('^' + MONRE + '$'), function (m) { return MON[m[1]] + '월'; }],
    [new RegExp('^' + MONRE + ' (\\d{1,2})$'), function (m) { return MON[m[1]] + '월 ' + parseInt(m[2], 10) + '일'; }],
    [new RegExp('^On this day \\u00b7 ' + MONRE + ' (\\d{1,2})$'), function (m) { return '과거의 오늘 \u00b7 ' + MON[m[1]] + '월 ' + parseInt(m[2], 10) + '일'; }],
    [/^([\d,]+) images \u00b7 ([\d,]+) members \u00b7 ([\d,]+) years$/, function (m) { return m[1] + '장 \u00b7 ' + m[2] + '명 \u00b7 ' + m[3] + '년'; }],
    [new RegExp('^' + MONRE + ' (\\d{4})$'), function (m) { return m[2] + '년 ' + MON[m[1]] + '월'; }],
    [new RegExp('^' + MONRE + '[\\u2013-]' + MONRE + ' (\\d{4})$'), function (m) { return m[3] + '년 ' + MON[m[1]] + '–' + MON[m[2]] + '월'; }],
    [new RegExp('^' + MONRE + ' (\\d{4}) \\u2013 ' + MONRE + ' (\\d{4})$'), function (m) {
      return m[2] + '년 ' + MON[m[1]] + '월 – ' + m[4] + '년 ' + MON[m[3]] + '월';
    }]
  ];

  var SKIP_TAG = /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT|CODE|PRE|SVG|CANVAS)$/;
  var ATTR_SKIP_TAG = /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE|CANVAS)$/;
  var SKIP = '[data-i18n-skip],#lbFilename,#lbMetaFilename,.filename,.lb-infobar-name,.lb-filename,' +
    '#lbTweetCaption,#lbTweetAuthor,#lbTweetHandle,#lbTweetId,.lb-tweet-caption,' +
    '.hdr-id,.hdr-pfp,.hdr-span,.image-count,.gl-status,#changelog-list .cl-entry,' +
    '#status-uptime,#status-requests,#status-latency,#status-memory,#status-images,' +
    '.fp-hint-popup-body,.about-more,#lang-toggle';
  var DICT_ONLY = '#auth-entry,#profile-username';

  function translateString(cur, dictOnly) {
    var t = cur.replace(/\s+/g, ' ').trim();
    if (!t) return null;
    var out = LOOKUP[t.toLowerCase()];
    if (out === undefined && !dictOnly) {
      for (var i = 0; i < PATTERNS.length; i++) {
        var m = PATTERNS[i][0].exec(t);
        if (m) { out = PATTERNS[i][1](m); break; }
      }
      if (out === undefined && t.length <= 600 && !/[a-z]/.test(t)) {
        NAME_RE.lastIndex = 0;
        if (NAME_RE.test(t)) { NAME_RE.lastIndex = 0; out = tn(t); }
      }
    }
    if (out === undefined || out === t) return null;
    var lead = cur.match(/^\s*/)[0], trail = cur.match(/\s*$/)[0];
    return lead + out + trail;
  }

  var textState = new WeakMap();
  var attrState = new WeakMap();
  var ATTRS = ['title', 'aria-label', 'placeholder', 'data-chip', 'data-tip', 'data-tip-on'];

  var UNSKIP = '.hdr-id .birthday';
  function skipped(el) {
    if (!el || !el.closest) return !el;
    if (el.closest('.hid-ch')) return true;
    if (el.closest(UNSKIP) && !el.closest('[data-i18n-skip]')) return false;
    return !!el.closest(SKIP);
  }

  function skippedAttr(el) {
    if (el && el.id === 'lbTweetHandle' && !el.closest('[data-i18n-skip]')) return false;
    return skipped(el);
  }
  function dictOnlyEl(el) { return !!(el && el.closest && el.closest(DICT_ONLY)); }

  var XHTML = 'http://www.w3.org/1999/xhtml';
  var NO_WRAP = /^(OPTION|OPTGROUP|TITLE|SELECT)$/;

  function isWrap(el) { return !!(el && el.classList && el.classList.contains('i18n-ko')); }


  function wrap(node, host) {
    if (isWrap(node.parentNode) || NO_WRAP.test(host.nodeName) || host.namespaceURI !== XHTML) return;
    var s = document.createElement('span');
    s.className = 'i18n-ko';
    if (!(host.closest && host.closest('.hdr-id'))) s.setAttribute('lang', 'ko');
    node.parentNode.insertBefore(s, node);
    s.appendChild(node);
  }
  function unwrap(node) {
    var s = node.parentNode;
    if (!isWrap(s) || !s.parentNode) return;
    s.parentNode.insertBefore(node, s);
    s.parentNode.removeChild(s);
  }

  function tText(node) {
    var cur = node.nodeValue;
    var st = textState.get(node);
    if (st && cur === st.ko) return;              
    var el = node.parentElement;
    var host = isWrap(el) ? el.parentElement : el;  
    if (!host || SKIP_TAG.test(host.nodeName) || skipped(host)) { if (st) { textState.delete(node); unwrap(node); } return; }
    var ko = translateString(cur, dictOnlyEl(host));
    if (ko === null) { if (st) { textState.delete(node); unwrap(node); } return; }
    textState.set(node, { en: cur, ko: ko });
    node.nodeValue = ko;
    host.setAttribute('data-ko', '');            
    wrap(node, host);
  }

  function tAttr(el, name) {
    var cur = el.getAttribute(name);
    if (cur == null) return;
    var m = attrState.get(el), st = m && m[name];
    if (st && cur === st.ko) return;
    if (el.id === 'fp-clip-input' || skippedAttr(el) || ATTR_SKIP_TAG.test(el.nodeName)) { if (st) delete m[name]; return; }
    var ko = translateString(cur, dictOnlyEl(el));
    if (ko === null) { if (st) delete m[name]; return; }
    if (!m) { m = {}; attrState.set(el, m); }
    m[name] = { en: cur, ko: ko };
    el.setAttribute(name, ko);
  }

  function tAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) if (el.hasAttribute(ATTRS[i])) tAttr(el, ATTRS[i]);
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { tText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) tAttrs(root);
    var tw = document.createTreeWalker(root, 1 | 4, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) tText(n); else tAttrs(n);
    }
  }

  function revertAll() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ko]'), function (e) { e.removeAttribute('data-ko'); });
    Array.prototype.forEach.call(document.querySelectorAll('.i18n-ko'), function (s) {  
      var p = s.parentNode;
      if (!p) return;
      while (s.firstChild) p.insertBefore(s.firstChild, s);
      p.removeChild(s);
    });
    var tw = document.createTreeWalker(document.documentElement, 1 | 4, null);
    var n;
    while ((n = tw.nextNode())) {
      if (n.nodeType === 3) {
        var st = textState.get(n);
        if (st) { if (n.nodeValue === st.ko) n.nodeValue = st.en; textState.delete(n); }
      } else {
        var m = attrState.get(n);
        if (m) {
          Object.keys(m).forEach(function (a) {
            if (n.getAttribute(a) === m[a].ko) n.setAttribute(a, m[a].en);
          });
          attrState.delete(n);
        }
      }
    }
  }

  var mo = null;
  function onMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.type === 'childList') {
        for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]);
      } else if (r.type === 'characterData') {
        tText(r.target);
      } else if (r.type === 'attributes') {
        tAttr(r.target, r.attributeName);
      }
    }
    mo.takeRecords(); 
  }
  function startObserver() {
    if (!mo) mo = new MutationObserver(onMutations);
    mo.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }
  function stopObserver() { if (mo) { mo.disconnect(); mo.takeRecords(); } }

  var CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  var JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  var JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
    'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

  /* syllables -> jamo ("현주" -> "ㅎㅕㄴㅈㅜ"). Searching on this form matches half-typed IME input like "현ㅈ". */
  function jamo(s) {
    s = String(s == null ? '' : s);
    if (s.normalize) s = s.normalize('NFC');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      if (c >= 0 && c < 11172) out += CHO.charAt((c / 588) | 0) + JUNG.charAt(((c % 588) / 28) | 0) + JONG[c % 28];
      else out += s.charAt(i);
    }
    return out;
  }
  /* initial consonants only ("나나" -> "ㄴㄴ") for typing 'ㄴㄴ' */
  function choseong(s) {
    s = String(s == null ? '' : s);
    if (s.normalize) s = s.normalize('NFC');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i) - 0xAC00;
      out += (c >= 0 && c < 11172) ? CHO.charAt((c / 588) | 0) : s.charAt(i);
    }
    return out;
  }

  function koName(en) { return NAMES[String(en).trim().toUpperCase()] || ''; }

  function tr(str) {
    str = String(str == null ? '' : str);
    if (lang !== 'ko') return str;
    var out = translateString(str, false);
    return out === null ? str : out.trim();
  }

  function original(el) {
    var s = '';
    var tw = document.createTreeWalker(el, 4, null);
    var n;
    while ((n = tw.nextNode())) { var st = textState.get(n); s += st ? st.en : n.nodeValue; }
    return s.trim();
  }

  var root = document.documentElement;
  var lang = 'en';
  try { lang = localStorage.getItem(STORE_KEY) === 'ko' ? 'ko' : 'en'; } catch (e) {}

  /* Styling for Korean mode. It only touches elements that were actually translated (they get a data-ko
     attribute), so English text that is left alone looks exactly the same as in English mode.
     Do NOT declare @font-face under the names "DM Sans" / "DM Mono" here: Chrome then picks that
     Hangul-only face for every character and English text falls back to a different system font. */
  (function injectStyle() {
    var st = document.createElement('style');
    var spaced = ['.sb-label', '.hdr-label', '.fp-label', '.lb-panel-label', '.lb-row-label', '.tcw-title',
      '.auth-title', '.accent-panel-title', '.accent-label', '.accent-btn', '.topbar-auth', '.topbar-donate-text', '.auth-btn',
      '.report-btn', '.report-modal-title', '.go-btn', '.stat-label', '.show-more-btn', '.feedback-btn',
      '.about-section-content h3', '.recent-wrapper h2', '.update-history h3', '.volume-tree h3',
      '#changelog-wrapper h3', '.stat-panel h2', '.stat-panel h3', '.ft_index h3', '#svg-container h3'];
    st.textContent =
      '.i18n-ko{font-family:' + KO_FONT + ';font-size:' + KO_SCALE + 'em;line-height:1;word-break:keep-all}' +
      /* header birthday: the intro / glitch effect draws it in the page font at the normal size, so the translated text
         must inherit everything from its parent (no Korean font / KO_SCALE / line-height), or it swaps when the effect ends */
      '.hdr-id .i18n-ko{font:inherit;word-break:inherit}' +
      spaced.map(function (s) { return 'html.lang-ko ' + s + '[data-ko]'; }).join(',') + '{letter-spacing:.04em}';
    (document.head || root).appendChild(st);
  })();

  var koFontLoaded = false;
  function loadKoFont() {
    if (koFontLoaded || !KO_FONT_URL) return;
    koFontLoaded = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = KO_FONT_URL;
    (document.head || root).appendChild(l);
  }

  function noTranslate(on) {
    var m = document.getElementById('i18n-notranslate');
    if (on) {
      root.setAttribute('translate', 'no');
      if (!m) {
        m = document.createElement('meta');
        m.id = 'i18n-notranslate'; m.name = 'google'; m.content = 'notranslate';
        (document.head || root).appendChild(m);
      }
    } else {
      root.removeAttribute('translate');
      if (m) m.remove();
    }
  }

  function apply(next, persist) {
    lang = next === 'ko' ? 'ko' : 'en';
    if (persist) { try { localStorage.setItem(STORE_KEY, lang); } catch (e) {} }
    root.classList.toggle('lang-ko', lang === 'ko');
    noTranslate(lang === 'ko');
    if (lang === 'ko') {
      loadKoFont();
      walk(document.documentElement);
      startObserver();
    } else {
      stopObserver();
      revertAll();
    }
    document.dispatchEvent(new CustomEvent('lang-change', { detail: lang }));
  }

  root.classList.toggle('lang-ko', lang === 'ko');
  if (lang === 'ko') { noTranslate(true); loadKoFont(); startObserver(); }

  window.I18n = {
    get lang() { return lang; },
    set: function (l) { if (l !== lang) apply(l, true); },
    toggle: function () { apply(lang === 'ko' ? 'en' : 'ko', true); return lang; },
    ko: koName,
    tr: tr,
    original: original,
    jamo: jamo,
    choseong: choseong,
    groups: GROUPS,
    members: MEMBERS
  };
})();
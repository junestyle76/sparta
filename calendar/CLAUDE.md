# Web_Calander

이 폴더는 한국 공휴일을 포함한 캘린더를 브라우저에서 바로 볼 수 있는 단일 HTML 뷰(`index.html`)입니다.

## 구성

- `calendar.html` — 외부 의존성 없이 동작하는 단일 파일. HTML/CSS/JS가 모두 한 파일에 들어있고, 2015~2036년 한국 공휴일 데이터(대체공휴일 포함)가 JS 객체(`HOLIDAYS_RAW`)로 하드코딩되어 있습니다.
- 공휴일 원본 데이터 출처: [Nager.Date Public Holiday API](https://date.nager.at/api/v3/PublicHolidays/{year}/KR) (`https://date.nager.at`).
- 제헌절(7/17)은 소스 데이터의 `type` 값과 무관하게 항상 "공휴일 아님(기념일)"로 강제 처리합니다 (실제로 쉬는 날이 아니기 때문).

## 기능

- 1 / 3 / 6 / 9 / 12개월 보기 전환 버튼
- 이전/다음 이동, "오늘" 버튼
- 연도·월 직접 입력 후 "이동" 버튼으로 바로 점프
- 일요일·공휴일은 빨간색, 토요일은 파란색으로 표시, 오늘 날짜는 원형 테두리로 강조
- 하단에 현재 보고 있는 기간의 공휴일 목록을 별도로 나열

## 데이터 갱신이 필요할 때

연도 범위를 늘리거나 공휴일 데이터를 갱신해야 하면:

1. `https://date.nager.at/api/v3/PublicHolidays/{year}/KR` 를 원하는 연도만큼 호출해서 JSON을 받습니다.
2. 각 항목을 `{"date":"YYYY-MM-DD","name":"...","type":"Public"|"Observance"}` 형태로 정리합니다.
3. `calendar.html` 안의 `const HOLIDAYS_RAW = {...}` 리터럴을 통째로 교체합니다.
4. 제헌절처럼 공휴일이 아닌 기념일은 JS 쪽 `isHoliday` 판정 로직(`item.name === '제헌절' ? false : ...`)에서 계속 예외 처리되는지 확인하세요.

이 프로젝트에는 빌드 단계, 패키지 매니저, 테스트가 없습니다 — 변경 후에는 브라우저로 `calendar.html`을 직접 열어 1/3/6/9/12개월 뷰와 이동 기능을 눈으로 확인하세요.

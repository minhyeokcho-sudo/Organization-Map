# Organization-Map

조직도(Org Chart) 편집기 — 순수 HTML/CSS/JS로 만든 정적 웹 앱입니다.
**빌드나 서버 없이** `index.html`을 브라우저로 열기만 하면 동작합니다.

## 로컬에서 실행하기

1. 저장소를 클론합니다.
   ```bash
   git clone https://github.com/minhyeokcho-sudo/Organization-Map.git
   cd Organization-Map
   ```
2. `index.html`을 엽니다 (아래 중 하나).
   - 파일 더블클릭 또는 브라우저 창에 드래그
   - macOS: `open index.html` / Windows: `start index.html` / Linux: `xdg-open index.html`
   - 또는 로컬 서버: `python3 -m http.server 8000` 후 `http://localhost:8000` 접속

## 주요 기능

- 계층형 조직도 시각화, 구성원 추가 / 편집 / 삭제
- 드래그 앤 드롭으로 소속 이동, 검색, 확대·축소, 접기·펼치기
- **자동 저장(localStorage)** — 데이터는 접속한 브라우저에만 저장됩니다
- **JSON 내보내기 / 가져오기**로 데이터 공유, 인쇄 / PDF 저장

## 데이터 공유 방식

조직도 데이터는 접속한 **브라우저에만** 저장됩니다(서버에 올라가지 않음).
다른 사람과 공유하려면 상단 **「데이터 ▾ → JSON 내보내기」** 로 파일을 저장해
전달하고, 받는 사람은 **「JSON 가져오기」** 로 불러오면 됩니다.

## 접근 제한 (비공개 운영)

이 저장소는 **비공개(private)** 로 운영하며, 초대된 collaborator만 접근할 수 있습니다.
공개 URL(GitHub Pages)은 사용하지 않습니다. 인원 관리는 GitHub 저장소
**Settings → Collaborators** 에서 진행합니다.

> 참고: Pretendard 폰트는 CDN에서 불러옵니다. 오프라인 환경에서는 시스템
> 기본 폰트로 자동 대체되며 기능에는 영향이 없습니다.

# 스킬: 랜딩 페이지 제너레이터 (Landing Page Generator)

> Manus Skills 영상에서 소개된 핵심 스킬 #3를 Offis 에이전트 시스템으로 구현

## 스킬 개요
제품/서비스 주제만 입력하면 완성형 HTML 랜딩 페이지를 즉시 생성.
디자인, 카피, 구조까지 모두 자동 생성된 단일 .html 파일로 즉시 배포 가능.

## 입력
```yaml
input:
  topic: "제품/서비스명"
  theme: "dark|light|gradient"      # 기본값: dark
  sections:                          # 기본값: 아래 5개
    - hero
    - features
    - how-it-works
    - testimonials
    - cta
  color_accent: "#00ff88"            # 선택
```

## 처리 파이프라인
```
[분석가] 핵심 가치 제안 (Value Proposition) 정의
  - 헤드라인 3가지 후보
  - 서브헤드 카피
  - 기능 포인트 5개
    ↓
[작성자] 섹션별 카피 작성
  - 히어로 헤드라인 / 서브카피 / CTA 텍스트
  - 기능 설명 (아이콘 + 제목 + 설명)
  - How It Works (3단계)
    ↓
[운영자] HTML 파일 생성
  - 반응형 CSS (모바일 대응)
  - 인터랙션 애니메이션
  - 단일 .html 파일로 패키징
```

## 출력
```
output/
└── landing-[topic]-[date].html    # 즉시 배포 가능한 단일 HTML 파일
```

## Offis CLI 호출
```
/skill landing --topic "Offis AI 에이전트 플랫폼" --theme dark
```

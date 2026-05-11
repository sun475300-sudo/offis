# 스킬: 프로포잘 제너레이터 (Proposal Generator)

> Manus Skills 영상에서 소개된 핵심 스킬 #2를 Offis 에이전트 시스템으로 구현

## 스킬 개요
제품/서비스 주제를 입력받아 완성형 사업 제안서를 자동 생성하는 통합 워크플로.
시장 분석 → 경쟁사 비교 → 포지셔닝 → 콘텐츠 플랜 → KPI → 가격 정책까지 원스톱 생성.

## 입력
```yaml
input:
  topic: "제품/서비스명 또는 아이디어"
  target_audience: "목표 고객층"        # 선택
  budget_range: "예산 범위"             # 선택
  differentiator: "차별화 포인트"        # 선택
```

## 처리 파이프라인
```
[리서처] 시장 조사
  - 시장 규모 및 성장률
  - 주요 경쟁사 5개 조사
  - 고객 니즈 및 페인포인트
    ↓
[분석가] 전략 도출
  - SWOT 분석
  - 포지셔닝 맵
  - 차별화 전략 3가지
    ↓
[작성자] 제안서 작성
  - Executive Summary
  - 시장 현황
  - 솔루션 제안
  - 비즈니스 모델
  - KPI 프레임워크
  - 가격 정책
  - 실행 로드맵
    ↓
[비서] 제안서 패키징 및 검토
```

## 출력
```
output/
└── proposal-[topic]-[date].md    # 완성형 제안서 (8개 섹션)
```

## Offis CLI 호출
```
/skill proposal --topic "AI 픽셀 오피스 SaaS" --audience "스타트업 CTO"
```

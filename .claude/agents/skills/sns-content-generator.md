# 스킬: SNS 콘텐츠 제너레이터 (SNS Content Generator)

> Manus Skills 영상에서 소개된 핵심 스킬 #4를 Offis 에이전트 시스템으로 구현

## 스킬 개요
주제 또는 기존 콘텐츠를 입력받아 각 SNS 플랫폼에 최적화된 콘텐츠를 일괄 생성.
YouTube Shorts, 블로그, LinkedIn, 인스타그램, 트위터/X, 스레드까지 원스톱 생성.

## 입력
```yaml
input:
  source: "영상 URL | 블로그 URL | 주제 텍스트"
  platforms:                         # 기본값: 전체
    - shorts
    - blog
    - linkedin
    - instagram
    - twitter
  tone: "professional|casual|viral"  # 기본값: casual
```

## 처리 파이프라인
```
[분석가] 핵심 메시지 추출
  - 훅 포인트 식별 (가장 자극적인 1개 사실)
  - 핵심 주장 3가지
  - 타깃 독자 감정 포인트
    ↓
[작성자] 플랫폼별 콘텐츠 생성
  ├── Shorts 대본: 훅(3초) + 본론(50초) + CTA(7초)
  ├── 블로그: SEO 제목 + 본문 1,500자 + 메타 설명
  ├── LinkedIn: 전문 게시물 + 해시태그
  ├── Instagram: 캡션 + 이모지 + 해시태그 30개
  └── Twitter/X: 스레드 5개 트윗
    ↓
[운영자] 콘텐츠 패키징 및 SEO 태그 생성
```

## 출력
```
output/
├── shorts-script.md
├── blog-post.md
├── linkedin-post.md
├── instagram-caption.md
├── twitter-thread.md
└── seo-metadata.json
```

## Offis CLI 호출
```
/skill sns --source "https://youtu.be/kAwsc5oc2Og" --tone viral
```

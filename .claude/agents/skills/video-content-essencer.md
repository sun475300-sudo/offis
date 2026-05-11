# 스킬: 비디오 콘텐츠 에센서 (Video Content Essencer)

> Manus Skills 영상에서 소개된 핵심 스킬 #1을 Offis 에이전트 시스템으로 구현

## 스킬 개요
YouTube 영상 URL 또는 자막 텍스트를 입력받아 5가지 콘텐츠 에셋을 자동 생성하는 통합 워크플로.

## 입력
```yaml
input:
  video_url: "https://youtu.be/..."   # 선택 (URL 또는 transcript 중 하나)
  transcript: "자막 텍스트..."         # 선택
  topic_hint: "주제 힌트"              # 선택
```

## 처리 파이프라인
```
[운영자] yt-dlp로 자막 추출
    ↓
[분석가] 핵심 인사이트 3-5개 추출
    ↓
[작성자] 5개 콘텐츠 동시 생성:
  1. YouTube Shorts 대본 (60초)
  2. 블로그 포스트 (1,500자)
  3. LinkedIn 게시물
  4. SNS 캡션 모음
  5. SEO 태그 세트
    ↓
[비서] 결과 패키징 및 보고
```

## 출력
```
output/
├── shorts-script.md      # YouTube Shorts 60초 대본
├── blog-post.md          # SEO 최적화 블로그
├── linkedin-post.md      # LinkedIn 전문가 게시물
├── sns-captions.md       # 인스타/트위터/스레드용
└── seo-tags.json         # 키워드 및 메타데이터
```

## Offis CLI 호출
```
/skill video-essencer --url "https://youtu.be/kAwsc5oc2Og"
```

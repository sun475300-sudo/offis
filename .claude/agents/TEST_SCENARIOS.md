# 에이전트 검증 시나리오

> 각 에이전트가 올바르게 동작하는지 확인하기 위한 5개 통합 테스트 케이스

---

## 시나리오 1: 비서 — 태스크 분해 정확도 검증

**입력**
```
사용자: "Offis v2.0 출시를 위한 모든 준비를 해줘"
```

**기대 동작**
- 비서가 최소 4개 서브태스크로 분해
- 각 서브태스크에 적합한 에이전트 배정
- 의존성 순서 올바르게 설정 (리서처 → 분석가 → 작성자 순)

**합격 기준**
- [ ] 서브태스크 수 ≥ 4
- [ ] 각 태스크에 담당 에이전트 명시
- [ ] 병렬 가능한 태스크 병렬로 처리
- [ ] 최종 보고서 생성됨

**검증 명령**
```bash
# Offis CLI
echo '비서 시나리오 1 테스트: Offis v2.0 출시 준비' | node dist/main.js
```

---

## 시나리오 2: 리서처 — 시장 조사 품질 검증

**입력**
```
리서처에게: "픽셀 오피스 시뮬레이션 게임 시장 조사 (경쟁사 3개 이상)"
```

**기대 동작**
- WebSearch로 최소 3개 소스 조회
- 시장 규모, 경쟁사, 트렌드 섹션 포함
- 출처 URL 목록 첨부

**합격 기준**
- [ ] research-*.md 파일 생성됨
- [ ] 경쟁사 ≥ 3개 열거
- [ ] 출처 링크 ≥ 2개
- [ ] 한국어로 작성됨

---

## 시나리오 3: 분석가 — 인사이트 추출 정확도 검증

**입력**
```
분석가에게: 아래 TaskService 데이터 분석해줘
{
  total: 20, completed: 14, failed: 3,
  pending: 2, inProgress: 1
}
```

**기대 동작**
- 완료율 계산 (14/20 = 70%)
- 실패율 분석 (3/20 = 15%)
- 개선 권고사항 ≥ 2개

**합격 기준**
- [ ] 수치 계산 정확 (70% 완료율)
- [ ] 실패 패턴 언급
- [ ] 실행 가능한 권고사항 포함
- [ ] 표 또는 차트 구조로 출력

---

## 시나리오 4: 작성자 — 랜딩 페이지 생성 검증

**입력**
```
/skill landing --topic "Offis AI 에이전트 플랫폼" --theme dark
```

**기대 동작**
- 단일 .html 파일 생성
- 히어로 섹션, 기능 섹션, CTA 포함
- 모바일 반응형 CSS 포함

**합격 기준**
- [ ] landing-*.html 파일 생성됨
- [ ] HTML 파일 단독 브라우저 실행 가능
- [ ] `<meta name="viewport">` 태그 존재
- [ ] CTA 버튼 1개 이상
- [ ] 파일 크기 > 5KB (빈 껍데기 아님)

**검증 명령**
```bash
ls -lh output/landing-*.html
grep -c '<section' output/landing-*.html  # 섹션 수 확인 (≥3이면 합격)
```

---

## 시나리오 5: 운영자 — 스킬 패키징 + 전체 파이프라인 통합 검증

**입력**
```
운영자에게: "video-content-essencer 스킬을 실제로 한 번 실행하고 결과를 검증해줘"
URL: https://youtu.be/kAwsc5oc2Og (자막 텍스트 직접 제공)
```

**기대 동작**
1. 운영자가 yt-dlp 또는 제공된 자막으로 텍스트 추출
2. 분석가 → 핵심 인사이트 3개 추출
3. 작성자 → 5개 콘텐츠 파일 생성
4. 모든 output 파일 생성 확인

**합격 기준**
- [ ] shorts-script.md 생성 (≥ 200자)
- [ ] blog-post.md 생성 (≥ 1,500자)
- [ ] linkedin-post.md 생성
- [ ] sns-captions.md 생성
- [ ] seo-tags.json 생성 및 유효한 JSON

**검증 명령**
```bash
for f in shorts-script blog-post linkedin-post sns-captions; do
  wc -c output/${f}.md
done
python3 -m json.tool output/seo-tags.json > /dev/null && echo "JSON valid"
```

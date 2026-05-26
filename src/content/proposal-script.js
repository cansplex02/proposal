document.documentElement.classList.add('js-anim');

document.documentElement.classList.add('js-anim');

// ===== AI 검색결과 — 영상처럼 재생되는 시퀀스 =====
  (function() {
    var caseBlocks = document.querySelectorAll('.case-block');
    if (!caseBlocks.length) return;

    caseBlocks.forEach(function(block) {
      // 1) 초기 상태 클래스: 모든 요소 숨김
      block.classList.add('anim-ready');

      // 2) 각 mock-chat에 "생각 중..." 인디케이터 주입 + 인트로 타이핑 마스크 처리
      block.querySelectorAll('.mock-chat').forEach(function(chat) {
        var aiBlock = chat.querySelector('.mock-msg-ai');
        if (aiBlock && !aiBlock.previousElementSibling.classList.contains('mock-thinking')) {
          var thinking = document.createElement('div');
          thinking.className = 'mock-thinking';
          thinking.innerHTML = '생각 중<span class="dots"><i></i><i></i><i></i></span>';
          aiBlock.parentNode.insertBefore(thinking, aiBlock);
        }

        // 인트로 문장을 .typing 으로 감싸고 깜빡이 커서 추가
        var intro = chat.querySelector('.mock-msg-ai-intro');
        if (intro && !intro.querySelector('.typing')) {
          var text = intro.textContent.trim();
          intro.innerHTML = '<span class="typing">' + text + '</span><span class="typing-cursor"></span>';
        }
      });

      // 3) highlight 카드의 인덱스에 따라 등장 딜레이 변수 세팅
      block.querySelectorAll('.mock-rec-list').forEach(function(list) {
        var items = list.querySelectorAll('.mock-rec-item');
        items.forEach(function(item, idx) {
          if (item.classList.contains('highlight')) {
            // idx 0 → 4.55s, 1 → 4.95s, 2 → 5.35s 와 동일하게 맞춤
            var delay = 4.55 + idx * 0.4;
            item.style.setProperty('--hl-delay', delay + 's');
          }
        });
      });
    });

    // 4) IntersectionObserver — 화면에 들어오면 재생, 나가면 리셋
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var el = entry.target;
          if (entry.isIntersecting) {
            // 이미 재생중이면 무시
            if (el.classList.contains('is-playing')) return;
            // 강제 reflow 후 클래스 추가 → 재진입 시 애니메이션 재시작
            el.classList.remove('is-playing');
            // 5개 AI 로고 체크 상태 초기화
            el.querySelectorAll('.mock-ai-logo').forEach(function(lg) { lg.classList.remove('checked'); });
            void el.offsetWidth;
            el.classList.add('is-playing');

            // 5개 AI 로고 — 답변 등장(약 4.55s) 직전~중에 순차로 체크 표시
            var logos = el.querySelectorAll('.mock-ai-logo');
            logos.forEach(function(lg, i) {
              setTimeout(function() {
                if (el.classList.contains('is-playing')) lg.classList.add('checked');
              }, 3000 + i * 220);
            });
          } else {
            el.classList.remove('is-playing');
            el.querySelectorAll('.mock-ai-logo').forEach(function(lg) { lg.classList.remove('checked'); });
          }
        });
      }, { threshold: 0.25 });

      caseBlocks.forEach(function(block) { io.observe(block); });
    } else {
      // Fallback: 그냥 재생
      caseBlocks.forEach(function(block) { block.classList.add('is-playing'); });
    }
  })();

  // ===== 트래픽 차트 — 화면 진입 시 그리기 애니메이션 =====
  (function() {
    var cards = document.querySelectorAll('.traffic-card');
    if (!cards.length) return;
    if (!('IntersectionObserver' in window)) {
      cards.forEach(function(c) { c.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) entry.target.classList.add('in-view');
        else entry.target.classList.remove('in-view');
      });
    }, { threshold: 0.25 });
    cards.forEach(function(c) { io.observe(c); });
  })();

  // ===== 휠 1회 = 섹션 1단계 이동 =====
  (function() {
    // 모바일/태블릿/모션감소 사용자 제외
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var sections = Array.prototype.slice.call(
      document.querySelectorAll('section.hero, section.section, section.cta-section, section.method-step-section')
    );
    if (sections.length < 2) return;

    document.documentElement.classList.add('section-snap');

    var NAV_OFFSET = 72;           // fixed nav 보정
    var COOLDOWN   = 850;          // 한 번 이동 후 휠 잠금 시간 (smooth 스크롤 완료까지)
    var EDGE_TOL   = 6;            // 섹션 끝/시작 판정 허용오차(px)
    var WHEEL_MIN  = 8;            // 무시할 잔진동 임계값

    var isLocked = false;
    var lastTime = 0;

    function getSectionTops() {
      // 매번 새로 계산 (반응형/리사이즈 대비)
      return sections.map(function(s) {
        return Math.max(0, Math.round(s.getBoundingClientRect().top + window.pageYOffset - NAV_OFFSET));
      });
    }

    function currentIndex(tops) {
      var y = window.pageYOffset;
      var idx = 0;
      for (var i = 0; i < tops.length; i++) {
        if (y + 2 >= tops[i]) idx = i;
        else break;
      }
      return idx;
    }

    function scrollToIndex(i) {
      var tops = getSectionTops();
      i = Math.max(0, Math.min(tops.length - 1, i));
      isLocked = true;
      lastTime = Date.now();
      window.scrollTo({ top: tops[i], behavior: 'smooth' });
      setTimeout(function() { isLocked = false; }, COOLDOWN);
    }

    window.addEventListener('wheel', function(e) {
      // Ctrl+휠(확대) 무시
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaY) < WHEEL_MIN) return;
      if (isLocked) { e.preventDefault(); return; }

      var tops = getSectionTops();
      var idx  = currentIndex(tops);
      var sec  = sections[idx];
      var rect = sec.getBoundingClientRect();
      var viewportH = window.innerHeight;
      // 현재 섹션이 뷰포트보다 길면 "안에서 자유 스크롤" 허용
      var sectionH = rect.height;
      var atTop    = rect.top >= -EDGE_TOL;                       // 섹션 상단이 뷰포트 위쪽 근처
      var atBottom = (rect.bottom - viewportH) <= EDGE_TOL;        // 섹션 하단이 뷰포트 바닥 근처

      var goingDown = e.deltaY > 0;

      if (sectionH > viewportH + 4) {
        // 긴 섹션 — 안에서 스크롤할 여지가 있으면 native 스크롤 유지
        if (goingDown && !atBottom) return;        // 더 내릴 공간 있음
        if (!goingDown && !atTop) return;          // 더 올릴 공간 있음
      }

      // 짧은 섹션이거나 가장자리에 도달 → 다음/이전 섹션으로 점프
      e.preventDefault();
      scrollToIndex(idx + (goingDown ? 1 : -1));
    }, { passive: false });

    // 키보드 PageDown/PageUp/Space/Arrow 도 같은 방식으로
    window.addEventListener('keydown', function(e) {
      if (isLocked) return;
      var target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      var dir = 0;
      if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
      else if (e.key === 'ArrowDown' && e.altKey) dir = 1;
      else if (e.key === 'ArrowUp'   && e.altKey) dir = -1;
      else return;

      e.preventDefault();
      var tops = getSectionTops();
      scrollToIndex(currentIndex(tops) + dir);
    });
  })();
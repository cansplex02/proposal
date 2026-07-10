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

  // ===== 휠 1회 = 정지점 1단계 ([data-wheel-stop] · C안 히스테리시스) =====
  (function() {
    if (window.matchMedia('(max-width: 768px)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var NAV_OFFSET = 72;
    var HYST = 48;
    var WHEEL_GESTURE_MIN = 55;
    var WHEEL_NOISE = 4;
    var UNLOCK_MS = 420;
    var isLocked = false;
    var wheelAccum = 0;
    var stops = [];

    function getScrollAnchor(el) {
      var mode = (el.getAttribute('data-wheel-stop') || 'section').toLowerCase();
      if (mode === 'inner' || mode === 'point') return el;
      var section = el.closest('section');
      return section || el;
    }

    function getScrollTopForElement(el) {
      var anchor = getScrollAnchor(el);
      var rect = anchor.getBoundingClientRect();
      return Math.max(0, Math.round(rect.top + window.pageYOffset - NAV_OFFSET));
    }

    function collectStops() {
      var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-wheel-stop]'));
      var filtered = [];
      var lastTop = -99999;
      nodes.forEach(function(node) {
        var top = getScrollTopForElement(node);
        if (Math.abs(top - lastTop) > 40) {
          filtered.push(node);
          lastTop = top;
        }
      });
      return filtered;
    }

    function getStopTops(list) {
      return list.map(function(el) {
        return getScrollTopForElement(el);
      });
    }

    function nearestIndex(tops) {
      var anchor = window.pageYOffset + NAV_OFFSET + 8;
      var idx = 0;
      var best = Infinity;
      for (var i = 0; i < tops.length; i++) {
        var dist = Math.abs(anchor - tops[i]);
        if (dist < best) {
          best = dist;
          idx = i;
        }
      }
      return idx;
    }

    function zoneState(idx, tops, viewportH) {
      var zoneTop = tops[idx];
      var zoneEnd = idx < tops.length - 1 ? tops[idx + 1] : document.documentElement.scrollHeight;
      var zoneHeight = zoneEnd - zoneTop;
      var y = window.pageYOffset;

      if (zoneHeight <= viewportH + 8) {
        return { long: false, atTop: true, atBottom: true };
      }

      return {
        long: true,
        atTop: y <= zoneTop + HYST,
        atBottom: y + viewportH >= zoneEnd - HYST
      };
    }

    function scrollToIndex(i) {
      var tops = getStopTops(stops);
      i = Math.max(0, Math.min(tops.length - 1, i));
      var targetTop = tops[i];
      isLocked = true;
      wheelAccum = 0;
      window.scrollTo({ top: targetTop, behavior: 'auto' });

      window.setTimeout(function() {
        if (Math.abs(window.pageYOffset - targetTop) > 10) {
          window.scrollTo({ top: targetTop, behavior: 'auto' });
        }
        isLocked = false;
      }, UNLOCK_MS);
    }

    function onWheel(e) {
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaY) < WHEEL_NOISE) return;
      if (isLocked) {
        e.preventDefault();
        return;
      }

      wheelAccum += e.deltaY;
      if (Math.abs(wheelAccum) < WHEEL_GESTURE_MIN) return;

      var tops = getStopTops(stops);
      var idx = nearestIndex(tops);
      var viewportH = window.innerHeight;
      var goingDown = wheelAccum > 0;
      wheelAccum = 0;

      var zone = zoneState(idx, tops, viewportH);

      if (zone.long) {
        if (goingDown && !zone.atBottom) return;
        if (!goingDown && !zone.atTop) return;
      }

      e.preventDefault();
      scrollToIndex(idx + (goingDown ? 1 : -1));
    }

    function onKeydown(e) {
      if (isLocked) return;
      var target = e.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      var dir = 0;
      if (e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey)) dir = 1;
      else if (e.key === 'PageUp' || (e.key === ' ' && e.shiftKey)) dir = -1;
      else if (e.key === 'ArrowDown' && e.altKey) dir = 1;
      else if (e.key === 'ArrowUp' && e.altKey) dir = -1;
      else return;

      e.preventDefault();
      wheelAccum = 0;
      scrollToIndex(nearestIndex(getStopTops(stops)) + dir);
    }

    function onResize() {
      stops = collectStops();
      wheelAccum = 0;
    }

    function teardown() {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('resize', onResize);
    }

    stops = collectStops();
    if (stops.length < 2) return;

    if (window.__proposalScrollTeardown) {
      window.__proposalScrollTeardown();
    }
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeydown);
    window.addEventListener('resize', onResize);
    window.__proposalScrollTeardown = teardown;
  })();

// ===== 케이스 블록 클릭 → 실제 AI 대화 링크 열기 =====
  (function() {
    var blocks = document.querySelectorAll('.case-block[data-case-link]');
    blocks.forEach(function(block) {
      var url = block.getAttribute('data-case-link');
      if (!url) return;
      block.addEventListener('click', function() {
        window.open(url, '_blank', 'noopener,noreferrer');
      });
    });
  })();

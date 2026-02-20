// ========== DRAG-TO-SCROLL MODULE ==========
// Enables mouse drag horizontal scrolling on all scrollable table containers
// Does NOT interfere with touch scrolling, text selection, or click events

(function() {
    'use strict';

    var DRAG_THRESHOLD = 5;
    var FRICTION = 0.95;
    var MIN_VELOCITY = 0.5;
    var VELOCITY_SCALE = 15;

    var SCROLLABLE_SELECTOR = [
        '.kupci-table-wrapper',
        '.dashboard-monthly-wrapper',
        '.mjesecni-table-wrapper',
        '.worker-table-card > div',
        'div[style*="overflow-x"]'
    ].join(', ');

    var stateMap = new WeakMap();

    function getState(el) {
        if (!stateMap.has(el)) {
            stateMap.set(el, {
                isDown: false,
                startX: 0,
                scrollLeft: 0,
                hasMoved: false,
                velX: 0,
                momentumId: null,
                lastPageX: 0,
                lastTime: 0
            });
        }
        return stateMap.get(el);
    }

    function isScrollableHorizontally(el) {
        return el.scrollWidth > el.clientWidth + 1;
    }

    function hasPointerDevice() {
        return window.matchMedia('(hover: hover)').matches;
    }

    function onMouseDown(e) {
        if (e.button !== 0) return;

        var tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select'
            || tag === 'button' || tag === 'a') return;
        if (e.target.closest('a, button, input, textarea, select, [contenteditable]')) return;

        var el = this;
        if (!isScrollableHorizontally(el)) return;

        var state = getState(el);

        if (state.momentumId) {
            cancelAnimationFrame(state.momentumId);
            state.momentumId = null;
        }

        state.isDown = true;
        state.hasMoved = false;
        state.startX = e.pageX;
        state.scrollLeft = el.scrollLeft;
        state.lastPageX = e.pageX;
        state.lastTime = Date.now();
        state.velX = 0;
    }

    function onMouseMove(e) {
        var el = this;
        var state = getState(el);
        if (!state.isDown) return;

        var dx = e.pageX - state.startX;

        if (!state.hasMoved) {
            if (Math.abs(dx) < DRAG_THRESHOLD) return;
            state.hasMoved = true;
            el.classList.add('drag-scroll-active');
        }

        e.preventDefault();

        var now = Date.now();
        var dt = now - state.lastTime;
        if (dt > 0) {
            state.velX = (e.pageX - state.lastPageX) / dt;
        }
        state.lastPageX = e.pageX;
        state.lastTime = now;

        el.scrollLeft = state.scrollLeft - dx;
    }

    function onMouseUp(e) {
        var el = this;
        var state = getState(el);
        if (!state.isDown) return;

        state.isDown = false;
        el.classList.remove('drag-scroll-active');

        if (state.hasMoved) {
            el.addEventListener('click', function suppressClick(ev) {
                ev.stopPropagation();
                ev.preventDefault();
                el.removeEventListener('click', suppressClick, true);
            }, { capture: true, once: true });

            applyMomentum(el, state);
        }
    }

    function onMouseLeave(e) {
        onMouseUp.call(this, e);
    }

    function applyMomentum(el, state) {
        var vel = state.velX * VELOCITY_SCALE;

        function step() {
            if (Math.abs(vel) < MIN_VELOCITY) {
                state.momentumId = null;
                return;
            }
            el.scrollLeft -= vel;
            vel *= FRICTION;
            state.momentumId = requestAnimationFrame(step);
        }

        state.momentumId = requestAnimationFrame(step);
    }

    function attachDragScroll(el) {
        if (el.dataset.dragScroll === 'attached') return;
        el.dataset.dragScroll = 'attached';

        if (hasPointerDevice()) {
            el.classList.add('drag-scroll-enabled');
        }

        el.addEventListener('mousedown', onMouseDown);
        el.addEventListener('mousemove', onMouseMove);
        el.addEventListener('mouseup', onMouseUp);
        el.addEventListener('mouseleave', onMouseLeave);
    }

    function attachDragScrollToAll() {
        var containers = document.querySelectorAll(SCROLLABLE_SELECTOR);
        containers.forEach(attachDragScroll);
    }

    // Debounce helper (fallback if utils.js debounce not available)
    var _debounce = (typeof debounce === 'function') ? debounce : function(fn, wait) {
        var t;
        return function() {
            clearTimeout(t);
            t = setTimeout(fn, wait);
        };
    };

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachDragScrollToAll);
    } else {
        attachDragScrollToAll();
    }

    // Watch for dynamically added scrollable containers
    var appScreen = document.getElementById('app-screen');
    if (appScreen) {
        var debouncedAttach = _debounce(attachDragScrollToAll, 300);
        var observer = new MutationObserver(debouncedAttach);
        observer.observe(appScreen, { childList: true, subtree: true });
    }

    // Re-check on viewport/resize changes
    window.addEventListener('resize', _debounce(attachDragScrollToAll, 500));

    // Expose for manual re-initialization
    window.initDragScroll = attachDragScrollToAll;
})();

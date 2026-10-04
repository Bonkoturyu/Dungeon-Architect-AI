const EXPECTED_OFFSET_PX = 104;
const TOLERANCE_PX = 3;

// 実装のCSS値を期待値へ読み戻さず、desktopのレイアウト契約を検査する。
export async function readRoomEventLayout(page) {
  return page.evaluate(() => {
    const readElement = (selector) => {
      const element = document.querySelector(selector);
      if (!element) {
        return { rect: null, hidden: null, display: null, visibility: null, visible: false };
      }
      const bounds = element.getBoundingClientRect();
      const rect = Object.fromEntries(
        ['left', 'right', 'top', 'bottom', 'width', 'height'].map((key) => [key, bounds[key]]),
      );
      const style = getComputedStyle(element);
      let ancestorsVisible = true;
      for (let current = element; current; current = current.parentElement) {
        const currentStyle = getComputedStyle(current);
        if (current.hidden || currentStyle.display === 'none' ||
            currentStyle.visibility === 'hidden' || currentStyle.visibility === 'collapse' ||
            Number(currentStyle.opacity) === 0) {
          ancestorsVisible = false;
          break;
        }
      }
      return {
        rect,
        hidden: element.hidden === true,
        display: style.display,
        visibility: style.visibility,
        visible: ancestorsVisible && rect.width > 0 && rect.height > 0 &&
          Object.values(rect).every(Number.isFinite),
      };
    };
    const events = readElement('#roomEventBar');
    const viewport = readElement('.viewport-shell');
    const exits = readElement('#playExitBar');
    return {
      events,
      viewport,
      exits,
      eventCenterX: events.rect ? events.rect.left + events.rect.width / 2 : null,
      eventCenterY: events.rect ? events.rect.top + events.rect.height / 2 : null,
      viewportCenterX: viewport.rect ? viewport.rect.left + viewport.rect.width / 2 : null,
      viewportCenterY: viewport.rect ? viewport.rect.top + viewport.rect.height / 2 : null,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
    };
  });
}

function visibleRectangle(element) {
  const rect = element?.rect;
  return element?.visible === true && element.hidden === false &&
    element.visibility === 'visible' && typeof element.display === 'string' &&
    element.display.length > 0 && element.display !== 'none' &&
    rect != null && ['left', 'right', 'top', 'bottom', 'width', 'height']
      .every((key) => Number.isFinite(rect[key])) &&
    rect.width > 0 && rect.height > 0 && rect.right > rect.left && rect.bottom > rect.top;
}

export function evaluateRoomEventLayout(sample) {
  // 800px以下はruntimeが別配置を採るため、このdesktop契約では合格にしない。
  const desktop = Number.isFinite(sample?.windowWidth) && sample.windowWidth > 800;
  const eventsVisible = visibleRectangle(sample?.events);
  const viewportVisible = visibleRectangle(sample?.viewport);
  const exitsVisible = visibleRectangle(sample?.exits);
  const events = sample?.events?.rect;
  const viewport = sample?.viewport?.rect;
  const exits = sample?.exits?.rect;
  const centersAvailable = desktop && eventsVisible && viewportVisible;
  const actualOffsetPx = centersAvailable
    ? viewport.top + viewport.height / 2 - (events.top + events.height / 2)
    : null;
  const gapPx = desktop && eventsVisible && exitsVisible ? exits.top - events.bottom : null;
  const checks = {
    horizontalCentered: centersAvailable && Math.abs(
      events.left + events.width / 2 - (viewport.left + viewport.width / 2),
    ) <= TOLERANCE_PX,
    offsetAboveViewportCenter: centersAvailable &&
      Math.abs(actualOffsetPx - EXPECTED_OFFSET_PX) <= TOLERANCE_PX,
    insideViewport: centersAvailable && events.left >= viewport.left &&
      events.right <= viewport.right && events.top >= viewport.top && events.bottom <= viewport.bottom,
    // hiddenな出口のゼロ矩形を非重複の証拠にしない。同時表示の実矩形を要求する。
    clearOfExitPad: desktop && eventsVisible && exitsVisible && gapPx > 0,
  };
  return {
    expectedOffsetPx: EXPECTED_OFFSET_PX,
    actualOffsetPx,
    tolerancePx: TOLERANCE_PX,
    gapPx,
    checks,
    passed: Object.values(checks).every((value) => value === true),
  };
}

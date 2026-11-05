// Calendar for locally stored product opening dates. Values remain YYYY-MM-DD.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const two = value => String(value).padStart(2, '0');
const isoDate = date => `${String(date.getFullYear()).padStart(4, '0')}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
function localDate(year, month, day) {
  const date = new Date(0);
  date.setFullYear(year, month, day);
  date.setHours(12, 0, 0, 0);
  return date;
}
function parseDate(value) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!parts) return null;
  const date = localDate(+parts[1], +parts[2] - 1, +parts[3]);
  return isoDate(date) === value ? date : null;
}
function dateLabel(value) {
  const date = parseDate(value);
  return date ? `${date.getFullYear()}. ${two(date.getMonth() + 1)}. ${two(date.getDate())}` : '날짜 선택';
}

export function renderDatePicker(index, value, productName) {
  return `<div class="date-label date-picker-field"><span class="date-picker-label">개봉일</span><button type="button" class="date-picker-trigger" data-calendar-trigger="${index}" data-calendar-value="${escape(value || '')}" aria-label="${escape(productName)} 개봉일 ${escape(dateLabel(value))}" aria-haspopup="dialog" aria-controls="product-date-calendar" aria-expanded="false"><span>${escape(dateLabel(value))}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="15" rx="2.5"/><path d="M7.5 3.5v4m9-4v4M3.5 10h17"/></svg></button></div>`;
}

export function bindDatePickers(document, onChange) {
  const view = document.defaultView;
  const triggers = [...document.querySelectorAll('[data-calendar-trigger]')];
  if (!triggers.length) return () => {};
  let popup = null, trigger = null, activeDate = null, selectedValue = '', index = '';

  function position() {
    if (!popup || !trigger?.isConnected) return;
    const rect = trigger.getBoundingClientRect(), padding = 12;
    if (rect.bottom <= 0 || rect.top >= view.innerHeight || rect.right <= 0 || rect.left >= view.innerWidth) { close(); return; }
    const width = Math.min(304, view.innerWidth - padding * 2);
    popup.style.width = `${Math.max(width, 0)}px`;
    const popupHeight = popup.offsetHeight;
    const below = view.innerHeight - rect.bottom - padding;
    const above = rect.top - padding;
    const top = below < popupHeight && above > below ? rect.top - popupHeight - 8 : rect.bottom + 8;
    popup.style.left = `${Math.max(padding, Math.min(rect.left, view.innerWidth - width - padding))}px`;
    popup.style.top = `${Math.max(padding, Math.min(top, view.innerHeight - popupHeight - padding))}px`;
  }
  function close(restoreFocus = false) {
    const previous = trigger;
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    popup?.remove(); popup = null; trigger = null;
    if (restoreFocus && previous?.isConnected) previous.focus({ preventScroll: true });
  }
  function changeMonth(offset) {
    const day = activeDate.getDate();
    const target = localDate(activeDate.getFullYear(), activeDate.getMonth() + offset, 1);
    const end = localDate(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    activeDate = localDate(target.getFullYear(), target.getMonth(), Math.min(day, end));
  }
  function commit(value) {
    const currentIndex = index;
    close();
    onChange(currentIndex, value);
    document.querySelector(`[data-calendar-trigger="${currentIndex}"]`)?.focus({ preventScroll: true });
  }
  function draw(focusDay = false) {
    const year = activeDate.getFullYear(), month = activeDate.getMonth();
    const first = localDate(year, month, 1), start = first.getDay();
    const today = isoDate(new Date());
    const weekday = ['일', '월', '화', '수', '목', '금', '토'];
    const weeks = Math.ceil((start + localDate(year, month + 1, 0).getDate()) / 7);
    let cells = '';
    for (let week = 0; week < weeks; week++) {
      cells += '<tr>';
      for (let column = 0; column < 7; column++) {
        const day = localDate(year, month, week * 7 + column - start + 1);
        const value = isoDate(day), inMonth = day.getMonth() === month;
        const current = value === isoDate(activeDate), selected = value === selectedValue;
        cells += `<td role="gridcell" aria-selected="${selected}"><button type="button" class="calendar-day${inMonth ? '' : ' is-outside'}${selected ? ' is-selected' : ''}${value === today ? ' is-today' : ''}" data-calendar-day="${value}" tabindex="${current ? '0' : '-1'}" aria-label="${day.getFullYear()}년 ${day.getMonth() + 1}월 ${day.getDate()}일"${value === today ? ' aria-current="date"' : ''}>${day.getDate()}</button></td>`;
      }
      cells += '</tr>';
    }
    popup.innerHTML = `<div class="calendar-heading"><span class="calendar-kicker">OPENED ON</span><button type="button" class="calendar-close" aria-label="달력 닫기">×</button></div><div class="calendar-month"><button type="button" class="calendar-nav" data-calendar-shift="-1" aria-label="이전 달">‹</button><strong aria-live="polite">${year}년 ${month + 1}월</strong><button type="button" class="calendar-nav" data-calendar-shift="1" aria-label="다음 달">›</button></div><table class="calendar-grid" role="grid" aria-label="${year}년 ${month + 1}월"><thead><tr>${weekday.map(day => `<th scope="col">${day}</th>`).join('')}</tr></thead><tbody>${cells}</tbody></table><div class="calendar-actions"><button type="button" data-calendar-clear>지우기</button><button type="button" data-calendar-today>오늘</button></div>`;
    position();
    if (focusDay) {
      const day = popup.querySelector(`[data-calendar-day="${isoDate(activeDate)}"]`);
      day?.focus({ preventScroll: true });
      if (day) {
        const outer = popup.getBoundingClientRect(), inner = day.getBoundingClientRect();
        if (inner.bottom > outer.bottom - 10) popup.scrollTop += inner.bottom - outer.bottom + 10;
        if (inner.top < outer.top + 10) popup.scrollTop -= outer.top - inner.top + 10;
      }
    }
  }
  function open(button) {
    if (trigger === button) { close(true); return; }
    close();
    trigger = button; index = button.dataset.calendarTrigger; selectedValue = button.dataset.calendarValue || '';
    activeDate = parseDate(selectedValue) || localDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    popup = document.createElement('div'); popup.className = 'calendar-popover'; popup.id = 'product-date-calendar';
    popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', '개봉일 선택');
    trigger.setAttribute('aria-expanded', 'true');
    document.body.append(popup);
    popup.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.matches('.calendar-close')) close(true);
      else if (target.dataset.calendarShift) { changeMonth(+target.dataset.calendarShift); draw(true); }
      else if (target.dataset.calendarDay) commit(target.dataset.calendarDay);
      else if (target.hasAttribute('data-calendar-today')) commit(isoDate(new Date()));
      else if (target.hasAttribute('data-calendar-clear')) commit('');
    });
    popup.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (!event.target.matches('[data-calendar-day]')) return;
      let delta = 0;
      if (event.key === 'ArrowLeft') delta = -1;
      else if (event.key === 'ArrowRight') delta = 1;
      else if (event.key === 'ArrowUp') delta = -7;
      else if (event.key === 'ArrowDown') delta = 7;
      else if (event.key === 'Home') delta = -activeDate.getDay();
      else if (event.key === 'End') delta = 6 - activeDate.getDay();
      else if (event.key === 'PageUp' || event.key === 'PageDown') {
        event.preventDefault(); changeMonth((event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)); draw(true); return;
      } else return;
      event.preventDefault();
      activeDate = localDate(activeDate.getFullYear(), activeDate.getMonth(), activeDate.getDate() + delta);
      draw(true);
    });
    draw(true);
  }
  const listeners = triggers.map(button => {
    const listener = () => open(button);
    button.addEventListener('click', listener);
    return () => button.removeEventListener('click', listener);
  });
  const outside = event => { if (popup && !popup.contains(event.target) && !trigger?.contains(event.target)) close(); };
  document.addEventListener('pointerdown', outside);
  view.addEventListener('resize', position);
  view.addEventListener('scroll', position, true);
  return () => { close(); listeners.forEach(dispose => dispose()); document.removeEventListener('pointerdown', outside); view.removeEventListener('resize', position); view.removeEventListener('scroll', position, true); };
}

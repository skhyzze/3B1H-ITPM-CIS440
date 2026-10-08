(function () {
  const today = new Date();
  let displayedMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = null;
  let eventView = 'upcoming';

  const monthLabel = document.getElementById('calendar-month');
  const calendarDays = document.getElementById('calendar-days');
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  document.getElementById('copyright').textContent = `© ${today.getFullYear()} Applied AI Lab`;

  function sameDay(first, second) {
    return first && second &&
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate();
  }

  function updateEvents() {
    document.getElementById('event-title').textContent = selectedDate
      ? dateFormatter.format(selectedDate)
      : 'Select a date from the calendar';
    document.getElementById('event-text').textContent = selectedDate
      ? `No ${eventView} events are listed for this date.`
      : 'Select a date from the calendar to view events.';

    ['upcoming', 'past'].forEach(function (view) {
      const button = document.getElementById(`${view}-button`);
      button.classList.toggle('active', eventView === view);
      button.setAttribute('aria-pressed', String(eventView === view));
    });
  }

  function renderCalendar() {
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    monthLabel.textContent = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    }).format(displayedMonth);
    calendarDays.replaceChildren();

    const firstDay = new Date(year, month, 1).getDay();
    const numberOfDays = new Date(year, month + 1, 0).getDate();
    const rows = Math.ceil((firstDay + numberOfDays) / 7);

    for (let row = 0; row < rows; row += 1) {
      const tableRow = document.createElement('tr');
      for (let column = 0; column < 7; column += 1) {
        const cell = document.createElement('td');
        const day = row * 7 + column - firstDay + 1;

        if (day >= 1 && day <= numberOfDays) {
          const date = new Date(year, month, day);
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = String(day);
          button.setAttribute('aria-label', dateFormatter.format(date));

          if (sameDay(date, selectedDate)) {
            button.className = 'selected';
            button.setAttribute('aria-pressed', 'true');
          } else if (sameDay(date, today)) {
            button.className = 'today';
            button.setAttribute('aria-current', 'date');
          }

          button.addEventListener('click', function () {
            selectedDate = date;
            renderCalendar();
            updateEvents();
          });
          cell.append(button);
        }

        tableRow.append(cell);
      }
      calendarDays.append(tableRow);
    }
  }

  document.getElementById('previous-month').addEventListener('click', function () {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  document.getElementById('next-month').addEventListener('click', function () {
    displayedMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  ['upcoming', 'past'].forEach(function (view) {
    document.getElementById(`${view}-button`).addEventListener('click', function () {
      eventView = view;
      updateEvents();
    });
  });

  renderCalendar();
})();

'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './dateRangePickerOld.module.css';

export default () => {

  const [hasSelectedValue, hasSelectedValueSetter] = useState(false);
  const [showPanel, showPanelSetter] = useState(false);
  const [monthText, monthTextSetter] = useState('January');
  const [yearText, yearTextSetter] = useState('2025');
  const [currentDate, currentDateSetter] = useState(new Date());
  const [selectedStartDate, selectedStartDateSetter] = useState<number | null>(null);
  const [selectedEndDate, selectedEndDateSetter] = useState<number | null>(null);
  const [todaysDate, todaysDateSetter] = useState<number>(0);
  const [monthDays, monthDaysSetter] = useState<Array<Array<{ key: string; date: number; time: number; selectedClass: string; }>>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && event?.target && !containerRef.current.contains(event.target as any)) {
        showPanelSetter(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!showPanel) {
      const newCurrentDate = new Date();
      newCurrentDate.setHours(0, 0, 0, 0)
      currentDateSetter(newCurrentDate);
      monthTextSetter(newCurrentDate.toLocaleString('default', { month: 'long' }));
      yearTextSetter(newCurrentDate.toLocaleString('default', { year: 'numeric' }));
      todaysDateSetter(newCurrentDate.getTime());
    }
  }, [showPanel]);

  useEffect(() => {
    monthDaysSetter(generateNumOfWeeks());
  }, [selectedStartDate, selectedEndDate, currentDate]);

  const generateNumOfWeeks = () => {
    const daysInPreviousMonth = daysInMonth(constructDate(currentDate.getMonth(), currentDate.getFullYear(), 1));
    const daysInCurrentMonth = daysInMonth(constructDate(currentDate.getMonth() + 1, currentDate.getFullYear(), 1));
    const offset = firstDayOfMonth(constructDate(currentDate.getMonth(), currentDate.getFullYear(), 1)) - 1;

    const numberOfWeeks = Math.ceil((daysInCurrentMonth + (offset + 1)) / 7);
    let dayOfPreviousMonth = daysInPreviousMonth - offset - 1;
    let dayOfCurrentMonth = 0;
    let dayOfNextMonth = 0;

    const daysArray = Array(numberOfWeeks).fill(0).map((week, weekIndex) => (
      Array(7).fill(0).map((day, dayIndex) => {
        if (dayOfPreviousMonth < daysInPreviousMonth) {
          dayOfPreviousMonth += 1;
          const time = constructDate(currentDate.getMonth(), currentDate.getFullYear(), dayOfPreviousMonth).getTime();

          return {
            key: `date-${dayOfPreviousMonth}-for-week-${weekIndex}-${dayIndex}`,
            date: dayOfPreviousMonth,
            time,
            selectedClass: `${generateDayClassName(time)} ${styles['outside-current-month']}`
          };
        } else if (dayOfCurrentMonth < daysInCurrentMonth) {
          dayOfCurrentMonth += 1;
          const time = constructDate(currentDate.getMonth() + 1, currentDate.getFullYear(), dayOfCurrentMonth).getTime();

          return {
            key: `date-${dayOfCurrentMonth}-for-week-${weekIndex}-${dayIndex}`,
            date: dayOfCurrentMonth,
            time,
            selectedClass: generateDayClassName(time)
          };
        } else {
          dayOfNextMonth += 1;
          const time = constructDate(currentDate.getMonth() + 2, currentDate.getFullYear(), dayOfNextMonth).getTime();

          return {
            key: `date-${dayOfNextMonth}-for-week-${weekIndex}-${dayIndex}`,
            date: dayOfNextMonth,
            time,
            selectedClass: `${generateDayClassName(time)} ${styles['outside-current-month']}`
          };
        }
      })
    ));

    return daysArray;
  }

  const daysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 0).getDate();
  }

  const firstDayOfMonth = (date: Date) =>  {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  } 

  const constructDate = (month: number, year: number, day: number) => {
    const newDate = new Date();
    newDate.setMonth(month);
    newDate.setFullYear(year);
    newDate.setDate(day);
    newDate.setHours(0, 0, 0, 0);

    return newDate;
  }

  const generateDayClassName = (time: number) => {

    const classNames = [];

    if (time === selectedStartDate) {
      classNames.push(styles['selected-start-date']);
    } else if (time === selectedEndDate) {
      classNames.push(styles['selected-end-date']);
    } else if (selectedStartDate && selectedEndDate && (selectedStartDate <= time) && (time <= selectedEndDate)) {
      classNames.push(styles['date-between-start-end-date']);
    } else if (selectedStartDate && selectedStartDate <= time && !selectedEndDate) {
      classNames.push(styles['date-after-start-no-end-date']);
    }

    if (time === todaysDate) {
      classNames.push(styles['todays-date']);
    }

    return classNames.join(' ');
  }

  const handleDateRangePickerContainerClick = (e: any) => {
    e.stopPropagation();
  }

  const handleToggleActive = (e: any) => {
    e.stopPropagation();
    showPanelSetter(prev => !prev);
  }

  const handlePreviousMonthClick = (e: any) => {
    const newCurrentDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
    currentDateSetter(newCurrentDate);
    monthTextSetter(newCurrentDate.toLocaleString('default', { month: 'long' }));
    yearTextSetter(newCurrentDate.toLocaleString('default', { year: 'numeric' }));
  }

  const handleNextMonthClick = (e: any) => {
    const newCurrentDate = new Date(currentDate.setMonth(currentDate.getMonth() + 1))
    currentDateSetter(newCurrentDate);
    monthTextSetter(newCurrentDate.toLocaleString('default', { month: 'long' }));
    yearTextSetter(newCurrentDate.toLocaleString('default', { year: 'numeric' }));
  }

  const handleDateSelect = (event: any) => {
    event.stopPropagation();

    const time = event.currentTarget.dataset.time;

    if (!selectedStartDate) {
      selectedStartDateSetter(Number(time));
    } else if (!selectedEndDate && selectedStartDate < time) {
      selectedEndDateSetter(Number(time));
    } else {
      selectedStartDateSetter(Number(time));
      selectedEndDateSetter(null);
    }

    hasSelectedValueSetter(true);
  }

  const handleHover = (hoveredItemEvent: any) => {
    if (!selectedEndDate && selectedStartDate) {
      Array.from(hoveredItemEvent.target.parentElement.children)
        .forEach((siblingElement: any) => {
          if (hoveredItemEvent.target.dataset.time >= siblingElement.dataset.time && siblingElement.dataset.time >= selectedStartDate) {
            siblingElement.style.background = "var(--colors_BLUE_100)";
          } else {
            siblingElement.style.background = "";
          }
        });
    }
  }

  return (
    <div ref={containerRef} className={styles.dateRangePickerContainer} onClick={handleDateRangePickerContainerClick}>
      <button
        data-has-selected-value={hasSelectedValue}
        className={styles.dateRangeField}
        onClick={handleToggleActive}
      >
        {(hasSelectedValue && selectedStartDate && selectedEndDate) ? `${new Date(selectedStartDate).toLocaleDateString()} - ${new Date(selectedEndDate).toLocaleDateString()}` : 'Select a date range'}
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <g clipPath="url(#clip0_6043_368688)">
            <path d="M4.66661 6.41671H2.33327V8.16671H4.66661V6.41671Z" fill="var(--colors_GRAY_600)"/>
            <path d="M8.16661 6.41671H5.83327V8.16671H8.16661V6.41671Z" fill="var(--colors_GRAY_600)"/>
            <path d="M4.66661 9.33337H2.33327V11.0834H4.66661V9.33337Z" fill="var(--colors_GRAY_600)"/>
            <path d="M8.16661 9.33337H5.83327V11.0834H8.16661V9.33337Z" fill="var(--colors_GRAY_600)"/>
            <path d="M11.6666 6.41671H9.33327V8.16671H11.6666V6.41671Z" fill="var(--colors_GRAY_600)"/>
            <path d="M13.4166 2.33337H10.4999V1.16671C10.4999 1.012 10.4385 0.863625 10.3291 0.754228C10.2197 0.644832 10.0713 0.583374 9.91661 0.583374C9.7619 0.583374 9.61352 0.644832 9.50413 0.754228C9.39473 0.863625 9.33327 1.012 9.33327 1.16671V2.33337H4.66661V1.16671C4.66661 1.012 4.60515 0.863625 4.49575 0.754228C4.38636 0.644832 4.23798 0.583374 4.08327 0.583374C3.92856 0.583374 3.78019 0.644832 3.67079 0.754228C3.5614 0.863625 3.49994 1.012 3.49994 1.16671V2.33337H0.583272C0.428563 2.33337 0.28019 2.39483 0.170793 2.50423C0.0613971 2.61362 -6.10352e-05 2.762 -6.10352e-05 2.91671V13.4167C-6.10352e-05 13.5714 0.0613971 13.7198 0.170793 13.8292C0.28019 13.9386 0.428563 14 0.583272 14H13.4166C13.5713 14 13.7197 13.9386 13.8291 13.8292C13.9385 13.7198 13.9999 13.5714 13.9999 13.4167V2.91671C13.9999 2.762 13.9385 2.61362 13.8291 2.50423C13.7197 2.39483 13.5713 2.33337 13.4166 2.33337ZM12.8333 12.8334H1.16661V4.66671H12.8333V12.8334Z" fill="var(--colors_GRAY_600)"/>
          </g>
          <defs>
            <clipPath id="clip0_6043_368688">
              <rect width="14" height="14" fill="white"/>
            </clipPath>
          </defs>
        </svg>
      </button>
      {showPanel && (
        <div
          className={styles.datePickerDropdownPanel}
        >
          <div className={styles.monthRow}>
            <button onClick={handlePreviousMonthClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 12L13.9834 17.6724C14.4442 18.1092 15.2203 18.1092 15.6811 17.6724C16.106 17.2696 16.1063 16.64 15.682 16.2369L11.2225 12L15.682 7.76312C16.1063 7.35996 16.106 6.73038 15.6811 6.32764C15.2203 5.89079 14.4442 5.89079 13.9834 6.32764L8 12Z" fill="#404040"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M8 12L13.9834 17.6724C14.4442 18.1092 15.2203 18.1092 15.6811 17.6724C16.106 17.2696 16.1063 16.64 15.682 16.2369L11.2225 12L15.682 7.76312C16.1063 7.35996 16.106 6.73038 15.6811 6.32764C15.2203 5.89079 14.4442 5.89079 13.9834 6.32764L8 12Z" fill="#404040"/>
              </svg>
            </button>
            <span>
              {monthText} {yearText}
            </span>
            <button onClick={handleNextMonthClick}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16 12L10.0166 6.32764C9.55582 5.89079 8.77968 5.89079 8.31888 6.32764C7.89405 6.73038 7.89366 7.35996 8.318 7.76312L12.7775 12L8.318 16.2369C7.89366 16.64 7.89405 17.2696 8.31887 17.6724C8.77968 18.1092 9.55582 18.1092 10.0166 17.6724L16 12Z" fill="#404040"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M16 12L10.0166 6.32764C9.55582 5.89079 8.77968 5.89079 8.31888 6.32764C7.89405 6.73038 7.89366 7.35996 8.318 7.76312L12.7775 12L8.318 16.2369C7.89366 16.64 7.89405 17.2696 8.31887 17.6724C8.77968 18.1092 9.55582 18.1092 10.0166 17.6724L16 12Z" fill="#404040"/>
              </svg>
            </button>
          </div>
          <div className={styles.daysOfWeek}>
            <span>Su</span>
            <span>Mo</span>
            <span>Tu</span>
            <span>We</span>
            <span>Th</span>
            <span>Fr</span>
            <span>Sa</span>
          </div>
          <div
            className={styles.daysOfMonth}
          >
            {monthDays.map(week => week.map(day => (
              <button
                  key={day.key}
                  data-time={day.time}
                  onClick={handleDateSelect}
                  onMouseOver={handleHover}
                  className={day.selectedClass}
                >
                {day.date}
              </button>
            )))}
          </div>
        </div>
      )}
    </div>
  );
};
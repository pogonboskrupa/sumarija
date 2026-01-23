// ============================================
// 📅 WEEK DATE FIX - Ispravni datumi sedmica
// ============================================
// Osigurava da sedmica uvijek počinje sa ponedjeljkom i završava sa nedjeljom

/**
 * Get Monday of the week for a given date
 * @param {Date} date - Any date
 * @returns {Date} - Monday of that week
 */
function getMondayOfWeek(date) {
    const d = new Date(date.getTime());
    const day = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Calculate offset to Monday
    const offset = day === 0 ? -6 : 1 - day;
    
    d.setDate(d.getDate() + offset);
    d.setHours(0, 0, 0, 0);
    
    return d;
}

/**
 * Get Sunday of the week for a given date
 * @param {Date} date - Any date
 * @returns {Date} - Sunday of that week
 */
function getSundayOfWeek(date) {
    const monday = getMondayOfWeek(date);
    const sunday = new Date(monday.getTime());
    sunday.setDate(monday.getDate() + 6);
    return sunday;
}

/**
 * Get all weeks in a month (each week: Monday to Sunday)
 * @param {number} year
 * @param {number} month (0-11)
 * @returns {Array} - Array of week objects with weekStart, weekEnd
 */
function getWeeksInMonth(year, month) {
    const weeks = [];
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Start with Monday of the first week that includes any day of this month
    let currentMonday = getMondayOfWeek(firstDay);
    
    let weekNumber = 1;
    
    while (currentMonday <= lastDay) {
        const currentSunday = getSundayOfWeek(currentMonday);
        
        // Only include weeks that have at least one day in this month
        if (currentSunday >= firstDay && currentMonday <= lastDay) {
            weeks.push({
                weekNumber: weekNumber,
                weekStart: new Date(currentMonday),
                weekEnd: new Date(currentSunday)
            });
            weekNumber++;
        }
        
        // Move to next Monday
        currentMonday = new Date(currentMonday);
        currentMonday.setDate(currentMonday.getDate() + 7);
    }
    
    return weeks;
}

/**
 * Get week info for a specific date
 * @param {Date} date
 * @param {number} year
 * @param {number} month (0-11)
 * @returns {Object} - {weekNumber, weekStart, weekEnd}
 */
function getWeekWithinMonth(date, year, month) {
    const weeks = getWeeksInMonth(year, month);
    
    const d = new Date(date.getTime());
    d.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < weeks.length; i++) {
        const week = weeks[i];
        if (d >= week.weekStart && d <= week.weekEnd) {
            return {
                weekNumber: week.weekNumber,
                weekStart: formatDateDDMMYYYY(week.weekStart),
                weekEnd: formatDateDDMMYYYY(week.weekEnd)
            };
        }
    }
    
    // Fallback: first week
    if (weeks.length > 0) {
        return {
            weekNumber: 1,
            weekStart: formatDateDDMMYYYY(weeks[0].weekStart),
            weekEnd: formatDateDDMMYYYY(weeks[0].weekEnd)
        };
    }
    
    // Ultimate fallback
    return {
        weekNumber: 1,
        weekStart: formatDateDDMMYYYY(new Date(year, month, 1)),
        weekEnd: formatDateDDMMYYYY(new Date(year, month + 1, 0))
    };
}

// Format date helper
function formatDateDDMMYYYY(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return day + '/' + month + '/' + year;
}

console.log('[WEEK FIX] Week date calculation functions loaded');

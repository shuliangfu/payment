// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title DateTime
 * @dev DateTime utility library, provides date, week, month and other time-related calculation functions
 */
library DateTime {
  // Seconds per day
  uint256 private constant SECONDS_PER_DAY = 86400;
  // Seconds per week
  uint256 private constant SECONDS_PER_WEEK = 604800;

  /**
   * UTC+8 (Beijing time) offset relative to UTC: 8 hours = 28800 seconds; all year/month/week/day calculations in this library are based on UTC+8
   */
  uint256 private constant UTC8_OFFSET = 8 * 3600;

  /**
   * @dev Get current timestamp
   * @return Current block timestamp (seconds)
   */
  function getCurrentTimestamp() internal view returns (uint256) {
    return block.timestamp;
  }

  /**
   * @dev Get UTC timestamp (seconds) corresponding to UTC+8 "today" 0:00
   * @return UTC+8 today 0:00 block timestamp; may be 0 near epoch to avoid underflow
   */
  function getTodayZeroTimestamp() internal view returns (uint256) {
    return getTodayZeroTimestamp(block.timestamp);
  }

  /**
   * @dev Get UTC timestamp (seconds) corresponding to UTC+8 "the day containing this time" 0:00
   * @param timestamp Block timestamp (seconds, UTC)
   * @return UTC+8 that day 0:00 UTC timestamp; very early times return 0 to avoid underflow
   */
  function getTodayZeroTimestamp(uint256 timestamp) internal pure returns (uint256) {
    uint256 d = getDay(timestamp);
    uint256 dayStart = d * SECONDS_PER_DAY;
    if (dayStart >= UTC8_OFFSET) return dayStart - UTC8_OFFSET;
    return 0;
  }

  /**
   * @dev Get day number "since 1970-01-01" under UTC+8
   * @param timestamp Timestamp (seconds, UTC)
   * @return Day number under UTC+8 (0 = UTC+8 1970-01-01)
   */
  function getDay(uint256 timestamp) internal pure returns (uint256) {
    return (timestamp + UTC8_OFFSET) / SECONDS_PER_DAY;
  }

  /**
   * @dev Get current date (day number since January 1, 1970)
   * @return Day number since January 1, 1970
   */
  function getDay() internal view returns (uint256) {
    return getDay(block.timestamp);
  }

  /**
   * @dev Get current date (day number since January 1, 1970)
   * @return Day number since January 1, 1970
   */
  function getCurrentDay() internal view returns (uint256) {
    return getDay(block.timestamp);
  }

  /**
   * @dev Get "calendar week" index: UTC+8 Sunday 00:00 as week start, only UTC+8 Sunday enters next week
   * @param timestamp Timestamp (seconds, UTC)
   * @return Week number: week number since the week containing 1970-01-01 under UTC+8
   */
  function getWeek(uint256 timestamp) internal pure returns (uint256) {
    // UTC8_OFFSET: based on UTC+8; +4 days: Sunday of that week as start
    return (timestamp + UTC8_OFFSET + 4 * SECONDS_PER_DAY) / SECONDS_PER_WEEK;
  }

  /**
   * @dev Get current "calendar week" (only Sunday 00:00 enters next week)
   * @return Week number since the week containing 1970-01-01
   */
  function getWeek() internal view returns (uint256) {
    return getWeek(block.timestamp);
  }

  /**
   * @dev Get current week number (only Sunday 00:00 enters next week)
   * @return Week number since the week containing 1970-01-01
   */
  function getCurrentWeek() internal view returns (uint256) {
    return getWeek(block.timestamp);
  }

  /**
   * @dev Get "calendar month" index: natural month number since 1970-01 under UTC+8, only UTC+8 1st of each month 0:00 enters next month
   * @param timestamp Timestamp (seconds, UTC)
   * @return Calendar month = year*12 + (month-1)
   */
  function getMonth(uint256 timestamp) internal pure returns (uint256) {
    (uint256 year, uint256 month,) = getDateDetails(timestamp);
    return year * 12 + (month - 1);
  }

  /**
   * @dev Get current "calendar month" (only 1st of each month enters next month)
   * @return Natural month number since 1970-01
   */
  function getMonth() internal view returns (uint256) {
    return getMonth(block.timestamp);
  }

  /**
   * @dev Get current month (month number since January 1, 1970)
   * @return Month number since January 1, 1970
   */
  function getCurrentMonth() internal view returns (uint256) {
    return getMonth(block.timestamp);
  }

  /**
   * @dev Get "calendar year" index: year number since 1970 under UTC+8, only UTC+8 January 1st 0:00 enters next year
   * @param timestamp Timestamp (seconds, UTC)
   * @return Year: 0=1970, 1=1971, ..., consistent with getDateDetails, considers leap years
   */
  function getYear(uint256 timestamp) internal pure returns (uint256) {
    (uint256 year,,) = getDateDetails(timestamp);
    return year;
  }

  /**
   * @dev Get current "calendar year" (only January 1st enters next year)
   * @return Year number since 1970
   */
  function getYear() internal view returns (uint256) {
    return getYear(block.timestamp);
  }

  /**
   * @dev Get current year (only January 1st enters next year)
   * @return Year number since 1970
   */
  function getCurrentYear() internal view returns (uint256) {
    return getYear(block.timestamp);
  }

  /**
   * @dev Get number of days in specified month (non-leap year)
   * @param month Month (1-12)
   * @return Number of days in that month (non-leap year)
   */
  function _getDaysInMonthNonLeap(uint256 month) private pure returns (uint256) {
    if (month == 1 || month == 3 || month == 5 || month == 7 || month == 8 || month == 10 || month == 12) {
      return 31;
    } else if (month == 4 || month == 6 || month == 9 || month == 11) {
      return 30;
    } else {
      // month == 2
      return 28;
    }
  }

  /**
   * @dev Check if specified year is a leap year
   * @param year Year (starting from 1970)
   * @return Whether is a leap year
   */
  function isLeapYear(uint256 year) internal pure returns (bool) {
    uint256 actualYear = 1970 + year;
    // Leap year rule: divisible by 4 but not by 100, or divisible by 400
    if (actualYear % 400 == 0) {
      return true;
    }
    if (actualYear % 100 == 0) {
      return false;
    }
    return actualYear % 4 == 0;
  }

  /**
   * @dev Get number of days in specified year
   * @param year Year (starting from 1970)
   * @return Number of days in that year (365 or 366)
   */
  function getDaysInYear(uint256 year) internal pure returns (uint256) {
    return isLeapYear(year) ? 366 : 365;
  }

  /**
   * @dev Get number of days in specified month
   * @param year Year (starting from 1970)
   * @param month Month (1-12)
   * @return Number of days in that month
   */
  function getDaysInMonth(uint256 year, uint256 month) internal pure returns (uint256) {
    require(month >= 1 && month <= 12, "Invalid month");
    if (month == 2 && isLeapYear(year)) {
      return 29; // February has 29 days in leap year
    }
    return _getDaysInMonthNonLeap(month);
  }

  /**
   * @dev Get date (year, month, day) corresponding to this timestamp under UTC+8
   * @notice Precise calculation, considers actual days per month and leap years
   * @param timestamp Timestamp (seconds, UTC)
   * @return year Year (starting from 1970)
   * @return month Month (1-12)
   * @return day Date (1-31)
   */
  function getDateDetails(uint256 timestamp) internal pure returns (uint256 year, uint256 month, uint256 day) {
    // Day number since 1970-01-01 under UTC+8
    uint256 daysSinceEpoch = (timestamp + UTC8_OFFSET) / SECONDS_PER_DAY;

    // Calculate year
    year = 0;
    uint256 daysRemaining = daysSinceEpoch;
    while (daysRemaining >= getDaysInYear(year)) {
      daysRemaining -= getDaysInYear(year);
      year++;
    }

    // Calculate month
    month = 1;
    while (month <= 12 && daysRemaining >= getDaysInMonth(year, month)) {
      daysRemaining -= getDaysInMonth(year, month);
      month++;
    }
    if (month > 12) {
      month = 12;
    }

    // Calculate date (starting from 1)
    day = daysRemaining + 1;
    uint256 maxDays = getDaysInMonth(year, month);
    if (day > maxDays) {
      day = maxDays;
    }
  }

  /**
   * @dev Get detailed information of current date (year, month, day)
   * @return year Year (starting from 1970)
   * @return month Month (1-12)
   * @return day Date (1-31)
   */
  function getDateDetails() internal view returns (uint256 year, uint256 month, uint256 day) {
    return getDateDetails(block.timestamp);
  }

  /**
   * @dev Get detailed information of current date (year, month, day)
   * @return year Year (starting from 1970)
   * @return month Month (1-12)
   * @return day Date (1-31)
   */
  function getCurrentDateDetails() internal view returns (uint256 year, uint256 month, uint256 day) {
    return getDateDetails(block.timestamp);
  }

  /**
   * @dev Get day of week for this time under UTC+8 (0=Sunday, 1=Monday, ..., 6=Saturday)
   * @param timestamp Timestamp (seconds, UTC)
   * @return Day of week (0-6)
   */
  function getDayOfWeek(uint256 timestamp) internal pure returns (uint256) {
    uint256 daysSinceEpoch = (timestamp + UTC8_OFFSET) / SECONDS_PER_DAY;
    return (daysSinceEpoch + 4) % 7; // 1970-01-01 under UTC+8 is Thursday
  }

  /**
   * @dev Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
   * @return Day of week (0-6)
   */
  function getDayOfWeek() internal view returns (uint256) {
    return getDayOfWeek(block.timestamp);
  }

  /**
   * @dev Get current day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
   * @return Day of week (0-6)
   */
  function getCurrentDayOfWeek() internal view returns (uint256) {
    return getDayOfWeek(block.timestamp);
  }
}

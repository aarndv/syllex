import React, { useMemo } from "react";
import "./DashboardHeader.css";

interface DashboardHeaderProps {
  courseCount?: number;
  fileCount?: number;
}

const MORNING_GREETINGS = [
  "Good morning! Ready for a productive study session?",
  "Rise and shine! Time to conquer your course modules.",
  "Top of the morning! Let's make today count.",
  "Good morning! A fresh start and a clear mind for learning.",
  "Early bird gets the grade! Welcome back to your workspace.",
  "Good morning! Grab your tea or coffee and let's dive in.",
];

const AFTERNOON_GREETINGS = [
  "Good afternoon! Hope your day of learning is going smoothly.",
  "Welcome back! Ready for an engaging afternoon study block?",
  "Good afternoon! Keep up the great study momentum.",
  "Afternoon greetings! Time to make steady progress on your modules.",
  "Good afternoon! Stay focused and finish today strong.",
  "Halfway through the day! Happy studying and welcome back.",
];

const EVENING_GREETINGS = [
  "Good evening! Time to settle in for focused reading.",
  "Welcome back this evening! Ready to review your key subjects?",
  "Good evening! Excellent effort putting in work tonight.",
  "Evening greetings! Wrapping up another solid day of learning.",
  "Good evening! Step by step, page by page—you've got this.",
  "Good evening! Let's solidify today's course concepts.",
];

const NIGHT_GREETINGS = [
  "Burning the midnight oil? Welcome back, night owl!",
  "Late night study session! Keep up the dedication, but rest well soon.",
  "Working hard into the night! Good luck with your late review.",
  "Quiet night, focused mind. Welcome back to your study vault.",
  "Good night! Deep work flows best in the quiet of the night.",
  "Nighttime dedication! Every slide and page gets you closer to your goal.",
];

const MOTIVATIONAL_SENTENCES = [
  "Small daily efforts compound into extraordinary mastery over time.",
  "Focus on progress, not perfection; every page read is a victory.",
  "Consistency is the secret bridge between ambition and achievement.",
  "Knowledge builds quiet confidence that lasts a lifetime.",
  "Your future self will thank you for the focus you invest today.",
  "Curiosity fuels understanding—keep asking questions as you read.",
  "Great scholars are simply dedicated learners who refused to give up.",
  "One concept at a time, you are constructing your foundation.",
  "The effort you put in today lights the path for your success tomorrow.",
  "Deep focus transforms complex topics into familiar knowledge.",
];

function getTimeOfDay(hour: number): "morning" | "afternoon" | "evening" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({ courseCount, fileCount }) => {
  const { greeting, motivationalSentence, formattedDate, timeLabel } = useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const timeOfDay = getTimeOfDay(hour);

    let greetingsList: string[];
    switch (timeOfDay) {
      case "morning":
        greetingsList = MORNING_GREETINGS;
        break;
      case "afternoon":
        greetingsList = AFTERNOON_GREETINGS;
        break;
      case "evening":
        greetingsList = EVENING_GREETINGS;
        break;
      case "night":
        greetingsList = NIGHT_GREETINGS;
        break;
    }

    const greetingStr = getRandomItem(greetingsList);
    const mottoStr = getRandomItem(MOTIVATIONAL_SENTENCES);

    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "short",
      day: "numeric",
    };
    const dateStr = now.toLocaleDateString(undefined, dateOptions);

    let periodLabel = "Morning";
    if (timeOfDay === "afternoon") periodLabel = "Afternoon";
    if (timeOfDay === "evening") periodLabel = "Evening";
    if (timeOfDay === "night") periodLabel = "Night";

    return {
      greeting: greetingStr,
      motivationalSentence: mottoStr,
      formattedDate: dateStr,
      timeLabel: periodLabel,
    };
  }, []);

  return (
    <div className="dashboard-header-card book-spine-header-card">
      <div className="spine-book-ridge-left" />
      <div className="spine-foil-bar top" />
      <div className="spine-foil-bar bottom" />

      <div className="dashboard-header-main">
        <div className="dashboard-badge-row">
          <span className="dashboard-time-badge">{timeLabel} Session</span>
          <span className="dashboard-date-text">{formattedDate}</span>
        </div>
        <h2 className="dashboard-greeting-title">{greeting}</h2>
        <p className="dashboard-motivational-subtitle">{motivationalSentence}</p>
      </div>

      {(courseCount !== undefined || fileCount !== undefined) && (
        <div className="dashboard-stats-strip">
          {courseCount !== undefined && (
            <div className="stat-item">
              <span className="stat-value">{courseCount}</span>
              <span className="stat-label">{courseCount === 1 ? "Course" : "Courses"}</span>
            </div>
          )}
          {fileCount !== undefined && (
            <div className="stat-item">
              <span className="stat-value">{fileCount}</span>
              <span className="stat-label">{fileCount === 1 ? "Module" : "Modules"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


import { useMemo, useState } from "react"

type View = "learn" | "words" | "progress"
type LessonStep = "translate" | "match" | "complete"

type IconName =
  | "home"
  | "cards"
  | "chart"
  | "flame"
  | "heart"
  | "bolt"
  | "speaker"
  | "arrow"
  | "close"
  | "check"
  | "lock"
  | "book"
  | "trophy"
  | "shuffle"

const iconPaths: Record<IconName, React.ReactNode> = {
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  cards: (
    <>
      <rect x="4" y="5" width="14" height="16" rx="3" />
      <path d="m9 5 .7-1.4A3 3 0 0 1 13.5 2l4.7 2a3 3 0 0 1 1.6 3.9L18 12" />
      <path d="M8 10h6M8 14h4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
    </>
  ),
  flame: (
    <path d="M12 22c4 0 7-2.7 7-6.4 0-2.8-1.5-5.4-4.5-7.8.1 2.2-1 3.7-2.2 4.5.2-4-2-7.4-5.4-9.3.3 3.4-2 5.8-2 9.1C4.9 17.8 8.1 22 12 22Z" />
  ),
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
  bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
  speaker: (
    <>
      <path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z" />
      <path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
    </>
  ),
  arrow: <path d="m9 18 6-6-6-6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12 4 4L19 6" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4" />
    </>
  ),
  shuffle: (
    <>
      <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
    </>
  ),
}

function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  )
}

function Kubu({ mood = "happy" }: { mood?: "happy" | "celebrate" }) {
  return (
    <svg
      aria-label="Kubu the zebra guide"
      className={`kubu kubu-${mood}`}
      role="img"
      viewBox="0 0 180 180"
    >
      <g className="kubu-body">
        <path d="M48 39 35 12c20 2 30 11 33 27" fill="#172b38" />
        <path d="m132 39 13-27c-20 2-30 11-33 27" fill="#172b38" />
        <path d="M55 38 45 20c10 3 16 9 19 20" fill="#f8f6ed" />
        <path d="m125 38 10-18c-10 3-16 9-19 20" fill="#f8f6ed" />
        <path
          d="M90 25c40 0 64 24 59 65-4 35-27 61-59 61S35 125 31 90C26 49 50 25 90 25Z"
          fill="#f8f6ed"
          stroke="#172b38"
          strokeWidth="7"
        />
        <path d="M88 29c-9 18-10 36-3 54M63 34c1 18 8 31 22 42M117 35c-2 17-10 30-24 40" fill="none" stroke="#172b38" strokeLinecap="round" strokeWidth="9" />
        <path d="M45 61c13 2 22 8 28 20M135 61c-13 2-22 8-28 20" fill="none" stroke="#172b38" strokeLinecap="round" strokeWidth="8" />
        <ellipse cx="64" cy="88" fill="#172b38" rx="11" ry="14" />
        <ellipse cx="116" cy="88" fill="#172b38" rx="11" ry="14" />
        <circle cx="68" cy="83" fill="#fff" r="4" />
        <circle cx="120" cy="83" fill="#fff" r="4" />
        <path
          d="M58 109c8-14 22-21 32-21s24 7 32 21c9 17-2 34-32 34s-41-17-32-34Z"
          fill="#dce5e3"
          stroke="#172b38"
          strokeWidth="5"
        />
        <ellipse cx="75" cy="116" fill="#172b38" rx="4.5" ry="6" />
        <ellipse cx="105" cy="116" fill="#172b38" rx="4.5" ry="6" />
        <path d={mood === "celebrate" ? "M74 127c10 12 22 12 32 0" : "M77 127c9 7 17 7 26 0"} fill="none" stroke="#172b38" strokeLinecap="round" strokeWidth="5" />
        <path d="M49 143c20 17 62 17 82 0l-7 22H56l-7-22Z" fill="#25a8d8" />
        <path d="m90 151 10 18-10 7-10-7 10-18Z" fill="#f4b83f" />
      </g>
      {mood === "celebrate" && (
        <g className="celebration-marks" fill="none" strokeLinecap="round" strokeWidth="5">
          <path d="m22 44-9-9M157 43l10-10" stroke="#f06b55" />
          <path d="M18 72H6M162 71h12" stroke="#f4b83f" />
          <path d="m29 22-3-12M151 22l4-12" stroke="#25a8d8" />
        </g>
      )}
    </svg>
  )
}

const chapters = [
  {
    eyebrow: "Unit 1",
    title: "Dumediso",
    subtitle: "Greetings",
    className: "chapter-blue",
    state: "done",
  },
  {
    eyebrow: "Unit 2",
    title: "Ke mang?",
    subtitle: "Introductions",
    className: "chapter-coral",
    state: "active",
  },
  {
    eyebrow: "Unit 3",
    title: "Lelapa",
    subtitle: "Family",
    className: "chapter-gold",
    state: "locked",
  },
]

const words = [
  { word: "Dumela", meaning: "Hello", colour: "blue" },
  { word: "Ke a leboga", meaning: "Thank you", colour: "coral" },
  { word: "Tsweetswee", meaning: "Please", colour: "gold" },
  { word: "Tsamaya sentle", meaning: "Go well", colour: "green" },
]

const matchPairs = [
  { id: "hello", text: "Dumela", language: "tn" },
  { id: "thanks", text: "Thank you", language: "en" },
  { id: "name", text: "Leina", language: "tn" },
  { id: "hello", text: "Hello", language: "en" },
  { id: "thanks", text: "Ke a leboga", language: "tn" },
  { id: "name", text: "Name", language: "en" },
]

export default function App() {
  const [view, setView] = useState<View>("learn")
  const [inLesson, setInLesson] = useState(false)
  const [lessonStep, setLessonStep] = useState<LessonStep>("translate")
  const [answer, setAnswer] = useState<string | null>(null)
  const [points, setPoints] = useState(380)
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null)
  const [matched, setMatched] = useState<number[]>([])
  const [notice, setNotice] = useState("")

  const lessonProgress = lessonStep === "translate" ? 25 : lessonStep === "match" ? 68 : 100
  const allMatched = matched.length === matchPairs.length

  const dailyDots = useMemo(() => [true, true, true, false, false], [])

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return
    window.speechSynthesis.cancel()
    const phrase = new SpeechSynthesisUtterance(text)
    phrase.rate = 0.72
    window.speechSynthesis.speak(phrase)
  }

  function beginLesson() {
    setInLesson(true)
    setLessonStep("translate")
    setAnswer(null)
    setMatched([])
    setSelectedMatch(null)
  }

  function leaveLesson() {
    setInLesson(false)
    setAnswer(null)
    setMatched([])
    setSelectedMatch(null)
  }

  function pickAnswer(value: string) {
    if (answer === "I am Naledi") return
    setAnswer(value)
  }

  function continueLesson() {
    if (lessonStep === "translate" && answer === "I am Naledi") {
      setPoints((current) => current + 10)
      setLessonStep("match")
      setAnswer(null)
      return
    }
    if (lessonStep === "match" && allMatched) {
      setPoints((current) => current + 20)
      setLessonStep("complete")
    }
  }

  function chooseMatch(index: number) {
    if (matched.includes(index)) return
    if (selectedMatch === null) {
      setSelectedMatch(index)
      return
    }
    if (selectedMatch === index) {
      setSelectedMatch(null)
      return
    }

    const first = matchPairs[selectedMatch]
    const second = matchPairs[index]
    if (first.id === second.id && first.language !== second.language) {
      setMatched((current) => [...current, selectedMatch, index])
      setSelectedMatch(null)
    } else {
      setSelectedMatch(index)
      setNotice("Not quite — try another pair.")
      window.setTimeout(() => setNotice(""), 1400)
    }
  }

  if (inLesson) {
    return (
      <div className="mockup-stage lesson-stage">
        <div className="phone-app lesson-app">
          <header className="lesson-header">
            <button aria-label="Exit lesson" className="plain-icon-button" onClick={leaveLesson} type="button">
              <Icon name="close" size={25} />
            </button>
            <div className="lesson-progress-track">
              <span style={{ width: `${lessonProgress}%` }} />
            </div>
            <div className="heart-count">
              <Icon name="heart" size={19} />
              <strong>4</strong>
            </div>
          </header>

          {lessonStep === "translate" && (
            <>
              <main className="exercise">
                <span className="exercise-label">Question 1 of 3</span>
                <h1>Translate this phrase</h1>

                <div className="guide-row">
                  <div className="guide-mini">
                    <Kubu />
                  </div>
                  <div className="speech-bubble">
                    <button aria-label="Listen to the phrase" onClick={() => speak("Ke nna Naledi")} type="button">
                      <Icon name="speaker" size={20} />
                    </button>
                    <div>
                      <strong>Ke nna Naledi</strong>
                      <span>keh nah nah-leh-dee</span>
                    </div>
                  </div>
                </div>

                <div className="answer-options">
                  {["I am Naledi", "How are you?", "See you tomorrow"].map((option) => {
                    const isSelected = answer === option
                    const status =
                      isSelected && option === "I am Naledi"
                        ? "correct"
                        : isSelected
                          ? "wrong"
                          : ""
                    return (
                      <button
                        className={`answer-option ${status}`}
                        key={option}
                        onClick={() => pickAnswer(option)}
                        type="button"
                      >
                        <span>{option}</span>
                        <span className="answer-state">
                          {isSelected && <Icon name={option === "I am Naledi" ? "check" : "close"} size={18} />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </main>

              <footer className={`answer-footer ${answer ? (answer === "I am Naledi" ? "is-correct" : "is-wrong") : ""}`}>
                <div className="feedback-copy">
                  <strong>
                    {!answer ? "Choose an answer" : answer === "I am Naledi" ? "Go siame!" : "Almost!"}
                  </strong>
                  <span>
                    {!answer
                      ? "Tap the best translation."
                      : answer === "I am Naledi"
                        ? "That’s correct."
                        : "Give it another try."}
                  </span>
                </div>
                <button
                  className="action-button"
                  disabled={answer !== "I am Naledi"}
                  onClick={continueLesson}
                  type="button"
                >
                  Continue
                </button>
              </footer>
            </>
          )}

          {lessonStep === "match" && (
            <>
              <main className="exercise match-exercise">
                <span className="exercise-label">Question 2 of 3</span>
                <h1>Match the pairs</h1>
                <p className="exercise-intro">Pair each Setswana word with its English meaning.</p>
                <div className="match-grid">
                  {matchPairs.map((item, index) => {
                    const isMatched = matched.includes(index)
                    const isSelected = selectedMatch === index
                    return (
                      <button
                        className={`match-card ${isMatched ? "matched" : ""} ${isSelected ? "selected" : ""}`}
                        disabled={isMatched}
                        key={`${item.text}-${index}`}
                        onClick={() => chooseMatch(index)}
                        type="button"
                      >
                        <small>{item.language === "tn" ? "SETSWANA" : "ENGLISH"}</small>
                        <strong>{item.text}</strong>
                        {isMatched && <Icon name="check" size={18} />}
                      </button>
                    )
                  })}
                </div>
              </main>
              <footer className={`answer-footer ${allMatched ? "is-correct" : ""}`}>
                <div className="feedback-copy">
                  <strong>{allMatched ? "Great matching!" : `${matched.length / 2} of 3 pairs`}</strong>
                  <span>{allMatched ? "You found every pair." : "Keep going."}</span>
                </div>
                <button className="action-button" disabled={!allMatched} onClick={continueLesson} type="button">
                  Finish
                </button>
              </footer>
            </>
          )}

          {lessonStep === "complete" && (
            <main className="complete-screen">
              <div className="confetti confetti-one" />
              <div className="confetti confetti-two" />
              <div className="confetti confetti-three" />
              <span className="complete-kicker">Lesson complete</span>
              <div className="complete-mascot">
                <Kubu mood="celebrate" />
              </div>
              <h1>O dirile sentle!</h1>
              <p>You completed <strong>Introductions</strong> and learned 4 new words.</p>
              <div className="reward-row">
                <div>
                  <span className="reward-icon xp">
                    <Icon name="bolt" size={21} />
                  </span>
                  <strong>+30</strong>
                  <small>XP earned</small>
                </div>
                <div>
                  <span className="reward-icon streak">
                    <Icon name="flame" size={21} />
                  </span>
                  <strong>6 days</strong>
                  <small>Current streak</small>
                </div>
              </div>
              <button className="action-button complete-button" onClick={leaveLesson} type="button">
                Back to my path
              </button>
            </main>
          )}

          {notice && <div className="notice">{notice}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="mockup-stage">
      <aside className="presentation-note">
        <div className="presentation-brand">
          <span className="brand-symbol">B</span>
          <span>Bua</span>
        </div>
        <span className="presentation-tag">Setswana, one conversation at a time.</span>
        <h1>A small lesson every day. A language for life.</h1>
        <p>Interactive mobile learning inspired by Botswana’s colour, rhythm and warmth.</p>
        <div className="palette">
          <span />
          <span />
          <span />
          <span />
        </div>
      </aside>

      <div className="phone-app">
        <header className="app-header">
          <div className="wordmark">
            <span className="brand-symbol">B</span>
            <span>Bua</span>
          </div>
          <div className="header-stats">
            <span className="mini-stat streak-stat">
              <Icon name="flame" size={18} />
              <strong>6</strong>
            </span>
            <span className="mini-stat xp-stat">
              <Icon name="bolt" size={18} />
              <strong>{points}</strong>
            </span>
          </div>
        </header>

        {view === "learn" && (
          <main className="home-view">
            <section className="welcome-card">
              <div className="welcome-copy">
                <span>Labobedi, 14 Motsheganong</span>
                <h1>Dumela, Naledi!</h1>
                <p>Kubu is ready for today’s lesson.</p>
              </div>
              <div className="welcome-mascot">
                <Kubu />
              </div>
            </section>

            <section className="daily-card">
              <div>
                <span className="daily-icon">
                  <Icon name="bolt" size={20} />
                </span>
                <div>
                  <strong>Daily goal</strong>
                  <small>3 of 5 lessons</small>
                </div>
              </div>
              <div className="goal-dots" aria-label="Three of five lessons complete">
                {dailyDots.map((complete, index) => (
                  <span className={complete ? "complete" : ""} key={index} />
                ))}
              </div>
            </section>

            <div className="section-title">
              <div>
                <span>Your learning path</span>
                <h2>Basics of conversation</h2>
              </div>
              <button aria-label="Open course guide" type="button">
                <Icon name="book" size={20} />
              </button>
            </div>

            <section className="learning-path">
              <div className="path-line" />
              {chapters.map((chapter, index) => (
                <article className={`chapter ${index % 2 ? "align-right" : ""}`} key={chapter.title}>
                  <button
                    aria-label={`${chapter.title} ${chapter.state}`}
                    className={`chapter-node ${chapter.className} ${chapter.state}`}
                    disabled={chapter.state === "locked"}
                    onClick={chapter.state === "active" ? beginLesson : undefined}
                    type="button"
                  >
                    {chapter.state === "done" ? (
                      <Icon name="check" size={25} />
                    ) : chapter.state === "locked" ? (
                      <Icon name="lock" size={21} />
                    ) : (
                      <Icon name="arrow" size={25} />
                    )}
                  </button>
                  <button
                    className={`chapter-card ${chapter.state}`}
                    disabled={chapter.state === "locked"}
                    onClick={chapter.state === "active" ? beginLesson : undefined}
                    type="button"
                  >
                    <span>{chapter.eyebrow}</span>
                    <strong>{chapter.title}</strong>
                    <small>{chapter.subtitle}</small>
                    {chapter.state === "active" && <b>Start</b>}
                  </button>
                </article>
              ))}
            </section>
          </main>
        )}

        {view === "words" && (
          <main className="library-view">
            <span className="view-kicker">Your collection</span>
            <h1>Words you know</h1>
            <p className="view-intro">Tap a card to hear it spoken.</p>
            <div className="word-list">
              {words.map((item) => (
                <button className={`word-list-card ${item.colour}`} key={item.word} onClick={() => speak(item.word)} type="button">
                  <span className="word-speaker">
                    <Icon name="speaker" size={20} />
                  </span>
                  <span>
                    <strong>{item.word}</strong>
                    <small>{item.meaning}</small>
                  </span>
                  <Icon name="arrow" size={19} />
                </button>
              ))}
            </div>
            <button className="practice-button" onClick={beginLesson} type="button">
              <Icon name="shuffle" size={20} />
              Quick practice
            </button>
          </main>
        )}

        {view === "progress" && (
          <main className="progress-view">
            <span className="view-kicker">This week</span>
            <h1>Your progress</h1>
            <div className="progress-hero">
              <div className="progress-ring">
                <span>
                  <strong>12</strong>
                  <small>lessons</small>
                </span>
              </div>
              <div>
                <span>Great rhythm</span>
                <h2>You’re building a strong habit.</h2>
                <p>Two more lessons to beat last week.</p>
              </div>
            </div>
            <div className="week-chart">
              {[40, 72, 55, 88, 62, 20, 10].map((height, index) => (
                <div key={index}>
                  <span className={index < 5 ? "active" : ""} style={{ height: `${height}%` }} />
                  <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
                </div>
              ))}
            </div>
            <div className="progress-stats">
              <article>
                <span className="progress-stat-icon blue">
                  <Icon name="bolt" size={22} />
                </span>
                <strong>{points}</strong>
                <small>Total XP</small>
              </article>
              <article>
                <span className="progress-stat-icon coral">
                  <Icon name="trophy" size={22} />
                </span>
                <strong>86%</strong>
                <small>Accuracy</small>
              </article>
            </div>
          </main>
        )}

        <nav aria-label="Primary navigation" className="bottom-nav">
          <button className={view === "learn" ? "active" : ""} onClick={() => setView("learn")} type="button">
            <Icon name="home" size={21} />
            <span>Learn</span>
          </button>
          <button className={view === "words" ? "active" : ""} onClick={() => setView("words")} type="button">
            <Icon name="cards" size={21} />
            <span>Words</span>
          </button>
          <button className={view === "progress" ? "active" : ""} onClick={() => setView("progress")} type="button">
            <Icon name="chart" size={21} />
            <span>Progress</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

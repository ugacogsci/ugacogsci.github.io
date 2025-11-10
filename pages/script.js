const tasks = {
  "digit-span": {
    name: "Digit Span Task",
    summary:
      "Run baseline digit recall until three cumulative errors, then unlock delimiter-assisted (chunked) trials automatically.",
    highlights: [
      "Digits display for 3 seconds before the response window opens.",
      "Three errors end the current phase; perfect streaks extend indefinitely.",
      "Live scoreboard compares baseline accuracy against chunked recall.",
    ],
    stagePlaceholder:
      "Digits will render here. Once three errors occur, the task switches to chunked recall automatically.",
  },
  "pattern-recall": {
    name: "Corsi Pattern Recall",
    summary: "Visuospatial span task using sequenced block taps (Corsi board).",
    highlights: [
      "Adaptive block patterns tap into forward/backward visuospatial span.",
      "Timing windows can add interference or rehearsal delays.",
      "Performance summary captures longest span and average accuracy.",
    ],
    stagePlaceholder:
      "Corsi block patterns will appear here. Configure block count and presentation timing before launching.",
  },
  "story-chain": {
    name: "Story Chain",
    summary:
      "Narrative retention task where participants extend and recall story elements.",
    highlights: [
      "Rotates prompts to balance semantic load and novelty.",
      "Supports collaborative or solo recall phases.",
      "Scores based on fidelity, continuity, and added details.",
    ],
    stagePlaceholder:
      "Story prompts will appear here. Adjust narrative complexity and recall cadence in settings.",
  },
};

const taskCards = document.querySelectorAll(".task-card");
const launchButton = document.getElementById("launch-task");
const settingsButton = document.getElementById("task-settings");
const taskStage = document.getElementById("task-stage");
const taskDetailsSection = document.getElementById("task-details");
const taskHighlightsList = document.getElementById("task-highlights");

const DIGIT_SPAN_TASK_KEY = "digit-span";
const DIGIT_SPAN_ERROR_LIMIT = 3;
const DIGIT_SPAN_DISPLAY_MS = 3000;
const DIGIT_SPAN_MIN_LENGTH = 5;
const DIGIT_SPAN_MAX_LENGTH = 12;

let activeTaskKey = null;
let chunkingState = null;
let chunkingUI = null;
const chunkingHistory = [];

const body = document.body;

const enterChunkingFullscreen = async () => {
  body.classList.add("chunking-fullscreen");
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch (error) {
      // Fullscreen request may be denied by the browser; fall back to CSS-only full view.
    }
  }
};

const exitChunkingFullscreen = () => {
  body.classList.remove("chunking-fullscreen");
  if (document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {
      // Ignore errors if the browser exits fullscreen automatically.
    });
  }
};

const setChunkingLockState = (locked) => {
  if (locked) {
    body.dataset.chunkingLocked = "true";
  } else {
    delete body.dataset.chunkingLocked;
  }
};

const lockChunkingInput = (locked) => {
  setChunkingLockState(locked);
  if (!chunkingUI?.input) {
    return;
  }

  chunkingUI.input.disabled = locked;
  if (locked) {
    chunkingUI.input.blur();
  }
};

const preventTypingWhenLocked = (event) => {
  if (body.dataset.chunkingLocked !== "true") {
    return;
  }
  if (event.key === "Escape" || event.key === "F11") {
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
};

const preventBeforeInputWhenLocked = (event) => {
  if (body.dataset.chunkingLocked === "true") {
    event.preventDefault();
  }
};

document.addEventListener("keydown", preventTypingWhenLocked, true);
document.addEventListener("keypress", preventTypingWhenLocked, true);
document.addEventListener("beforeinput", preventBeforeInputWhenLocked, true);

const resetTaskCards = () => {
  taskCards.forEach((card) => card.classList.remove("active"));
};

const restartChunkingTimer = (durationMs) => {
  const timer = chunkingUI?.timer;
  if (!timer) {
    return;
  }

  timer.style.transition = "none";
  timer.style.opacity = "1";
  timer.style.transform = "scaleX(1)";
  timer.getBoundingClientRect();
  window.requestAnimationFrame(() => {
    timer.style.transition = `transform ${durationMs}ms linear`;
    timer.style.transform = "scaleX(0)";
  });
};

const stopChunkingTimer = () => {
  const timer = chunkingUI?.timer;
  if (!timer) {
    return;
  }
  timer.style.transition = "none";
  timer.style.transform = "scaleX(0)";
  timer.style.opacity = "0";
};

const createDigitSequence = (length) =>
  Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");

const formatWithDelimiters = (sequence) => {
  if (!sequence) {
    return "";
  }
  const groups = [];
  let index = 0;
  while (index < sequence.length) {
    const remaining = sequence.length - index;
    const groupSize = remaining > 4 ? 3 : remaining;
    groups.push(sequence.slice(index, index + groupSize));
    index += groupSize;
  }
  return groups.join(" • ");
};

const averageAccuracy = (rounds) => {
  if (!rounds.length) {
    return null;
  }
  const total = rounds.reduce((sum, { accuracy }) => sum + accuracy, 0);
  return total / rounds.length;
};

const formatPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
};

function updateChunkingSummary() {
  if (!chunkingUI?.summary) {
    return;
  }

  const activeRounds = chunkingState?.rounds ?? [];
  const baselineRounds = activeRounds.filter((round) => !round.withDelimiters);
  const chunkedRounds = activeRounds.filter((round) => round.withDelimiters);

  const baselineScore = averageAccuracy(baselineRounds);
  const chunkedScore = averageAccuracy(chunkedRounds);
  const overallScore = averageAccuracy(activeRounds);

  if (!activeRounds.length && !chunkingHistory.length) {
    chunkingUI.summary.innerHTML =
      "<p>Launch the Digit Span Task to log baseline accuracy, then compare it with chunked recall.</p>";
    return;
  }

  const scoreboard = `
    <div class="chunking-scoreboard">
      <div>
        <span>Baseline Avg</span>
        <strong>${formatPercent(baselineScore)}</strong>
      </div>
      <div>
        <span>Chunked Avg</span>
        <strong>${formatPercent(chunkedScore)}</strong>
      </div>
      <div>
        <span>Overall Avg</span>
        <strong>${formatPercent(overallScore)}</strong>
      </div>
    </div>
  `;

  let progress = "";
  if (chunkingState?.inProgress) {
    const phaseLabel =
      chunkingState.phase === "chunked" ? "Chunked Recall · Delimiters" : "Baseline Recall · No Delimiters";
    progress += `<p><strong>Phase:</strong> ${phaseLabel}</p>`;
    progress += `<p>Rounds completed: ${chunkingState.rounds.length} · Errors this phase: ${chunkingState.errorsInPhase}/${DIGIT_SPAN_ERROR_LIMIT}</p>`;
    if (chunkingState.phase === "baseline") {
      progress += "<p>Three errors unlock chunked digits. Perfect streaks continue indefinitely.</p>";
    } else {
      progress += "<p>Three errors end the chunked phase and finalize the session.</p>";
    }
  }

  const historyMarkup = chunkingHistory.length
    ? `<div class="chunking-history">
         <h3>Recent Sessions</h3>
         <ul>
           ${chunkingHistory
             .slice(0, 5)
             .map(
               (entry) => `
             <li>
               <span>${new Date(entry.timestamp).toLocaleTimeString([], {
                 hour: "2-digit",
                 minute: "2-digit",
               })}</span>
               Baseline: ${formatPercent(entry.baselineScore)} · Chunked: ${formatPercent(
                 entry.chunkedScore
               )} · Overall: ${formatPercent(entry.overallScore)}
             </li>
           `
             )
             .join("")}
         </ul>
       </div>`
    : "";

  chunkingUI.summary.innerHTML = `${scoreboard}${progress}${historyMarkup}`;
}

function resetChunkingSession({ aborted = false } = {}) {
  if (!chunkingState) {
    return;
  }

  lockChunkingInput(false);
  exitChunkingFullscreen();
  stopChunkingTimer();

  if (chunkingState.timeoutId) {
    window.clearTimeout(chunkingState.timeoutId);
  }
  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
  }

  if (chunkingUI && aborted) {
    chunkingUI.displayText.textContent = "Session aborted. Select launch to restart.";
    chunkingUI.feedback.textContent =
      "Baseline vs chunking scores will reset with the next session.";
    chunkingUI.form.hidden = true;
  }

  launchButton.textContent = "Launch Session";
  launchButton.disabled = false;
  settingsButton.disabled = false;

  chunkingState = null;
}

function finishChunkingSession() {
  if (!chunkingState || !chunkingUI) {
    return;
  }

  if (chunkingState.timeoutId) {
    window.clearTimeout(chunkingState.timeoutId);
    chunkingState.timeoutId = null;
  }
  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
    chunkingState.pendingNextRoundId = null;
  }

  const rounds = [...chunkingState.rounds];
  const baselineRounds = rounds.filter((round) => !round.withDelimiters);
  const chunkedRounds = rounds.filter((round) => round.withDelimiters);

  const baselineScore = averageAccuracy(baselineRounds) ?? 0;
  const chunkedScore = averageAccuracy(chunkedRounds) ?? 0;
  const overallScore = averageAccuracy(rounds) ?? 0;

  chunkingHistory.unshift({
    id: Date.now(),
    timestamp: Date.now(),
    baselineScore,
    chunkedScore,
    overallScore,
  });

  chunkingUI.displayText.textContent =
    "Session complete. Compare baseline and chunking-aided performance below.";
  chunkingUI.feedback.textContent = "Launch again to collect another data point.";
  chunkingUI.form.hidden = true;
  chunkingState.inProgress = false;
  stopChunkingTimer();

  updateChunkingSummary();

  lockChunkingInput(false);
  exitChunkingFullscreen();

  launchButton.textContent = "Launch Session";
  launchButton.disabled = false;
  settingsButton.disabled = false;

  chunkingState = null;
}

function runChunkingRound() {
  if (!chunkingState || !chunkingUI) {
    return;
  }

  if (chunkingState.timeoutId) {
    window.clearTimeout(chunkingState.timeoutId);
    chunkingState.timeoutId = null;
  }

  const isChunkedPhase = chunkingState.phase === "chunked";
  const phaseLabel = isChunkedPhase ? "Chunked Recall · Delimiters" : "Baseline Recall · No Delimiters";
  const nextRoundNumber = chunkingState.phaseRoundCount + 1;
  const maxIncrement = DIGIT_SPAN_MAX_LENGTH - DIGIT_SPAN_MIN_LENGTH;
  const lengthIncrement = Math.min(chunkingState.phaseRoundCount, maxIncrement);
  const sequenceLength = DIGIT_SPAN_MIN_LENGTH + lengthIncrement;
  const sequence = createDigitSequence(sequenceLength);
  const withDelimiters = isChunkedPhase;
  const errorsRemaining = Math.max(
    DIGIT_SPAN_ERROR_LIMIT - chunkingState.errorsInPhase,
    0
  );

  chunkingState.currentSequence = sequence;
  chunkingState.withDelimiters = withDelimiters;
  chunkingState.awaitingInput = false;

  chunkingUI.phase.textContent = phaseLabel;
  chunkingUI.progress.textContent = `Round ${nextRoundNumber} · Errors ${chunkingState.errorsInPhase}/${DIGIT_SPAN_ERROR_LIMIT}`;

  lockChunkingInput(true);

  chunkingUI.displayText.textContent = withDelimiters ? formatWithDelimiters(sequence) : sequence;
  chunkingUI.form.hidden = true;
  chunkingUI.input.value = "";
  chunkingUI.input.placeholder = `Enter ${sequenceLength} digits`;
  chunkingUI.feedback.textContent = `Memorize ${sequenceLength} digits${
    withDelimiters ? " with chunk markers." : ""
  }. Errors remaining: ${errorsRemaining}.`;

  restartChunkingTimer(DIGIT_SPAN_DISPLAY_MS);

  chunkingState.timeoutId = window.setTimeout(() => {
    chunkingState.timeoutId = null;
    if (!chunkingState || !chunkingUI) {
      return;
    }

    chunkingUI.displayText.textContent = "Re-enter the sequence.";
    chunkingUI.form.hidden = false;
    chunkingUI.input.focus({ preventScroll: true });
    lockChunkingInput(false);
    chunkingState.awaitingInput = true;
    chunkingUI.feedback.textContent = "Accuracy is per digit. Partial recall still counts.";
    stopChunkingTimer();
  }, DIGIT_SPAN_DISPLAY_MS);

  updateChunkingSummary();
}

const transitionToChunkedPhase = () => {
  if (!chunkingState || !chunkingUI) {
    return;
  }
  if (chunkingState.phase === "chunked") {
    return;
  }

  chunkingState.phase = "chunked";
  chunkingState.errorsInPhase = 0;
  chunkingState.phaseRoundCount = 0;
  chunkingState.chunkedUnlocked = true;
  chunkingState.awaitingInput = false;

  lockChunkingInput(true);
  chunkingUI.form.hidden = true;
  chunkingUI.displayText.textContent = "Chunked recall begins now.";
  chunkingUI.feedback.textContent =
    "Delimiter-assisted digits unlocked. Watch for chunk markers in the upcoming sequence.";
  stopChunkingTimer();
  updateChunkingSummary();

  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
  }

  chunkingState.pendingNextRoundId = window.setTimeout(() => {
    chunkingState.pendingNextRoundId = null;
    runChunkingRound();
  }, 1200);
};

function startChunkingSession() {
  if (chunkingState?.inProgress) {
    return;
  }

  if (!chunkingUI) {
    renderChunkingLanding();
  }

  chunkingState = {
    roundIndex: 0,
    rounds: [],
    currentSequence: "",
    withDelimiters: false,
    awaitingInput: false,
    timeoutId: null,
    pendingNextRoundId: null,
    inProgress: true,
    phase: "baseline",
    errorsInPhase: 0,
    phaseRoundCount: 0,
    chunkedUnlocked: false,
  };

  enterChunkingFullscreen();
  lockChunkingInput(true);

  launchButton.textContent = "In Session...";
  launchButton.disabled = true;
  settingsButton.disabled = true;

  chunkingUI.displayText.textContent = "Get ready...";
  chunkingUI.feedback.textContent =
    "Baseline digits display first. Three errors will unlock the chunked recall phase.";
  chunkingUI.form.hidden = true;

  updateChunkingSummary();
  runChunkingRound();
}

function handleChunkingSubmit(event) {
  event.preventDefault();
  if (!chunkingState || !chunkingState.awaitingInput || !chunkingUI) {
    return;
  }

  const responseInput = chunkingUI.input.value.trim();
  const normalizedResponse = responseInput.replace(/\D/g, "");
  const target = chunkingState.currentSequence;
  const digitsRequired = target.length;
  const responseDigits = normalizedResponse.split("");

  let correctCount = 0;
  for (let index = 0; index < digitsRequired; index += 1) {
    if (responseDigits[index] === target[index]) {
      correctCount += 1;
    }
  }

  const accuracy = digitsRequired === 0 ? 0 : correctCount / digitsRequired;
  const errorsThisRound = Math.max(digitsRequired - correctCount, 0);
  const phaseRecorded = chunkingState.phase;
  chunkingState.rounds.push({
    round: chunkingState.roundIndex + 1,
    withDelimiters: chunkingState.withDelimiters,
    length: digitsRequired,
    correctCount,
    accuracy,
    errors: errorsThisRound,
    phase: phaseRecorded,
    response: normalizedResponse,
    target,
  });

  chunkingUI.feedback.textContent = `Score: ${(
    accuracy * 100
  ).toFixed(0)}% accuracy (${correctCount}/${digitsRequired}).`;
  chunkingUI.form.hidden = true;
  chunkingUI.displayText.textContent = `Target: ${
    chunkingState.withDelimiters
      ? formatWithDelimiters(target)
      : target
  }`;

  stopChunkingTimer();

  chunkingState.roundIndex += 1;
  chunkingState.phaseRoundCount += 1;
  chunkingState.errorsInPhase += errorsThisRound;
  chunkingState.awaitingInput = false;
  lockChunkingInput(true);

  updateChunkingSummary();

  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
  }
  const reachedLimit = chunkingState.errorsInPhase >= DIGIT_SPAN_ERROR_LIMIT;

  if (reachedLimit) {
    if (phaseRecorded === "baseline") {
      chunkingUI.feedback.textContent =
        "Baseline threshold hit. Chunked digits will start momentarily.";
      transitionToChunkedPhase();
      return;
    }

    chunkingUI.feedback.textContent = "Chunked phase complete. Preparing summary...";
    chunkingState.pendingNextRoundId = window.setTimeout(() => {
      chunkingState.pendingNextRoundId = null;
      finishChunkingSession();
    }, 900);
    return;
  }

  chunkingState.pendingNextRoundId = window.setTimeout(() => {
    chunkingState.pendingNextRoundId = null;
    runChunkingRound();
  }, 1200);
}

function renderChunkingLanding() {
  taskStage.innerHTML = `
    <div class="chunking-session" role="group" aria-label="Digit Span workspace">
      <div class="chunking-meta">
        <span id="chunking-phase">Baseline · No Delimiters</span>
        <span id="chunking-progress">Awaiting launch</span>
      </div>
      <div class="chunking-display" id="chunking-display" aria-live="assertive">
        <span id="chunking-display-text">Launch the session to present the first sequence.</span>
        <span class="chunking-timer" id="chunking-timer" aria-hidden="true"></span>
      </div>
      <form id="chunking-response" class="chunking-response" autocomplete="off" hidden>
        <label for="chunking-input">Re-enter the sequence</label>
        <input
          id="chunking-input"
          name="chunking-input"
          inputmode="numeric"
          autocorrect="off"
          autocomplete="off"
          autocapitalize="none"
          maxlength="16"
          placeholder="Type the digits in order"
        />
        <button type="submit">Submit</button>
      </form>
      <p class="chunking-feedback" id="chunking-feedback" aria-live="polite">
        Each sequence will appear for 3 seconds.
      </p>
      <div class="chunking-summary" id="chunking-summary">
        <p>Accuracy scores for baseline vs chunked recall will appear here.</p>
      </div>
    </div>
  `;

  chunkingUI = {
    phase: document.getElementById("chunking-phase"),
    progress: document.getElementById("chunking-progress"),
    display: document.getElementById("chunking-display"),
    displayText: document.getElementById("chunking-display-text"),
    timer: document.getElementById("chunking-timer"),
    form: document.getElementById("chunking-response"),
    input: document.getElementById("chunking-input"),
    feedback: document.getElementById("chunking-feedback"),
    summary: document.getElementById("chunking-summary"),
  };

  chunkingUI.form.addEventListener("submit", handleChunkingSubmit);
  updateChunkingSummary();
}

const populateTaskDetails = (key) => {
  const task = tasks[key];
  if (!task) {
    taskDetailsSection.hidden = true;
    return;
  }

  taskHighlightsList.innerHTML = `
    <li>${task.summary}</li>
    ${task.highlights.map((item) => `<li>${item}</li>`).join("")}
  `;
  taskDetailsSection.hidden = false;

  if (key === DIGIT_SPAN_TASK_KEY) {
    if (!chunkingUI) {
      renderChunkingLanding();
    } else {
      updateChunkingSummary();
    }
  } else {
    lockChunkingInput(false);
    exitChunkingFullscreen();
    stopChunkingTimer();
    chunkingUI = null;
    taskStage.innerHTML = `<p>${task.stagePlaceholder}</p>`;
  }
};

const setActiveTask = (key) => {
  if (activeTaskKey === key) {
    return;
  }

  const previousKey = activeTaskKey;
  if (previousKey === DIGIT_SPAN_TASK_KEY && chunkingState?.inProgress) {
    resetChunkingSession({ aborted: true });
  }

  activeTaskKey = key;

  resetTaskCards();
  const selectedCard = document.querySelector(`.task-card[data-task="${key}"]`);
  if (selectedCard) {
    selectedCard.classList.add("active");
    selectedCard.focus({ preventScroll: true });
  }

  populateTaskDetails(key);

  launchButton.textContent = "Launch Session";
  launchButton.disabled = false;
  settingsButton.disabled = false;
};

taskCards.forEach((card) => {
  card.addEventListener("click", () => {
    setActiveTask(card.dataset.task);
  });

  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveTask(card.dataset.task);
    }
  });
});

launchButton.addEventListener("click", () => {
  if (!activeTaskKey) {
    return;
  }

  if (activeTaskKey === DIGIT_SPAN_TASK_KEY) {
    startChunkingSession();
    return;
  }

  launchButton.textContent = "Preparing...";
  launchButton.disabled = true;

  window.setTimeout(() => {
    launchButton.textContent = "Launch Session";
    launchButton.disabled = false;
    window.alert(`Launching ${tasks[activeTaskKey].name}. (Prototype placeholder)`);
  }, 800);
});

settingsButton.addEventListener("click", () => {
  if (!activeTaskKey) {
    return;
  }

  if (activeTaskKey === DIGIT_SPAN_TASK_KEY) {
    window.alert(
      "Chunking protocol settings (duration, delimiter style, scoring weights) are coming soon."
    );
    return;
  }

  window.alert(`Configure options for ${tasks[activeTaskKey].name}.`);
});

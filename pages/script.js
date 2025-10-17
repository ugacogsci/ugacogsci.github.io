const tasks = {
  chunking: {
    name: "Chunking: Magic Number 7 ± 2",
    summary:
      "Compare baseline span to chunking-aided recall across a paced 20-round session.",
    highlights: [
      "Runs 10 baseline rounds without delimiters followed by 10 with chunk markers.",
      "Displays each digit sequence for 3 seconds before collecting responses.",
      "Scores per-digit accuracy and logs baseline vs chunking averages.",
    ],
    stagePlaceholder:
      "Launch the session to begin baseline rounds. Results will compare baseline vs chunking-assisted recall.",
  },
  "digit-span": {
    name: "Digit Span",
    summary:
      "Classic forward/backward span assessment with adaptive list lengths.",
    highlights: [
      "Toggle between forward, backward, and adaptive difficulty.",
      "Records response latency and accuracy per sequence.",
      "Optional paced playback for timed rehearsals.",
    ],
    stagePlaceholder:
      "Digits will play in sequence here. Select direction and pacing options prior to running trials.",
  },
  "n-back": {
    name: "N-Back",
    summary: "Continuous performance task measuring updating efficiency.",
    highlights: [
      "Supports visual, auditory, or dual-modality streams.",
      "Difficulty adapts by incrementing N after consecutive hits.",
      "Live performance metrics shown after each block.",
    ],
    stagePlaceholder:
      "Stimuli stream will appear here. Configure N-level, modality, and block length to begin.",
  },
  "pattern-recall": {
    name: "Pattern Recall",
    summary: "Visuospatial memory test using briefly displayed grids.",
    highlights: [
      "Grid size scales to adjust difficulty per participant.",
      "Allows masks between presentation and recall windows.",
      "Captures reconstruction accuracy and time-on-task.",
    ],
    stagePlaceholder:
      "Pattern grids render here. Set presentation duration and grid complexity prior to launch.",
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

const CHUNKING_ROUNDS = 20;
const CHUNKING_HALF = CHUNKING_ROUNDS / 2;
const CHUNKING_DISPLAY_MS = 3000;

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
      "<p>Launch a session to compare baseline (no delimiters) versus chunking-aided recall.</p>";
    return;
  }

  const scoreboard = `
    <div class="chunking-scoreboard">
      <div>
        <span>Baseline Avg</span>
        <strong>${formatPercent(baselineScore)}</strong>
      </div>
      <div>
        <span>Chunking Avg</span>
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
    const completed = chunkingState.rounds.length;
    progress += `<p><strong>Session progress:</strong> ${completed}/${CHUNKING_ROUNDS} rounds completed.</p>`;
    if (chunkingState.roundIndex < CHUNKING_HALF) {
      progress += `<p>Currently running baseline round ${chunkingState.roundIndex + 1} of ${CHUNKING_HALF}.</p>`;
    } else if (chunkingState.roundIndex < CHUNKING_ROUNDS) {
      progress += `<p>Running chunking-aided round ${chunkingState.roundIndex - CHUNKING_HALF + 1} of ${CHUNKING_HALF}.</p>`;
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
               Baseline: ${formatPercent(entry.baselineScore)} · Chunking: ${formatPercent(
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

  if (chunkingState.timeoutId) {
    window.clearTimeout(chunkingState.timeoutId);
  }
  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
  }

  if (chunkingUI && aborted) {
    chunkingUI.display.textContent = "Session aborted. Select launch to restart.";
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
  const baselineRounds = rounds.slice(0, CHUNKING_HALF);
  const chunkedRounds = rounds.slice(CHUNKING_HALF);

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

  chunkingUI.display.textContent =
    "Session complete. Compare baseline and chunking-aided performance below.";
  chunkingUI.feedback.textContent = "Launch again to collect another data point.";
  chunkingUI.form.hidden = true;
  chunkingState.inProgress = false;

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

  if (chunkingState.roundIndex >= CHUNKING_ROUNDS) {
    finishChunkingSession();
    return;
  }

  if (chunkingState.timeoutId) {
    window.clearTimeout(chunkingState.timeoutId);
    chunkingState.timeoutId = null;
  }

  const roundIndex = chunkingState.roundIndex;
  const phaseLabel =
    roundIndex < CHUNKING_HALF
      ? "Baseline · No Delimiters"
      : "Chunking Aids · Delimiters";
  const phaseRound =
    roundIndex < CHUNKING_HALF
      ? roundIndex + 1
      : roundIndex - CHUNKING_HALF + 1;

  chunkingUI.phase.textContent = phaseLabel;
  chunkingUI.progress.textContent = `Round ${phaseRound} of ${CHUNKING_HALF}`;

  const sequenceLength = 5 + (roundIndex % CHUNKING_HALF);
  const sequence = createDigitSequence(sequenceLength);
  const withDelimiters = roundIndex >= CHUNKING_HALF;

  chunkingState.currentSequence = sequence;
  chunkingState.withDelimiters = withDelimiters;
  chunkingState.awaitingInput = false;

  lockChunkingInput(true);

  chunkingUI.display.textContent = withDelimiters
    ? formatWithDelimiters(sequence)
    : sequence;
  chunkingUI.form.hidden = true;
  chunkingUI.input.value = "";
  chunkingUI.input.placeholder = `Enter ${sequenceLength} digits`;
  chunkingUI.feedback.textContent = `Memorize ${sequenceLength} digits${
    withDelimiters ? " with chunk markers." : "."
  }`;

  chunkingState.timeoutId = window.setTimeout(() => {
    chunkingState.timeoutId = null;
    if (!chunkingState || !chunkingUI) {
      return;
    }

    chunkingUI.display.textContent = "Re-enter the sequence.";
    chunkingUI.form.hidden = false;
    chunkingUI.input.focus({ preventScroll: true });
    lockChunkingInput(false);
    chunkingState.awaitingInput = true;
    chunkingUI.feedback.textContent =
      "Accuracy is per digit. Partial recall still counts.";
  }, CHUNKING_DISPLAY_MS);

  updateChunkingSummary();
}

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
  };

  enterChunkingFullscreen();
  lockChunkingInput(true);

  launchButton.textContent = "In Session...";
  launchButton.disabled = true;
  settingsButton.disabled = true;

  chunkingUI.display.textContent = "Get ready...";
  chunkingUI.feedback.textContent =
    "Baseline phase starts with 5 digits. Watch closely!";
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
  chunkingState.rounds.push({
    round: chunkingState.roundIndex + 1,
    withDelimiters: chunkingState.withDelimiters,
    length: digitsRequired,
    correctCount,
    accuracy,
    response: normalizedResponse,
    target,
  });

  chunkingUI.feedback.textContent = `Score: ${(
    accuracy * 100
  ).toFixed(0)}% accuracy (${correctCount}/${digitsRequired}).`;
  chunkingUI.form.hidden = true;
  chunkingUI.display.textContent = `Target: ${
    chunkingState.withDelimiters
      ? formatWithDelimiters(target)
      : target
  }`;

  chunkingState.roundIndex += 1;
  chunkingState.awaitingInput = false;
  lockChunkingInput(true);

  updateChunkingSummary();

  if (chunkingState.pendingNextRoundId) {
    window.clearTimeout(chunkingState.pendingNextRoundId);
  }
  chunkingState.pendingNextRoundId = window.setTimeout(() => {
    chunkingState.pendingNextRoundId = null;
    runChunkingRound();
  }, 1200);
}

function renderChunkingLanding() {
  taskStage.innerHTML = `
    <div class="chunking-session" role="group" aria-label="Chunking protocol workspace">
      <div class="chunking-meta">
        <span id="chunking-phase">Baseline · No Delimiters</span>
        <span id="chunking-progress">Awaiting launch</span>
      </div>
      <div class="chunking-display" id="chunking-display" aria-live="assertive">
        Launch the session to present the first sequence.
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
        <p>Accuracy scores for baseline vs chunking aids will appear here.</p>
      </div>
    </div>
  `;

  chunkingUI = {
    phase: document.getElementById("chunking-phase"),
    progress: document.getElementById("chunking-progress"),
    display: document.getElementById("chunking-display"),
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

  if (key === "chunking") {
    if (!chunkingUI) {
      renderChunkingLanding();
    } else {
      updateChunkingSummary();
    }
  } else {
    lockChunkingInput(false);
    exitChunkingFullscreen();
    chunkingUI = null;
    taskStage.innerHTML = `<p>${task.stagePlaceholder}</p>`;
  }
};

const setActiveTask = (key) => {
  if (activeTaskKey === key) {
    return;
  }

  const previousKey = activeTaskKey;
  if (previousKey === "chunking" && chunkingState?.inProgress) {
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

  if (activeTaskKey === "chunking") {
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

  if (activeTaskKey === "chunking") {
    window.alert(
      "Chunking protocol settings (duration, delimiter style, scoring weights) are coming soon."
    );
    return;
  }

  window.alert(`Configure options for ${tasks[activeTaskKey].name}.`);
});

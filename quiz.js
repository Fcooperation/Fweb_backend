document.addEventListener("DOMContentLoaded", () => {

let count = 1;
let time = 60;

let questions = [];
let index = 0;
let answers = {};
let timerInterval;
let currentTime = time;
let submitting = false;

// ---------------- ELEMENTS ----------------
const countEl = document.getElementById("count");
const timeEl = document.getElementById("time");

const setupBox = document.getElementById("setup-box");
const loading = document.getElementById("loading");
const quizUI = document.getElementById("quiz-ui");

const studying = localStorage.getItem("studying");
const university = localStorage.getItem("studying_uni");

const hintBtn = document.getElementById("hint-btn");
const hintDropdown = document.getElementById("hint-dropdown");
const formulaHint = document.getElementById("formula-hint");
const explanationHint = document.getElementById("explanation-hint");

const hintModal =
  document.getElementById("hint-modal");

const hintModalTitle =
  document.getElementById("hint-modal-title");

const hintModalContent =
  document.getElementById("hint-modal-content");

const hintClose =
  document.getElementById("hint-close");

const timeHint =
  document.getElementById("time-hint");

const timerValue =
  document.getElementById("timer-value");

const extraTimeIndicator =
  document.getElementById("extra-time-indicator");
  
// ---------------- SAFETY ----------------
if (!countEl || !timeEl) return;

// ---------------- QUESTION CONTROLS ----------------
document.getElementById("plus").onclick = () => {
  count++;
  countEl.textContent = count;
};

document.getElementById("minus").onclick = () => {
  if (count > 1) count--;
  countEl.textContent = count;
};

document.getElementById("max").onclick = () => {
  count = "all";
  countEl.textContent = "ALL";
};

// ---------------- TIME CONTROLS ----------------
document.getElementById("plus-time").onclick = () => {
  if (time < 3600) time += 60;
  updateTime();
};

document.getElementById("minus-time").onclick = () => {
  if (time > 60) time -= 60;
  updateTime();
};

function updateTime() {
  if (time >= 60) {
    timeEl.textContent = `${Math.floor(time / 60)} min`;
  } else {
    timeEl.textContent = `${time} sec`;
  }
}
updateTime();

// ---------------- START QUIZ ----------------
document.getElementById("start-btn").onclick = async () => {

  setupBox.style.opacity = "0.3";
  loading.classList.remove("hidden");

  const payload = {
  action: "get_quiz",
  university,
  course: studying,
  count
};

  try {

    const res = await fetch("https://fweb-backend.onrender.com/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.error || "Failed");
      return;
    }

    questions = data.questions;
    if (!questions || questions.length === 0) {

  setupBox.style.display = "block";
  loading.classList.add("hidden");
  quizUI.classList.add("hidden");

  setupBox.innerHTML = `
    <h3 style="text-align:center; color:red;">
      No questions found
    </h3>
  `;

  return;
}

    questions = [...questions].sort(() => Math.random() - 0.5);
    setupBox.style.display = "none";
    loading.classList.add("hidden");

    quizUI.classList.remove("hidden");

    index = 0;
    answers = {};

    startTimer();
    loadQuestion();

  } catch (err) {
  console.error(err);

  alert("Failed to load quiz");

  // redirect immediately
  window.location.href = "study.html";

    setupBox.style.opacity = "1";
    loading.classList.add("hidden");
  }
};

// ---------------- LOAD QUESTION ----------------
function loadQuestion() {

  const q = questions[index];

  document.getElementById("q-number").innerHTML =
  `<span style="
    font-weight: 900;
    font-size: 18px;
    color: #1d9bf0;
  ">Question ${index + 1}</span>`;

  document.getElementById("q-text").innerHTML = `
  <div class="question-text">${q.question}</div>
`;

  const optionsBox = document.getElementById("options");
  optionsBox.innerHTML = "";

  const shuffled = [...q.options].sort(() => Math.random() - 0.5);

  shuffled.forEach(opt => {

    const div = document.createElement("div");
    div.className = "option";

    div.innerHTML = `
  <span class="option-text">${opt}</span>
  <div class="circle"></div>
`;

    if (answers[q.id] === opt) {
      div.classList.add("selected");
    }

    div.onclick = () => {

      answers[q.id] = opt;

      document.querySelectorAll(".option")
        .forEach(o => o.classList.remove("selected"));

      div.classList.add("selected");
    };

    optionsBox.appendChild(div);
  });
  const nextBtn = document.getElementById("next");

if (index >= questions.length - 1) {
  nextBtn.style.display = "none";
} else {
  nextBtn.style.display = "block";
}
const prevBtn = document.getElementById("prev");

if (index <= 0) {
  prevBtn.style.opacity = "0.4";
} else {
  prevBtn.style.opacity = "1";
}
}

// ---------------- NAV ----------------
document.getElementById("next").onclick = () => {
  if (index < questions.length - 1) {
    index++;
    loadQuestion();
  }
};

document.getElementById("prev").onclick = () => {
  if (index > 0) {
    index--;
    loadQuestion();
  }
};

// ---------------- TIMER ----------------
function startTimer() {

  currentTime = time;
  const timerEl = document.getElementById("timer-value");

  timerInterval = setInterval(() => {

    currentTime--;

    if (currentTime <= 10) {
      timerEl.classList.add("red");
    }

    timerEl.textContent = currentTime;

    if (currentTime <= 0) {
      clearInterval(timerInterval);
      submitQuiz();
    }

  }, 1000);
}

// ---------------- SUBMIT ----------------
document.getElementById("submit-btn").onclick = submitQuiz;

function submitQuiz() {

  if (submitting) return;

  submitting = true;

  clearInterval(timerInterval);

  let score = 0;
  let xpEarned = 0;

  questions.forEach(q => {

    const userAnswer = answers[q.id];

    if (userAnswer === q.answer) {
      score++;

      // ✅ use backend XP per question
      xpEarned += q.xp_reward || 10;
    }
  });

  const percent = Math.round((score / questions.length) * 100);

// ---------------- REVIEW DATA ----------------
const review = [];

questions.forEach(q => {

  const userAnswer = answers[q.id] || null;

  review.push({
    question: q.question,
    options: q.options,
    correct: q.answer,
    selected: userAnswer,
    explanation: q.explanation
  });

});

// ---------------- SAVE RESULT ----------------

const result = {

  id: "R" + Date.now(),

  school: "EBSU",

  course: studying
    ? studying.replace("(quiz)", "")
              .replace("(tutorials)", "")
              .trim()
    : "",

  score,
  total: questions.length,
  xp: xpEarned,
  percent,

  date: new Date().toLocaleString(),

  received: false,
viewed: false,

  review

};

// current result
localStorage.setItem(
  "quizResult",
  JSON.stringify(result)
);

// save to history
const history =
  JSON.parse(
    localStorage.getItem("quizHistory")
  ) || [];

history.unshift(result);

localStorage.setItem(
  "quizHistory",
  JSON.stringify(history)
);

window.location.href = "result.html";
}

// ---------------- HINT ----------------

hintBtn.onclick = () => {

  hintDropdown.classList.toggle("hidden");

};


// ---------------- HINT MODAL ----------------

formulaHint.onclick = () => {

  const q = questions[index];

  if (!q) return;

  hintModalTitle.textContent = "Formula";

  hintModalContent.innerHTML = `
    <div class="hint-formula">
      ${q.formula || "No formula available for this question."}
    </div>
  `;

  hintModal.classList.remove("hidden");

  hintDropdown.classList.add("hidden");
};


explanationHint.onclick = () => {

  const q = questions[index];

  if (!q) return;

  hintModalTitle.textContent = "Explanation";

  hintModalContent.innerHTML = `
    <div class="hint-explanation">
      ${q.explanation || "No explanation available for this question."}
    </div>
  `;

  hintModal.classList.remove("hidden");

  hintDropdown.classList.add("hidden");
};

// ---------------- EXTRA TIME HINT ----------------

timeHint.onclick = () => {

  // Add 10 seconds
  currentTime += 10;

  // Update timer immediately
  timerValue.textContent = currentTime;

  // Remove red warning if we now have more than 10 seconds
  if (currentTime > 10) {
    timerValue.classList.remove("red");
  }

  // Show +10 sec indicator
  extraTimeIndicator.classList.remove("show");

  // Force animation to restart
  void extraTimeIndicator.offsetWidth;

  extraTimeIndicator.textContent = "+10 sec";

  extraTimeIndicator.classList.add("show");

  // Hide dropdown
  hintDropdown.classList.add("hidden");

  // Remove indicator after a short delay
  setTimeout(() => {

    extraTimeIndicator.classList.remove("show");

  }, 2500);

};

// CLOSE BUTTON

hintClose.onclick = () => {

  hintModal.classList.add("hidden");

};

});
/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — app.js
   Stage logic, state, UI orchestration
───────────────────────────────────────── */

const App = (() => {

  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    concept:        "",
    background:     "",
    goal:           "",
    priorKnowledge: "",
    gapAnalysis:    "",
    explanation:    "",
    stressQuestions:[],
    stressAnswers:  [],
    stressResult:   "",
    finalTeachBack: "",
    score:          0,
    currentStage:   0,
  };

  const TOTAL_STAGES = 6;

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    requestAnimationFrame(() => {
      const s = document.getElementById("stage-0");
      if (s) {
        s.classList.add("active");
        setTimeout(() => s.classList.add("visible"), 30);
      }
    });
  }

  // ── Stage Navigation ───────────────────────────────────────────────────────
  function goToStage(n) {
    const current = document.querySelector(".stage.active");
    if (current) {
      current.classList.remove("visible");
      setTimeout(() => {
        current.classList.remove("active");
        showStage(n);
      }, 300);
    } else {
      showStage(n);
    }
    state.currentStage = n;
    updateProgress(n);
  }

  function showStage(n) {
    const next = document.getElementById(`stage-${n}`);
    if (!next) return;
    next.classList.add("active");
    next.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => next.classList.add("visible"), 30);
  }

  function updateProgress(stage) {
    const wrap  = document.getElementById("progressWrap");
    const bar   = document.getElementById("progressBar");
    const label = document.getElementById("progressLabel");

    if (stage === 0) {
      wrap.style.display = "none";
      return;
    }

    wrap.style.display = "flex";
    const pct = Math.round((stage / TOTAL_STAGES) * 100);
    bar.style.setProperty("--progress", `${pct}%`);
    label.textContent = `Stage ${stage} of ${TOTAL_STAGES}`;
  }

  // ── Stage 0 → 1 ───────────────────────────────────────────────────────────
  function start() {
    goToStage(1);
  }

  // ── Stage 1 → 2 ───────────────────────────────────────────────────────────
  function goToStage2() {
    const concept    = document.getElementById("conceptInput").value.trim();
    const background = document.getElementById("backgroundInput").value.trim();
    const goal       = document.getElementById("goalInput").value.trim();

    if (!concept)    { shakeInput("conceptInput");    return; }
    if (!background) { shakeInput("backgroundInput"); return; }
    if (!goal)       { shakeInput("goalInput");       return; }

    state.concept    = concept;
    state.background = background;
    state.goal       = goal;

    document.getElementById("conceptDisplay").textContent  = concept;
    document.getElementById("conceptDisplay2").textContent = concept;

    goToStage(2);
  }

  // ── Stage 2 → 3: Analyze Gaps ─────────────────────────────────────────────
  function analyzeGaps() {
    const prior = document.getElementById("priorKnowledgeInput").value.trim();
    if (prior.length < 30) {
      shakeInput("priorKnowledgeInput");
      showInputHint("priorKnowledgeInput", "Write a bit more — at least a few sentences.");
      return;
    }
    state.priorKnowledge = prior;

    goToStage(3);

    AI.analyzeGaps({
      concept:        state.concept,
      background:     state.background,
      goal:           state.goal,
      priorKnowledge: state.priorKnowledge
    })
    .then(html => {
      state.gapAnalysis = html;
      showAIResult("gapLoading", "gapContent", html);
      document.getElementById("gapBtns").style.display = "flex";
    })
    .catch(err => handleError(err, "gapLoading"));
  }

  // ── Stage 3 → 4: Explain ──────────────────────────────────────────────────
  function explainConcept() {
    goToStage(4);

    AI.explainConcept({
      concept:        state.concept,
      background:     state.background,
      goal:           state.goal,
      gapAnalysis:    state.gapAnalysis,
      priorKnowledge: state.priorKnowledge
    })
    .then(html => {
      state.explanation = html;
      showAIResult("explanationLoading", "explanationContent", html);
      document.getElementById("explanationBtns").style.display = "flex";
    })
    .catch(err => handleError(err, "explanationLoading"));
  }

  // ── Stage 4 → 5: Stress Test ──────────────────────────────────────────────
  function stressTest() {
    goToStage(5);

    AI.generateStressTest({
      concept:     state.concept,
      background:  state.background,
      gapAnalysis: state.gapAnalysis
    })
    .then(questions => {
      state.stressQuestions = questions;
      renderStressQuestions(questions);
    })
    .catch(err => handleError(err, "stressLoading"));
  }

  function renderStressQuestions(questions) {
    const loading = document.getElementById("stressLoading");
    const wrap    = document.getElementById("stressQuestions");

    loading.style.display = "none";
    wrap.style.display    = "block";

    wrap.innerHTML = questions.map((q, i) => `
      <div class="stress-question">
        <div class="stress-q-number">Question ${q.id} — ${q.type}</div>
        <div class="stress-q-text">${q.question}</div>
        <textarea
          class="stress-q-input"
          id="stress-answer-${i}"
          placeholder="Your answer..."
          rows="3"
        ></textarea>
      </div>
    `).join("");

    document.getElementById("stressBtns").style.display = "flex";
  }

  // ── Stage 5 → 6: Evaluate Stress Test ────────────────────────────────────
  function evaluateStressTest() {
    const answers = state.stressQuestions.map((_, i) => {
      const el = document.getElementById(`stress-answer-${i}`);
      return el ? el.value.trim() : "";
    });

    const allEmpty = answers.every(a => a === "");
    if (allEmpty) {
      showToast("Answer at least one question before submitting.");
      return;
    }

    state.stressAnswers = answers;
    goToStage(6);

    const resultCard = document.getElementById("stressResultCard");
    const teachGroup = document.getElementById("finalTeachGroup");
    const teachBtns  = document.getElementById("finalTeachBtns");
    const scoreWrap  = document.getElementById("scoreResultWrap");

    resultCard.style.display = "block";
    teachGroup.style.display = "none";
    teachBtns.style.display  = "none";
    scoreWrap.style.display  = "none";

    resultCard.innerHTML = `
      <div class="ai-loading">
        <div class="loading-dots"><span></span><span></span><span></span></div>
        <p>Evaluating your stress test answers...</p>
      </div>
    `;

    AI.evaluateStressTest({
      concept:   state.concept,
      questions: state.stressQuestions,
      answers:   state.stressAnswers
    })
    .then(html => {
      state.stressResult = html;
      resultCard.innerHTML = `<div class="ai-content">${html}</div>`;
      teachGroup.style.display = "block";
      teachBtns.style.display  = "flex";
      teachGroup.scrollIntoView({ behavior: "smooth", block: "start" });
    })
    .catch(err => {
      resultCard.innerHTML = `<div class="ai-content" style="color:#ff6b6b">
        Error loading evaluation: ${err.message}
      </div>`;
      teachGroup.style.display = "block";
      teachBtns.style.display  = "flex";
    });
  }

  // ── Score Final Teach-Back ─────────────────────────────────────────────────
  function scoreFinalTeachBack() {
    const final = document.getElementById("finalTeachInput").value.trim();
    if (final.length < 40) {
      shakeInput("finalTeachInput");
      showInputHint("finalTeachInput", "Write more — really explain it as if teaching someone.");
      return;
    }
    state.finalTeachBack = final;

    const scoreWrap   = document.getElementById("scoreResultWrap");
    const scoreLoad   = document.getElementById("scoreLoading");
    const scoreResult = document.getElementById("scoreResult");

    scoreWrap.style.display   = "block";
    scoreLoad.style.display   = "flex";
    scoreResult.style.display = "none";
    scoreWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    AI.scoreFinalTeachBack({
      concept:        state.concept,
      background:     state.background,
      finalTeachBack: state.finalTeachBack,
      gapAnalysis:    state.gapAnalysis
    })
    .then(result => {
      state.score = result.score;
      scoreLoad.style.display   = "none";
      scoreResult.style.display = "block";

      animateScore(result.score);
      document.getElementById("scoreLabel").textContent    = result.label;
      document.getElementById("scoreFeedback").innerHTML   = AI.renderText(result.feedback);

      const numEl = document.getElementById("scoreNumber");
      if      (result.score >= 90) numEl.style.color = "#00d4c8";
      else if (result.score >= 75) numEl.style.color = "#e8b84b";
      else if (result.score >= 60) numEl.style.color = "#a0c878";
      else if (result.score >= 40) numEl.style.color = "#f0a050";
      else                          numEl.style.color = "#ff6b6b";
    })
    .catch(err => {
      scoreLoad.style.display = "none";
      scoreWrap.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem">
        Error scoring: ${err.message}
      </p>`;
    });
  }

  function animateScore(target) {
    const el = document.getElementById("scoreNumber");
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 30);
  }

  // ── Stage 7: Artifacts ────────────────────────────────────────────────────
  function goToArtifacts() {
    goToStage(7);
  }

  function selectArtifact(type) {
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));
    document.querySelector(`[data-artifact="${type}"]`).classList.add("selected");

    const outputWrap  = document.getElementById("artifactOutputWrap");
    const loading     = document.getElementById("artifactLoading");
    const output      = document.getElementById("artifactOutput");
    const loadingText = document.getElementById("artifactLoadingText");

    const labels = {
      mindmap:    "Building your concept map...",
      infographic:"Designing your infographic...",
      flashcards: "Generating your flashcard set...",
      slides:     "Creating your slide deck...",
      explainer:  "Writing your explainer article...",
      quiz:       "Building your quiz..."
    };

    outputWrap.style.display = "block";
    loading.style.display    = "flex";
    output.style.display     = "none";
    loadingText.textContent  = labels[type] || "Generating...";
    outputWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    AI.generateArtifact({
      type,
      concept:        state.concept,
      background:     state.background,
      explanation:    state.explanation,
      gapAnalysis:    state.gapAnalysis,
      finalTeachBack: state.finalTeachBack,
      score:          state.score
    })
    .then(html => {
      loading.style.display = "none";
      output.style.display  = "block";
      output.innerHTML      = html;
    })
    .catch(err => {
      loading.style.display = "none";
      output.style.display  = "block";
      output.innerHTML = `<p style="color:#ff6b6b">Error generating artifact: ${err.message}</p>`;
    });
  }

  // ── Restart ───────────────────────────────────────────────────────────────
  function restart() {
    Object.assign(state, {
      concept:"", background:"", goal:"", priorKnowledge:"",
      gapAnalysis:"", explanation:"", stressQuestions:[],
      stressAnswers:[], stressResult:"", finalTeachBack:"", score:0, currentStage:0
    });

    ["conceptInput","backgroundInput","goalInput","priorKnowledgeInput","finalTeachInput"]
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });

    resetAICard("gapLoading",         "gapContent");
    resetAICard("explanationLoading", "explanationContent");
    resetAICard("stressLoading",      "stressQuestions");

    document.getElementById("gapBtns").style.display          = "none";
    document.getElementById("explanationBtns").style.display  = "none";
    document.getElementById("stressBtns").style.display       = "none";
    document.getElementById("stressResultCard").style.display = "none";
    document.getElementById("scoreResultWrap").style.display  = "none";
    document.getElementById("artifactOutputWrap").style.display = "none";
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));

    goToStage(0);
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
  function showAIResult(loadingId, contentId, html) {
    const loading = document.getElementById(loadingId);
    const content = document.getElementById(contentId);
    loading.style.display = "none";
    content.style.display = "block";
    content.innerHTML     = html;
  }

  function resetAICard(loadingId, contentId) {
    const loading = document.getElementById(loadingId);
    const content = document.getElementById(contentId);
    if (loading) { loading.style.display = "flex"; }
    if (content) { content.style.display = "none"; content.innerHTML = ""; }
  }

  function shakeInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = "none";
    el.offsetHeight;
    el.style.animation = "shake 0.4s ease";
    el.focus();
    setTimeout(() => el.style.animation = "", 400);
  }

  function showInputHint(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    let hint = el.nextElementSibling;
    if (!hint || !hint.classList.contains("input-error")) {
      hint = document.createElement("p");
      hint.className = "input-error";
      hint.style.cssText = "color:#ff6b6b;font-size:0.78rem;margin-top:0.3rem;font-family:var(--font-mono)";
      el.parentNode.insertBefore(hint, el.nextSibling);
    }
    hint.textContent = msg;
    setTimeout(() => { if (hint.parentNode) hint.parentNode.removeChild(hint); }, 3000);
  }

  function showToast(msg) {
    let toast = document.getElementById("ua-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "ua-toast";
      toast.style.cssText = `
        position:fixed; bottom:2rem; left:50%; transform:translateX(-50%);
        background:#1a2030; border:1px solid var(--border); border-radius:8px;
        padding:0.75rem 1.4rem; font-family:var(--font-mono); font-size:0.82rem;
        color:var(--text); z-index:300; box-shadow:0 8px 30px rgba(0,0,0,0.5);
        transition:opacity 0.3s ease;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent    = msg;
    toast.style.opacity  = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 2500);
  }

  function handleError(err, loadingId) {
    const loading = document.getElementById(loadingId);
    if (loading) {
      loading.innerHTML = `
        <p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem;text-align:center">
          Error: ${err.message}
        </p>
      `;
    }
  }

  // ── Inject shake animation ─────────────────────────────────────────────────
  const shakeStyle = document.createElement("style");
  shakeStyle.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20%      { transform: translateX(-8px); }
      40%      { transform: translateX(8px); }
      60%      { transform: translateX(-5px); }
      80%      { transform: translateX(5px); }
    }
  `;
  document.head.appendChild(shakeStyle);

  // ── Boot ───────────────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", init);

  // ── Public ────────────────────────────────────────────────────────────────
  return {
    start, goToStage, goToStage2,
    analyzeGaps, explainConcept, stressTest,
    evaluateStressTest, scoreFinalTeachBack,
    goToArtifacts, selectArtifact, restart
  };

})();
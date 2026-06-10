/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — app.js v4
   Changes: ONLY Bug Fixes (Error intercepts, Image crop fix, PDF fixes)
───────────────────────────────────────── */

const App = (() => {

  const state = {
    concept:             "",
    background:          "",
    goal:                "",
    priorQuiz:           [],
    priorAnswers:        [],
    gapAnalysis:         "",
    explanation:         "",
    stressQuestions:     [],
    stressAnswers:       [],
    stressResult:        "",
    finalTeachBack:      "",
    score:               0,
    currentStage:        0,
    currentArtifactType: null,
    flashcardData:       null,
    quizData:            null,
    quizAnswered:        [],
    quizCorrect:         0,
  };

  const TOTAL_STAGES = 6;

  function init() {
    requestAnimationFrame(() => {
      const s = document.getElementById("stage-0");
      if (s) { s.classList.add("active"); setTimeout(() => s.classList.add("visible"), 30); }
    });
  }

  // ── Stage Navigation ───────────────────────────────────────────────────────
  function goToStage(n) {
    const current = document.querySelector(".stage.active");
    if (current) {
      current.classList.remove("visible");
      setTimeout(() => { current.classList.remove("active"); showStage(n); }, 300);
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
    if (stage === 0) { wrap.style.display = "none"; return; }
    wrap.style.display = "flex";
    bar.style.setProperty("--progress", `${Math.round((stage / TOTAL_STAGES) * 100)}%`);
    label.textContent = `Stage ${stage} of ${TOTAL_STAGES}`;
  }

  // ── Stage 0 → 1 ───────────────────────────────────────────────────────────
  function start() { goToStage(1); }

  // ── Stage 1 → 2: Validate + Generate Prior Quiz ───────────────────────────
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

    const cd = document.getElementById("conceptDisplay");
    const cd2 = document.getElementById("conceptDisplay2");
    if (cd)  cd.textContent  = concept;
    if (cd2) cd2.textContent = concept;

    // Reset prior quiz UI
    const pql = document.getElementById("priorQuizLoading");
    const pqw = document.getElementById("priorQuizWrap");
    const pqb = document.getElementById("priorQuizBtns");
    if (pql) { pql.style.display = "flex"; pql.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div><p>Generating your diagnostic quiz...</p>`; }
    if (pqw) { pqw.style.display = "none"; pqw.innerHTML = ""; }
    if (pqb)   pqb.style.display = "none";

    goToStage(2);

    AI.generatePriorQuiz({ concept, background })
      .then(questions => {
        state.priorQuiz    = questions;
        state.priorAnswers = new Array(questions.length).fill(null);
        renderPriorQuiz(questions);
      })
      .catch(err => {
        if (pql) pql.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem;text-align:center">Error generating quiz: ${err.message}</p>`;
      });
  }

  function renderPriorQuiz(questions) {
    const pql = document.getElementById("priorQuizLoading");
    const pqw = document.getElementById("priorQuizWrap");
    const pqb = document.getElementById("priorQuizBtns");
    if (pql) pql.style.display = "none";
    if (pqw) { pqw.style.display = "block"; pqw.innerHTML = questions.map((q, i) => `
      <div class="pq-question" id="pq-${i}">
        <div class="pq-q-num">Question ${i+1} of ${questions.length}</div>
        <div class="pq-q-text">${q.question}</div>
        <div class="pq-options">
          ${q.options.map((opt, oi) => `
            <button class="pq-option" id="pqo-${i}-${oi}" onclick="App.selectPriorOption(${i}, ${oi})">
              <span class="pq-opt-letter">${String.fromCharCode(65+oi)}</span>${opt}
            </button>
          `).join('')}
        </div>
      </div>`).join('');
    }
    if (pqb) pqb.style.display = "flex";
  }

  function selectPriorOption(qi, oi) {
    for (let i = 0; i < (state.priorQuiz[qi]?.options?.length || 4); i++) {
      document.getElementById(`pqo-${qi}-${i}`)?.classList.remove('selected');
    }
    document.getElementById(`pqo-${qi}-${oi}`)?.classList.add('selected');
    state.priorAnswers[qi] = oi;
  }

  // ── Stage 2 → 3: Submit + Analyze Gaps ────────────────────────────────────
  function submitPriorQuiz() {
    if (state.priorAnswers.filter(a => a !== null).length === 0) {
      showToast("Answer at least one question to continue.");
      return;
    }
    goToStage(3);
    AI.analyzeGaps({
      concept:      state.concept,
      background:   state.background,
      goal:         state.goal,
      priorQuiz:    state.priorQuiz,
      priorAnswers: state.priorAnswers
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
      concept:      state.concept,
      background:   state.background,
      goal:         state.goal,
      gapAnalysis:  state.gapAnalysis,
      priorQuiz:    state.priorQuiz,
      priorAnswers: state.priorAnswers
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
    document.getElementById("stressLoading").style.display = "none";
    const wrap = document.getElementById("stressQuestions");
    wrap.style.display = "block";
    wrap.innerHTML = questions.map((q, i) => `
      <div class="stress-question">
        <div class="stress-q-number">Question ${q.id} — ${q.type}</div>
        <div class="stress-q-text">${q.question}</div>
        <textarea class="stress-q-input" id="stress-answer-${i}" placeholder="Your answer..." rows="3"></textarea>
      </div>`).join('');
    document.getElementById("stressBtns").style.display = "flex";
  }

  // ── Stage 5 → 6: Evaluate ─────────────────────────────────────────────────
  function evaluateStressTest() {
    const answers = state.stressQuestions.map((_, i) => {
      const el = document.getElementById(`stress-answer-${i}`);
      return el ? el.value.trim() : "";
    });
    if (answers.every(a => a === "")) { showToast("Answer at least one question before submitting."); return; }
    state.stressAnswers = answers;

    goToStage(6);

    const resultCard = document.getElementById("stressResultCard");
    resultCard.style.display = "block";
    document.getElementById("finalTeachGroup").style.display = "none";
    document.getElementById("finalTeachBtns").style.display  = "none";
    document.getElementById("scoreResultWrap").style.display  = "none";
    resultCard.innerHTML = `<div class="ai-loading"><div class="loading-dots"><span></span><span></span><span></span></div><p>Evaluating your stress test answers...</p></div>`;

    AI.evaluateStressTest({ concept: state.concept, questions: state.stressQuestions, answers: state.stressAnswers })
      .then(html => {
        state.stressResult = html;
        resultCard.innerHTML = `<div class="ai-content">${html}</div>`;
        document.getElementById("finalTeachGroup").style.display = "block";
        document.getElementById("finalTeachBtns").style.display  = "flex";
        document.getElementById("finalTeachGroup").scrollIntoView({ behavior: "smooth", block: "start" });
      })
      .catch(err => {
        resultCard.innerHTML = `<div class="ai-content" style="color:#ff6b6b">Error: ${err.message}</div>`;
        document.getElementById("finalTeachGroup").style.display = "block";
        document.getElementById("finalTeachBtns").style.display  = "flex";
      });
  }

  // ── Score Final Teach-Back ─────────────────────────────────────────────────
  function scoreFinalTeachBack() {
    const final = document.getElementById("finalTeachInput").value.trim();
    if (final.length < 40) { shakeInput("finalTeachInput"); showInputHint("finalTeachInput", "Write more — explain it as if teaching someone."); return; }
    state.finalTeachBack = final;

    const scoreWrap   = document.getElementById("scoreResultWrap");
    const scoreLoad   = document.getElementById("scoreLoading");
    const scoreResult = document.getElementById("scoreResult");
    scoreWrap.style.display = "block"; scoreLoad.style.display = "flex"; scoreResult.style.display = "none";
    scoreWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    AI.scoreFinalTeachBack({ concept: state.concept, background: state.background, finalTeachBack: state.finalTeachBack, gapAnalysis: state.gapAnalysis })
      .then(result => {
        state.score = result.score;
        scoreLoad.style.display = "none"; scoreResult.style.display = "block";
        animateScore(result.score);
        document.getElementById("scoreLabel").textContent  = result.label;
        document.getElementById("scoreFeedback").innerHTML = AI.renderText(result.feedback);
        const numEl = document.getElementById("scoreNumber");
        if      (result.score >= 90) numEl.style.color = "#00d4c8";
        else if (result.score >= 75) numEl.style.color = "#e8b84b";
        else if (result.score >= 60) numEl.style.color = "#a0c878";
        else if (result.score >= 40) numEl.style.color = "#f0a050";
        else                          numEl.style.color = "#ff6b6b";
      })
      .catch(err => {
        scoreLoad.style.display = "none";
        scoreWrap.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem">Error: ${err.message}</p>`;
      });
  }

  function animateScore(target) {
    const el = document.getElementById("scoreNumber");
    let current = 0;
    const step = Math.ceil(target / 40);
    const timer = setInterval(() => { current = Math.min(current + step, target); el.textContent = current; if (current >= target) clearInterval(timer); }, 30);
  }

  // ── Stage 7: Artifacts ────────────────────────────────────────────────────
  function goToArtifacts() { goToStage(7); }

  function selectArtifact(type) {
    state.currentArtifactType = type;
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));
    document.querySelector(`[data-artifact="${type}"]`)?.classList.add("selected");

    const outputWrap  = document.getElementById("artifactOutputWrap");
    const loading     = document.getElementById("artifactLoading");
    const output      = document.getElementById("artifactOutput");
    const loadingText = document.getElementById("artifactLoadingText");

    const labels = { mindmap:"Building your concept map...", infographic:"Designing your infographic...", flashcards:"Generating your flashcard set...", slides:"Creating your slide deck...", explainer:"Writing your explainer article...", quiz:"Building your quiz..." };

    outputWrap.style.display = "block"; loading.style.display = "flex";
    output.style.display = "none"; output.innerHTML = "";
    loadingText.textContent = labels[type] || "Generating...";
    outputWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    AI.generateArtifact({ type, concept: state.concept, background: state.background, explanation: state.explanation, gapAnalysis: state.gapAnalysis, finalTeachBack: state.finalTeachBack, score: state.score })
      .then(result => {
        loading.style.display = "none";
        if (result.type === 'json') {
          if (result.subtype === 'flashcards') renderFlashcards(result.data);
          else if (result.subtype === 'quiz')  renderArtifactQuiz(result.data);
        } else {
          output.style.display = "block";
          const dlLabel = (type === 'slides' || type === 'explainer') ? '⬇ Download PDF' : '⬇ Download as Image (PNG)';
          output.innerHTML = result.data + `<div class="download-bar"><button class="btn-download" onclick="App.downloadArtifact()">${dlLabel}</button></div>`;
        }
      })
      // .catch(err => {
      //   loading.style.display = "none"; output.style.display = "block";
      //   output.innerHTML = `<p style="color:#ff6b6b">Error generating artifact: ${err.message}</p>`;
      // });
      .catch(err => {
        loading.style.display = "none"; output.style.display = "block";
        handleError(err, "artifactOutput");
      });
  }

  // ── Flashcard Renderer ─────────────────────────────────────────────────────
  function renderFlashcards(data) {
    state.flashcardData = data;
    const output = document.getElementById("artifactOutput");
    output.style.display = "block";
    output.innerHTML = `
      <div style="margin-bottom:1.2rem">
        <h2 style="font-family:var(--font-display);color:var(--gold);font-size:1.5rem;margin-bottom:0.3rem">Flashcards: ${state.concept}</h2>
        <p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim)">Click any card to flip it and reveal the answer</p>
      </div>
      <div class="flashcard-grid">
        ${data.map((card, i) => `
          <div class="flip-card" onclick="this.classList.toggle('flipped')">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <div class="flip-card-label">Card ${i+1}</div>
                <p>${card.front}</p>
              </div>
              <div class="flip-card-back">
                <div class="flip-card-label">Answer</div>
                <p>${card.back}</p>
              </div>
            </div>
          </div>`).join('')}
      </div>
      <div class="download-bar">
        <button class="btn-download" onclick="App.downloadArtifact()">⬇ Download Flashcards (PDF)</button>
      </div>`;
  }

  // ── Quiz Renderer ──────────────────────────────────────────────────────────
  function renderArtifactQuiz(data) {
    state.quizData    = data;
    state.quizAnswered = new Array(data.questions.length).fill(null);
    state.quizCorrect  = 0;
    const output = document.getElementById("artifactOutput");
    output.style.display = "block";
    output.innerHTML = `
      <div class="quiz-header">
        <h2 style="font-family:var(--font-display);color:var(--gold);font-size:1.4rem">${data.title}</h2>
        <div class="quiz-progress" id="quizProgress">0/${data.questions.length} answered</div>
      </div>
      ${data.questions.map((q, qi) => `
        <div class="quiz-question" id="qq-${qi}">
          <div class="quiz-q-num">Question ${qi+1} of ${data.questions.length}</div>
          <div class="quiz-q-text">${q.question}</div>
          <div class="quiz-options" id="qopts-${qi}">
            ${q.options.map((opt, oi) => `
              <button class="quiz-option" id="qo-${qi}-${oi}" onclick="App.answerQuizOption(${qi},${oi},${q.correct})">
                <span class="quiz-opt-letter">${String.fromCharCode(65+oi)}</span>${opt}
              </button>`).join('')}
          </div>
          <div class="quiz-explanation" id="qe-${qi}" style="display:none">💡 ${q.explanation}</div>
        </div>`).join('')}
      <div class="quiz-final" id="quizFinal" style="display:none">
        <div id="quizFinalScore"></div>
        <button class="btn-download" onclick="App.downloadArtifact()" style="margin-top:1.2rem">⬇ Download Quiz + Answers (PDF)</button>
      </div>`;
  }

  function answerQuizOption(qi, oi, correct) {
    if (state.quizAnswered[qi] !== null) return;
    state.quizAnswered[qi] = oi; // Storing the index so PDF knows what was picked
    if (oi === correct) state.quizCorrect++;

    document.querySelectorAll(`#qopts-${qi} .quiz-option`).forEach((btn, i) => {
      btn.disabled = true;
      if (i === correct) btn.classList.add('correct');
      if (i === oi && oi !== correct) {
        btn.classList.add('wrong');
        btn.classList.add('shake'); // Shake class added here
      }
    });
    document.getElementById(`qe-${qi}`).style.display = "block";

    const answeredCount = state.quizAnswered.filter(a => a !== null).length;
    const total = state.quizData.questions.length;
    document.getElementById("quizProgress").textContent = `${answeredCount}/${total} answered — ${state.quizCorrect} correct`;

    if (answeredCount === total) {
      const final = document.getElementById("quizFinal");
      final.style.display = "block";
      const pct = state.quizCorrect / total;
      const label = pct >= 0.9 ? '🏆 Mastery' : pct >= 0.7 ? '⭐ Strong' : pct >= 0.5 ? '📈 Getting there' : '📚 Keep studying';
      document.getElementById("quizFinalScore").innerHTML = `
        <span style="font-size:3rem;font-family:var(--font-display);color:var(--gold);font-weight:900">${state.quizCorrect}</span>
        <span style="font-size:1.5rem;color:var(--text-dim)">/${total}</span>
        <span style="font-family:var(--font-mono);color:var(--teal);font-size:1rem;margin-left:1rem">${label}</span>`;
      final.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ── Downloads (UPDATED FOR FIXES) ─────────────────────────────────────────
  function downloadArtifact() {
    const type = state.currentArtifactType;
    
    // 1. Hide the download bar so it doesn't get captured
    const downloadBar = document.querySelector('.download-bar');
    if (downloadBar) downloadBar.style.display = 'none';

    // 2. Temporarily remove max-height so image captures full scroll height
    const out = document.getElementById("artifactOutput");
    const oldMaxHeight = out.style.maxHeight;
    const oldOverflow = out.style.overflow;
    out.style.maxHeight = 'none';
    out.style.overflow = 'visible';

    // Helper to restore UI after generation
    const restoreUI = () => {
      if (downloadBar) downloadBar.style.display = 'flex';
      out.style.maxHeight = oldMaxHeight;
      out.style.overflow = oldOverflow;
    };

    if (type === 'mindmap' || type === 'infographic') {
      if (!window.html2canvas) { showToast("Image library not loaded. Please refresh."); restoreUI(); return; }
      showToast("Capturing image...");
      html2canvas(out, { backgroundColor: '#0d1220', scale: 2, useCORS: true })
        .then(canvas => {
          const a = document.createElement('a');
          a.download = `${state.concept.replace(/\s+/g,'-')}-${type}.png`;
          a.href = canvas.toDataURL('image/png');
          a.click();
          showToast("Image saved!");
          restoreUI();
        })
        .catch(() => {
          showToast("Couldn't capture — try right-click > Save.");
          restoreUI();
        });

    } else if (type === 'flashcards' && state.flashcardData) {
      downloadFlashcardsPDF();
      restoreUI();
    } else if (type === 'quiz' && state.quizData) {
      downloadQuizPDF();
      restoreUI();
    } else if (type === 'slides' || type === 'explainer') {
      // 3. Slides and Explainer now export cleanly to PDF using html2canvas + jsPDF
      if (!window.jspdf?.jsPDF || !window.html2canvas) { 
         showToast("PDF libraries not loaded. Please refresh."); 
         restoreUI(); 
         return; 
      }
      showToast(`Generating ${type} PDF...`);
      html2canvas(out, { backgroundColor: '#0d1220', scale: 2, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const { jsPDF } = window.jspdf;
        const orientation = type === 'slides' ? 'landscape' : 'portrait';
        const doc = new jsPDF({ orientation, unit: 'mm' });
        
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        doc.save(`${state.concept.replace(/\s+/g,'-')}-${type}.pdf`);
        showToast("PDF saved!");
        restoreUI();
      }).catch(() => {
         showToast("Failed to generate PDF.");
         restoreUI();
      });
    }
  }

  function downloadFlashcardsPDF() {
    if (!window.jspdf?.jsPDF) { showToast("PDF library not loaded. Please refresh."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const cards = state.flashcardData;
    const margin = 15;
    let y = 20;

    doc.setFontSize(16);
    doc.text(`Flashcards: ${state.concept}`, margin, y);
    y += 15;

    cards.forEach((card, i) => {
      doc.setFontSize(11);
      const qLines = doc.splitTextToSize(`Q: ${card.front}`, 180);
      const aLines = doc.splitTextToSize(`A: ${card.back}`, 180);
      const blockHeight = (qLines.length + aLines.length) * 6 + 10;

      if (y + blockHeight > 280) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(qLines, margin, y);
      y += qLines.length * 6;

      doc.setFont("helvetica", "normal");
      doc.text(aLines, margin, y);
      y += aLines.length * 6 + 8;
    });
    doc.save(`${state.concept.replace(/\s+/g,'-')}-flashcards.pdf`);
    showToast("Flashcards PDF saved!");
  }

  function downloadQuizPDF() {
    if (!window.jspdf?.jsPDF) { showToast("PDF library not loaded. Please refresh."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const qd = state.quizData;
    const margin = 15;
    let y = 20;

    doc.setFontSize(16);
    doc.text(qd.title || `Quiz: ${state.concept}`, margin, y);
    y += 15;

    doc.setFontSize(11);
    qd.questions.forEach((q, qi) => {
      const isAnswered = state.quizAnswered[qi] !== null;
      const correctStatus = isAnswered 
        ? (state.quizAnswered[qi] === q.correct ? " [Correct]" : " [Wrong]")
        : "";

      const qLines = doc.splitTextToSize(`${qi + 1}. ${q.question}${correctStatus}`, 180);
      let blockHeight = qLines.length * 6 + (q.options.length * 6) + 15;
      if (isAnswered) {
        const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, 170);
        blockHeight += expLines.length * 6 + 5;
      }

      if (y + blockHeight > 280) {
        doc.addPage();
        y = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.text(qLines, margin, y);
      y += qLines.length * 6;

      doc.setFont("helvetica", "normal");
      q.options.forEach((opt, oi) => {
        let mark = "[ ]";
        if (isAnswered) {
          if (oi === q.correct) mark = "[X]"; 
          else if (oi === state.quizAnswered[qi]) mark = "[~]"; 
        }
        const optLines = doc.splitTextToSize(`${mark} ${String.fromCharCode(65+oi)}. ${opt}`, 170);
        doc.text(optLines, margin + 5, y);
        y += optLines.length * 6;
      });

      if (isAnswered) {
        y += 5;
        doc.setFont("helvetica", "italic");
        const expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, 170);
        doc.text(expLines, margin + 5, y);
        y += expLines.length * 6;
      }
      y += 10;
    });
    doc.save(`${state.concept.replace(/\s+/g,'-')}-quiz.pdf`);
    showToast("Quiz PDF saved!");
  }

  // ── Restart ───────────────────────────────────────────────────────────────
  function restart() {
    Object.assign(state, {
      concept:"", background:"", goal:"", priorQuiz:[], priorAnswers:[],
      gapAnalysis:"", explanation:"", stressQuestions:[], stressAnswers:[],
      stressResult:"", finalTeachBack:"", score:0, currentStage:0,
      currentArtifactType:null, flashcardData:null, quizData:null, quizAnswered:[], quizCorrect:0
    });

    ["conceptInput","backgroundInput","goalInput","finalTeachInput"]
      .forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });

    const pql = document.getElementById("priorQuizLoading");
    const pqw = document.getElementById("priorQuizWrap");
    const pqb = document.getElementById("priorQuizBtns");
    if (pql) { pql.style.display = "flex"; pql.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div><p>Generating your diagnostic quiz...</p>`; }
    if (pqw) { pqw.style.display = "none"; pqw.innerHTML = ""; }
    if (pqb)   pqb.style.display = "none";

    resetAICard("gapLoading","gapContent");
    resetAICard("explanationLoading","explanationContent");
    const sl = document.getElementById("stressLoading");
    const sq = document.getElementById("stressQuestions");
    if (sl) sl.style.display = "flex";
    if (sq) { sq.style.display = "none"; sq.innerHTML = ""; }

    ["gapBtns","explanationBtns","stressBtns"].forEach(id => {
      const el = document.getElementById(id); if(el) el.style.display = "none";
    });
    const src = document.getElementById("stressResultCard");
    const swr = document.getElementById("scoreResultWrap");
    const aow = document.getElementById("artifactOutputWrap");
    const ao  = document.getElementById("artifactOutput");
    if (src) src.style.display = "none";
    if (swr) swr.style.display = "none";
    if (aow) aow.style.display = "none";
    if (ao)  ao.innerHTML = "";
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));

    goToStage(0);
  }

  // ── UI Helpers ────────────────────────────────────────────────────────────
  function showAIResult(loadingId, contentId, html) {
    document.getElementById(loadingId).style.display = "none";
    const c = document.getElementById(contentId);
    c.style.display = "block"; c.innerHTML = html;
  }

  function resetAICard(loadingId, contentId) {
    const l = document.getElementById(loadingId);
    const c = document.getElementById(contentId);
    if (l) l.style.display = "flex";
    if (c) { c.style.display = "none"; c.innerHTML = ""; }
  }

  function shakeInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = "none"; el.offsetHeight;
    el.style.animation = "shake 0.4s ease"; el.focus();
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

  // Ensure handleError is updated at bottom as well
  function handleError(err, loadingId) {
    const el = document.getElementById(loadingId);
    if (!el) return;
    let msg = err.message || "Unknown error";
    if (msg.includes("Quota exceeded") || msg.includes("limit: 0")) {
      msg = "API Quota Exceeded. Please verify your model is set to a free-tier limit.";
    } else if (msg.length > 150) {
      msg = msg.substring(0, 150) + "..."; 
    }
    el.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem;text-align:center">Error: ${msg}</p>`;
  }

  document.addEventListener("DOMContentLoaded", init);

  // EXACTLY matching original exports
  return {
    start, goToStage, goToStage2,
    selectPriorOption, submitPriorQuiz,
    explainConcept, stressTest,
    evaluateStressTest, scoreFinalTeachBack,
    goToArtifacts, selectArtifact,
    answerQuizOption, downloadArtifact, restart
  };

})();
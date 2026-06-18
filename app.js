/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — app.js (FINAL NATIVE PDF FIX)
   Changes: Native jsPDF rendering, CSS injection protection
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
    const targets = ['slides', 'explainer', 'flashcards', 'quiz'];
    targets.forEach(type => {
      const el = document.querySelector(`[data-artifact="${type}"] .artifact-desc`);
      if (el && el.textContent.includes("HTML")) {
        el.textContent = el.textContent.replace("HTML", "PDF");
      }
    });

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

  // ── Core App Flow ─────────────────────────────────────────────────────────
  function start() { goToStage(1); }

  function goToStage2() {
    const concept    = document.getElementById("conceptInput").value.trim();
    const background = document.getElementById("backgroundInput").value.trim();
    const goal       = document.getElementById("goalInput").value.trim();

    if (!concept)    { shakeInput("conceptInput");    return; }
    if (!background) { shakeInput("backgroundInput"); return; }
    if (!goal)       { shakeInput("goalInput");       return; }

    state.concept = concept; state.background = background; state.goal = goal;

    const cd = document.getElementById("conceptDisplay");
    const cd2 = document.getElementById("conceptDisplay2");
    if (cd) cd.textContent = concept;
    if (cd2) cd2.textContent = concept;

    const pql = document.getElementById("priorQuizLoading");
    const pqw = document.getElementById("priorQuizWrap");
    const pqb = document.getElementById("priorQuizBtns");
    if (pql) { pql.style.display = "flex"; pql.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div><p>Generating your diagnostic quiz...</p>`; }
    if (pqw) { pqw.style.display = "none"; pqw.innerHTML = ""; }
    if (pqb) pqb.style.display = "none";

    goToStage(2);

    AI.generatePriorQuiz({ concept, background })
      .then(questions => {
        state.priorQuiz = questions;
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

  function submitPriorQuiz() {
    if (state.priorAnswers.filter(a => a !== null).length === 0) { showToast("Answer at least one question to continue."); return; }
    goToStage(3);
    AI.analyzeGaps({ concept: state.concept, background: state.background, goal: state.goal, priorQuiz: state.priorQuiz, priorAnswers: state.priorAnswers })
    .then(html => {
      state.gapAnalysis = html;
      showAIResult("gapLoading", "gapContent", html);
      document.getElementById("gapBtns").style.display = "flex";
    })
    .catch(err => handleError(err, "gapLoading"));
  }

  function explainConcept() {
    goToStage(4);
    AI.explainConcept({ concept: state.concept, background: state.background, goal: state.goal, gapAnalysis: state.gapAnalysis, priorQuiz: state.priorQuiz, priorAnswers: state.priorAnswers })
    .then(html => {
      state.explanation = html;
      showAIResult("explanationLoading", "explanationContent", html);
      document.getElementById("explanationBtns").style.display = "flex";
    })
    .catch(err => handleError(err, "explanationLoading"));
  }

  function stressTest() {
    goToStage(5);
    AI.generateStressTest({ concept: state.concept, background: state.background, gapAnalysis: state.gapAnalysis })
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

  function evaluateStressTest() {
    const answers = state.stressQuestions.map((_, i) => { const el = document.getElementById(`stress-answer-${i}`); return el ? el.value.trim() : ""; });
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

  // ── Stage 7: Artifacts (ISOLATED DOM ARCHITECTURE) ────────────────────────
  function goToArtifacts() { goToStage(7); }

  function selectArtifact(type) {
    state.currentArtifactType = type;
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));
    document.querySelector(`[data-artifact="${type}"]`)?.classList.add("selected");

    const outputWrap  = document.getElementById("artifactOutputWrap");
    const loading     = document.getElementById("artifactLoading");
    const output      = document.getElementById("artifactOutput");
    const loadingText = document.getElementById("artifactLoadingText");

    outputWrap.style.minHeight = "400px"; 
    outputWrap.style.display = "block"; 
    loading.style.display = "flex";
    output.style.display = "none"; 
    output.innerHTML = "";
    
    const labels = { mindmap:"Building concept map...", infographic:"Designing infographic...", flashcards:"Generating flashcards...", slides:"Creating slide deck...", explainer:"Writing article...", quiz:"Building quiz..." };
    loadingText.textContent = labels[type] || "Generating...";
    outputWrap.scrollIntoView({ behavior: "smooth", block: "start" });

    AI.generateArtifact({ type, concept: state.concept, background: state.background, explanation: state.explanation, gapAnalysis: state.gapAnalysis, finalTeachBack: state.finalTeachBack, score: state.score })
      .then(result => {
        loading.style.display = "none";
        output.style.display = "block";
        
        let safeHTML = "";
        if (result.type === 'html') {
          // FIX: Strip global CSS tags so the Explainer doesn't hijack the page layout
          safeHTML = result.data.replace(/body\s*\{/g, '#captureZone {').replace(/html\s*\{/g, '#captureZone {');
        }

        output.innerHTML = `
          <div id="captureZone" style="background:var(--bg-2); border-radius:8px; padding:1.5rem; overflow:hidden;">
            ${result.type === 'json' ? '' : safeHTML}
          </div>
          <div class="download-bar" style="margin-top:1.5rem; display:flex; justify-content:flex-end;">
            <button class="btn-download" onclick="App.downloadArtifact()">
              ⬇ Download ${['mindmap', 'infographic'].includes(type) ? 'Image (PNG)' : 'PDF'}
            </button>
          </div>
        `;

        if (result.type === 'json') {
          if (result.subtype === 'flashcards') {
            state.flashcardData = result.data;
            document.getElementById("captureZone").innerHTML = buildFlashcardsHTML(result.data);
          } else if (result.subtype === 'quiz') {
            state.quizData = result.data;
            state.quizAnswered = new Array(result.data.questions.length).fill(null);
            state.quizCorrect = 0;
            document.getElementById("captureZone").innerHTML = buildQuizHTML(result.data);
          }
        }
      })
      .catch(err => {
        loading.style.display = "none"; output.style.display = "block";
        handleError(err, "artifactLoading");
      });
  }

  // ── HTML Builders ──────────────────────────────────────────────────────────
  function buildFlashcardsHTML(data) {
    return `
      <div style="margin-bottom:1.2rem">
        <h2 style="font-family:var(--font-display);color:var(--gold);font-size:1.5rem;margin-bottom:0.3rem">Flashcards: ${state.concept}</h2>
        <p style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim)">Click any card to flip it</p>
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
      </div>`;
  }

  function buildQuizHTML(data) {
    return `
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
          <div class="quiz-explanation hidden" id="qe-${qi}">💡 ${q.explanation}</div>
        </div>`).join('')}
      <div class="quiz-final hidden" id="quizFinal" style="text-align: center; padding: 2rem; background: var(--bg-2); border-radius: 8px; border: 1px solid var(--border); margin-top: 1.5rem;">
        <div id="quizFinalScore"></div>
      </div>`;
  }

  function answerQuizOption(qi, oi, correct) {
    if (state.quizAnswered[qi] !== null) return;
    state.quizAnswered[qi] = oi; 
    if (oi === correct) state.quizCorrect++;

    document.querySelectorAll(`#qopts-${qi} .quiz-option`).forEach((btn, i) => {
      btn.disabled = true;
      if (i === correct) btn.classList.add('correct');
      if (i === oi && oi !== correct) {
        btn.classList.add('wrong');
        btn.classList.add('shake'); 
      }
    });
    
    document.getElementById(`qe-${qi}`).classList.remove('hidden');

    const answeredCount = state.quizAnswered.filter(a => a !== null).length;
    const total = state.quizData.questions.length;
    document.getElementById("quizProgress").textContent = `${answeredCount}/${total} answered — ${state.quizCorrect} correct`;

    if (answeredCount === total) {
      const final = document.getElementById("quizFinal");
      final.classList.remove('hidden');
      const pct = state.quizCorrect / total;
      const label = pct >= 0.9 ? '🏆 Mastery' : pct >= 0.7 ? '⭐ Strong' : pct >= 0.5 ? '📈 Getting there' : '📚 Keep studying';
      document.getElementById("quizFinalScore").innerHTML = `
        <span style="font-size:3rem;font-family:var(--font-display);color:var(--gold);font-weight:900">${state.quizCorrect}</span>
        <span style="font-size:1.5rem;color:var(--text-dim)">/${total}</span>
        <span style="font-family:var(--font-mono);color:var(--teal);font-size:1rem;margin-left:1rem">${label}</span>`;
    }
  }

  // ── Unified Downloads Pipeline ───────────────────────────────────────────
  function downloadArtifact() {
    const type = state.currentArtifactType;
    const captureZone = document.getElementById("captureZone");
    if (!captureZone) { showToast("Nothing to download."); return; }

    showToast("Generating file, please wait...");

    if (type === 'flashcards') {
      generateNativePDF_Flashcards();
    } else if (type === 'quiz') {
      generateNativePDF_Quiz();
    } else if (type === 'slides' || type === 'explainer') {
      generateOffscreenPDF(captureZone, type);
    } else {
      // PNG images (Infographic / Concept Map)
      html2canvas(captureZone, { scale: 2, backgroundColor: '#0d1220', useCORS: true }).then(canvas => {
        const a = document.createElement('a');
        a.download = `${state.concept.replace(/\s+/g,'-')}-${type}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      });
    }
  }

  // FIX: Native jsPDF drawing for Flashcards to perfectly preserve dark theme & boxes
  function generateNativePDF_Flashcards() {
    if (!window.jspdf?.jsPDF) { showToast("PDF library not loaded."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;

    const paintBackground = () => { doc.setFillColor(13, 18, 32); doc.rect(0, 0, 210, 297, 'F'); };
    paintBackground();

    doc.setFont("helvetica", "bold"); doc.setTextColor(232, 184, 75); doc.setFontSize(18);
    doc.text(`Flashcards: ${state.concept}`, 15, y);
    y += 15;

    state.flashcardData.forEach((card) => {
      const qLines = doc.splitTextToSize(`Q: ${card.front}`, 170);
      const aLines = doc.splitTextToSize(`A: ${card.back}`, 170);
      const blockHeight = (qLines.length + aLines.length) * 6 + 15;

      if (y + blockHeight > 280) { doc.addPage(); paintBackground(); y = 20; }

      // Draw Dark Box
      doc.setFillColor(26, 31, 46); doc.setDrawColor(232, 184, 75); doc.setLineWidth(0.5);
      doc.rect(10, y, 190, blockHeight, 'FD');

      y += 8;
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(qLines, 15, y);
      y += qLines.length * 6 + 2;

      doc.setTextColor(200, 200, 200); doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.text(aLines, 15, y);
      y += aLines.length * 6 + 5;
    });
    doc.save(`${state.concept.replace(/\s+/g,'-')}-flashcards.pdf`);
  }

// FIX: Restored box theme, answers, color-coding, and explanations
  function generateNativePDF_Quiz() {
    if (!window.jspdf?.jsPDF) { showToast("PDF library not loaded."); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 20;

    const paintBackground = () => { doc.setFillColor(13, 18, 32); doc.rect(0, 0, 210, 297, 'F'); };
    paintBackground();

    doc.setFont("helvetica", "bold"); doc.setTextColor(232, 184, 75); doc.setFontSize(18);
    doc.text(state.quizData.title || `Quiz: ${state.concept}`, 15, y);
    y += 15;

    state.quizData.questions.forEach((q, qi) => {
      const isAnswered = state.quizAnswered[qi] !== null;
      const correctStatus = isAnswered 
        ? (state.quizAnswered[qi] === q.correct ? "  [Correct]" : "  [Incorrect]")
        : "";

      // Calculate heights to draw the box perfectly
      const qLines = doc.splitTextToSize(`${qi+1}. ${q.question}${correctStatus}`, 170);
      let contentHeight = qLines.length * 7;
      
      const optLinesArr = q.options.map((opt, oi) => {
        let mark = "[ ]";
        if (isAnswered) {
          if (oi === q.correct) mark = "[✓]"; 
          else if (oi === state.quizAnswered[qi]) mark = "[X]"; 
        }
        return doc.splitTextToSize(`${mark} ${String.fromCharCode(65+oi)}. ${opt}`, 160);
      });
      
      optLinesArr.forEach(lines => contentHeight += lines.length * 6);
      
      let expLines = [];
      if (isAnswered) {
        contentHeight += 6; 
        expLines = doc.splitTextToSize(`Explanation: ${q.explanation}`, 165);
        contentHeight += expLines.length * 5;
      }

      const boxPadding = 8;
      const blockHeight = contentHeight + (boxPadding * 2);

      // Paginate if box won't fit
      if (y + blockHeight > 280) { doc.addPage(); paintBackground(); y = 20; }

      // Draw Dark Box Theme
      doc.setFillColor(26, 31, 46); doc.setDrawColor(232, 184, 75); doc.setLineWidth(0.5);
      doc.rect(10, y, 190, blockHeight, 'FD');

      let textY = y + boxPadding + 4;

      // Print Question
      doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text(qLines, 15, textY);
      textY += qLines.length * 7 + 2;

      // Print Options (Color coded if answered)
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      q.options.forEach((opt, oi) => {
        const lines = optLinesArr[oi];
        if (isAnswered && oi === q.correct) {
          doc.setTextColor(160, 200, 120); // Green for correct
        } else if (isAnswered && oi === state.quizAnswered[qi]) {
          doc.setTextColor(255, 107, 107); // Red for wrong
        } else {
          doc.setTextColor(200, 200, 200); // Standard text
        }
        doc.text(lines, 20, textY);
        textY += lines.length * 6;
      });

      // Print Explanation
      if (isAnswered) {
        textY += 4;
        doc.setTextColor(232, 184, 75); // Gold
        doc.setFont("helvetica", "italic"); doc.setFontSize(10);
        doc.text(expLines, 15, textY);
      }

      y += blockHeight + 6; // Move down for the next box
    });
    doc.save(`${state.concept.replace(/\s+/g,'-')}-quiz.pdf`);
  }

  // FIX: Off-screen isolation for Slides and Explainer to prevent PDF cropping
  function generateOffscreenPDF(sourceElement, type) {
    const clone = document.createElement('div');
    clone.innerHTML = sourceElement.innerHTML;
    clone.style.position = 'fixed';
    clone.style.top = '-9999px';
    clone.style.left = '0';
    clone.style.width = '800px'; // Fixed width prevents window size distortion
    clone.style.backgroundColor = '#0d1220';
    clone.style.padding = '40px';
    document.body.appendChild(clone);

    html2canvas(clone, { scale: 2, useCORS: true }).then(canvas => {
      document.body.removeChild(clone);
      if (!window.jspdf?.jsPDF) return;
      
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm' });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = pdfHeight;
      let position = 0;
      
      // Auto-paginate if image exceeds single page length
      doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= 295;
      
      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= 295;
      }
      doc.save(`${state.concept.replace(/\s+/g,'-')}-${type}.pdf`);
    });
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

  function showToast(msg) {
    let t = document.getElementById("ua-toast");
    if (!t) {
      t = document.createElement("div"); t.id = "ua-toast";
      t.style.cssText = "position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:#1a2030;border:1px solid var(--border);border-radius:8px;padding:0.75rem 1.4rem;font-family:var(--font-mono);font-size:0.82rem;color:var(--text);z-index:300;box-shadow:0 8px 30px rgba(0,0,0,0.5);transition:opacity 0.3s ease;opacity:0;pointer-events:none";
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = "1";
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.opacity = "0"; }, 2800);
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

  function handleError(err, loadingId) {
    const el = document.getElementById(loadingId);
    if (!el) return;
    let msg = err.message || "Unknown error";
    if (msg.includes("Quota exceeded") || msg.includes("limit: 0")) {
      msg = "API Quota Exceeded. Please verify your model limits.";
    } else if (msg.length > 150) {
      msg = msg.substring(0, 150) + "..."; 
    }
    el.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem;text-align:center">Error: ${msg}</p>`;
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    start, goToStage, goToStage2,
    selectPriorOption, submitPriorQuiz,
    explainConcept, stressTest,
    evaluateStressTest, scoreFinalTeachBack,
    goToArtifacts, selectArtifact,
    answerQuizOption, downloadArtifact, restart
  };

})();
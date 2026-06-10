/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — app.js v4
   Changes: Error intercepts, Image crop fix, PDF fixes, Restored shake animation
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

  // ── Navigation ─────────────────────────────────────────────────────────────
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
    if (next) {
      next.classList.add("active");
      setTimeout(() => {
        next.classList.add("visible");
        next.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 30);
    }
  }

  function updateProgress(n) {
    const p = Math.round((n / TOTAL_STAGES) * 100);
    document.documentElement.style.setProperty('--progress', `${p}%`);
    const lbl = document.getElementById("progressLabel");
    if (lbl) {
      lbl.textContent = n === 0 ? "Setup" : `Stage ${n} of 6`;
    }
  }

  // ── Utils & Errors ─────────────────────────────────────────────────────────
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

  function handleError(err, loadingId) {
    const el = document.getElementById(loadingId);
    if (!el) return;
    
    let msg = err.message || "Unknown error";
    
    // Intercept massive text wall quota limits
    if (msg.includes("Quota exceeded") || msg.includes("limit: 0")) {
      msg = "API Quota Exceeded. Verify your model is set to a free-tier limit.";
    } else if (msg.length > 150) {
      msg = msg.substring(0, 150) + "..."; 
    }
    
    el.innerHTML = `<p style="color:#ff6b6b;font-family:var(--font-mono);font-size:0.85rem;text-align:center;margin:1rem 0;">Error: ${msg}</p>`;
  }

  // ── PDF & Image Download Logic ─────────────────────────────────────────────
  
  // Renders the download button safely outside the screenshot zone
  function renderDownloadBar(type, htmlContainer) {
    // Remove existing bar if any
    const existing = document.getElementById("dynamic-download-bar");
    if (existing) existing.remove();

    const wrap = document.getElementById("artifactOutputWrap");
    const bar = document.createElement("div");
    bar.id = "dynamic-download-bar";
    bar.className = "download-bar";

    const btn = document.createElement("button");
    btn.className = "btn-download";

    if (['mindmap', 'infographic'].includes(type)) {
      btn.innerHTML = `<span>↓</span> Download as PNG`;
      btn.onclick = () => downloadAsImage(type);
    } else {
      btn.innerHTML = `<span>↓</span> Download as PDF`;
      btn.onclick = () => downloadAsPDF(type);
    }

    bar.appendChild(btn);
    wrap.appendChild(bar); // Append OUTSIDE artifactOutput
  }

  async function downloadAsImage(type) {
    const target = document.getElementById("artifactOutput");
    if (!target) return;

    const originalMaxHeight = target.style.maxHeight;
    const originalOverflow = target.style.overflow;

    // Expand container fully to prevent html2canvas cropping
    target.style.maxHeight = "none";
    target.style.overflow = "visible";

    try {
      const canvas = await window.html2canvas(target, { 
        scale: 2, 
        backgroundColor: "#0d1220",
        useCORS: true 
      });
      const link = document.createElement("a");
      link.download = `${state.concept.replace(/\s+/g, '_')}_${type}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      showToast("Failed to generate image.");
      console.error(e);
    } finally {
      // Restore container constraints
      target.style.maxHeight = originalMaxHeight;
      target.style.overflow = originalOverflow;
    }
  }

  async function downloadAsPDF(type) {
    if (!window.jspdf) {
      showToast("PDF library loading, try again in a moment.");
      return;
    }
    const { jsPDF } = window.jspdf;
    
    // For HTML-based artifacts (Slides & Explainer), snapshot the UI directly to PDF
    if (type === 'slides' || type === 'explainer') {
      const target = document.getElementById("artifactOutput");
      const originalMaxHeight = target.style.maxHeight;
      const originalOverflow = target.style.overflow;
      
      target.style.maxHeight = "none";
      target.style.overflow = "visible";
      
      try {
        const canvas = await window.html2canvas(target, { scale: 2, backgroundColor: "#0d1220" });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        
        const orientation = type === 'slides' ? 'landscape' : 'portrait';
        const doc = new jsPDF({ orientation });
        
        const imgProps = doc.getImageProperties(imgData);
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        doc.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        doc.save(`${state.concept.replace(/\s+/g, '_')}_${type}.pdf`);
      } finally {
        target.style.maxHeight = originalMaxHeight;
        target.style.overflow = originalOverflow;
      }
      return;
    }

    // For JSON-based artifacts (Flashcards & Quizzes), draw them programmatically
    const doc = new jsPDF();
    const margin = 15;
    let y = 20;

    if (type === 'flashcards' && state.flashcardData) {
      doc.setFontSize(16);
      doc.text(`Flashcards: ${state.concept}`, margin, y);
      y += 15;

      doc.setFontSize(11);
      state.flashcardData.forEach((card, i) => {
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
      doc.save(`${state.concept.replace(/\s+/g, '_')}_flashcards.pdf`);
    }

    if (type === 'quiz' && state.quizData) {
      doc.setFontSize(16);
      doc.text(state.quizData.title || `Quiz: ${state.concept}`, margin, y);
      y += 15;

      doc.setFontSize(11);
      state.quizData.questions.forEach((q, i) => {
        const isAnswered = state.quizAnswered[i] !== null;
        const correctStatus = isAnswered 
          ? (state.quizAnswered[i] === q.correct ? " [Correct]" : " [Wrong]")
          : " [Unanswered]";

        const qLines = doc.splitTextToSize(`${i + 1}. ${q.question}${correctStatus}`, 180);
        
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
        q.options.forEach((opt, optIdx) => {
          // Safe ASCII alternative to Unicode checkmarks/circles
          let mark = "[ ]";
          if (isAnswered) {
            if (optIdx === q.correct) mark = "[X]"; // Correct answer
            else if (optIdx === state.quizAnswered[i]) mark = "[~]"; // Wrong pick
          }
          const optLines = doc.splitTextToSize(`${mark} ${opt}`, 170);
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
      doc.save(`${state.concept.replace(/\s+/g, '_')}_quiz.pdf`);
    }
  }

  // ── Stage Flow Logic ───────────────────────────────────────────────────────
  async function submitSetup() {
    state.concept = document.getElementById("conceptInput").value.trim();
    state.background = document.getElementById("backgroundInput").value.trim();
    state.goal = document.getElementById("goalInput").value.trim() || "General understanding";

    if (!state.concept || !state.background) {
      showToast("Please fill in what you want to learn and your background.");
      return;
    }

    goToStage(1);
    const loading = document.getElementById("s1-loading");
    loading.style.display = "flex";
    document.getElementById("s1-content").style.display = "none";

    try {
      const quiz = await AI.generatePriorQuiz(state);
      state.priorQuiz = quiz;
      state.priorAnswers = new Array(quiz.length).fill(null);
      renderPriorQuiz(quiz);
      loading.style.display = "none";
      document.getElementById("s1-content").style.display = "block";
    } catch (e) {
      handleError(e, "s1-loading");
    }
  }

  function renderPriorQuiz(quiz) {
    const c = document.getElementById("pq-container");
    c.innerHTML = "";
    quiz.forEach((q, i) => {
      let html = `<div class="pq-question">
        <div class="pq-q-num">Question ${i+1} of 5</div>
        <div class="pq-q-text">${q.question}</div>
        <div class="pq-options">`;
      q.options.forEach((opt, j) => {
        const letter = String.fromCharCode(65 + j);
        html += `<div class="pq-option" onclick="App.selectPq(${i}, ${j})" id="pq-${i}-${j}">
          <span class="pq-opt-letter">${letter}</span>
          <span>${opt}</span>
        </div>`;
      });
      html += `</div></div>`;
      c.innerHTML += html;
    });
  }

  function selectPq(qIndex, optIndex) {
    state.priorAnswers[qIndex] = optIndex;
    const qDiv = document.querySelectorAll('.pq-question')[qIndex];
    const opts = qDiv.querySelectorAll('.pq-option');
    opts.forEach(o => o.classList.remove('selected'));
    document.getElementById(`pq-${qIndex}-${optIndex}`).classList.add('selected');

    const done = state.priorAnswers.filter(a => a !== null).length;
    const btn = document.getElementById("s1-btn");
    if (done === 5) {
      btn.disabled = false;
      btn.textContent = "Analyze My Answers →";
    }
  }

  async function submitPriorQuiz() {
    goToStage(2);
    const loading = document.getElementById("s2-loading");
    loading.style.display = "flex";
    document.getElementById("s2-content").style.display = "none";

    try {
      state.gapAnalysis = await AI.analyzeGaps(state);
      document.getElementById("gapAnalysisOutput").innerHTML = state.gapAnalysis;
      
      state.explanation = await AI.explainConcept(state);
      document.getElementById("explanationOutput").innerHTML = state.explanation;

      loading.style.display = "none";
      document.getElementById("s2-content").style.display = "block";
    } catch (e) {
      handleError(e, "s2-loading");
    }
  }

  async function startStressTest() {
    goToStage(3);
    const loading = document.getElementById("s3-loading");
    loading.style.display = "flex";
    document.getElementById("s3-content").style.display = "none";

    try {
      state.stressQuestions = await AI.generateStressTest(state);
      renderStressTest(state.stressQuestions);
      loading.style.display = "none";
      document.getElementById("s3-content").style.display = "block";
    } catch (e) {
      handleError(e, "s3-loading");
    }
  }

  function renderStressTest(questions) {
    const c = document.getElementById("stressTestContainer");
    c.innerHTML = "";
    questions.forEach((q, i) => {
      c.innerHTML += `
        <div class="stress-question">
          <div class="stress-q-number">Question ${i+1} • ${q.type}</div>
          <div class="stress-q-text">${q.question}</div>
          <textarea class="stress-q-input" id="stress-a-${i}" placeholder="Your answer..."></textarea>
        </div>
      `;
    });
  }

  async function submitStressTest() {
    const answers = [];
    let empty = false;
    for (let i = 0; i < state.stressQuestions.length; i++) {
      const val = document.getElementById(`stress-a-${i}`).value.trim();
      if (!val) empty = true;
      answers.push(val);
    }
    if (empty) {
      showToast("Please attempt all stress test questions.");
      return;
    }
    state.stressAnswers = answers;

    goToStage(4);
    const loading = document.getElementById("s4-loading");
    loading.style.display = "flex";
    document.getElementById("s4-content").style.display = "none";

    try {
      state.stressResult = await AI.evaluateStressTest(state);
      document.getElementById("stressEvalOutput").innerHTML = state.stressResult;
      loading.style.display = "none";
      document.getElementById("s4-content").style.display = "block";
    } catch (e) {
      handleError(e, "s4-loading");
    }
  }

  function goToFinalTeachBack() {
    goToStage(5);
  }

  async function submitFinalTeachBack() {
    state.finalTeachBack = document.getElementById("finalTeachBackInput").value.trim();
    if (!state.finalTeachBack || state.finalTeachBack.length < 20) {
      showToast("Please provide a more detailed explanation.");
      return;
    }

    goToStage(6);
    const loading = document.getElementById("s6-loading");
    loading.style.display = "flex";
    document.getElementById("s6-content").style.display = "none";

    try {
      const result = await AI.scoreFinalTeachBack(state);
      state.score = result.score;
      
      const scoreNum = document.getElementById("finalScoreNum");
      scoreNum.textContent = "0";
      document.getElementById("finalScoreLabel").innerHTML = `<strong>${result.label}</strong><br>Based on your gap progression`;
      document.getElementById("finalFeedback").innerHTML = `<p>${result.feedback}</p>`;
      
      loading.style.display = "none";
      document.getElementById("s6-content").style.display = "block";

      // Animate score
      let start = 0;
      const end = result.score;
      const duration = 1500;
      const step = (timestamp) => {
        if (!start) start = timestamp;
        const progress = Math.min((timestamp - start) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        scoreNum.textContent = Math.floor(easeOut * end);
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);

    } catch (e) {
      handleError(e, "s6-loading");
    }
  }

  async function selectArtifact(type) {
    document.querySelectorAll(".artifact-card").forEach(c => c.classList.remove("selected"));
    document.querySelector(`[data-artifact="${type}"]`).classList.add("selected");
    
    state.currentArtifactType = type;
    const wrap = document.getElementById("artifactOutputWrap");
    const out = document.getElementById("artifactOutput");
    const load = document.getElementById("artifactLoading");
    const loadText = document.getElementById("artifactLoadingText");
    
    wrap.style.display = "block";
    out.style.display = "none";
    load.style.display = "flex";
    loadText.textContent = `Generating your ${type}...`;
    
    // Clear out any old download bar so it doesn't pile up
    const oldBar = document.getElementById("dynamic-download-bar");
    if (oldBar) oldBar.remove();

    try {
      const result = await AI.generateArtifact({ ...state, type });
      
      if (type === 'flashcards') {
        state.flashcardData = result.data;
        renderFlashcards(result.data, out);
      } else if (type === 'quiz') {
        state.quizData = result.data;
        state.quizAnswered = new Array(result.data.questions.length).fill(null);
        state.quizCorrect = 0;
        renderArtifactQuiz(result.data, out);
      } else {
        out.innerHTML = result.data; // HTML mapping
      }
      
      load.style.display = "none";
      out.style.display = "block";
      
      // Inject the download bar below the artifact
      renderDownloadBar(type, out);

    } catch (e) {
      load.style.display = "none";
      out.style.display = "block";
      handleError(e, "artifactOutput");
    }
  }

  function renderFlashcards(cards, container) {
    let html = `<div class="flashcard-grid">`;
    cards.forEach((c, i) => {
      html += `
        <div class="flip-card" onclick="this.classList.toggle('flipped')">
          <div class="flip-card-inner">
            <div class="flip-card-front">
              <div class="flip-card-label">Flashcard ${i+1} • Question</div>
              <p>${c.front}</p>
            </div>
            <div class="flip-card-back">
              <div class="flip-card-label">Answer</div>
              <p>${c.back}</p>
            </div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
    container.innerHTML = html;
  }

  function renderArtifactQuiz(data, container) {
    let html = `<div class="quiz-header">
      <h3 style="margin:0;color:var(--text)">${data.title || "Final Assessment"}</h3>
      <div class="quiz-progress" id="quiz-score">Score: 0 / ${data.questions.length}</div>
    </div>`;
    
    data.questions.forEach((q, i) => {
      html += `<div class="quiz-question" id="quiz-q-${i}">
        <div class="quiz-q-num">Question ${i+1}</div>
        <div class="quiz-q-text">${q.question}</div>
        <div class="quiz-options">`;
      q.options.forEach((opt, j) => {
        const letter = String.fromCharCode(65 + j);
        html += `<button class="quiz-option" onclick="App.answerQuiz(${i}, ${j})" id="quiz-opt-${i}-${j}">
          <span class="quiz-opt-letter">${letter}</span>
          <span>${opt}</span>
        </button>`;
      });
      html += `</div>
        <div class="quiz-explanation hidden" id="quiz-exp-${i}">${q.explanation}</div>
      </div>`;
    });
    
    container.innerHTML = html;
  }

  function answerQuiz(qIndex, optIndex) {
    if (state.quizAnswered[qIndex] !== null) return; // already answered
    
    state.quizAnswered[qIndex] = optIndex;
    const qData = state.quizData.questions[qIndex];
    const isCorrect = optIndex === qData.correct;
    
    if (isCorrect) state.quizCorrect++;
    document.getElementById("quiz-score").textContent = `Score: ${state.quizCorrect} / ${state.quizData.questions.length}`;
    
    // Disable all options for this question
    const qDiv = document.getElementById(`quiz-q-${qIndex}`);
    const btns = qDiv.querySelectorAll('.quiz-option');
    btns.forEach((b, j) => {
      b.disabled = true;
      if (j === qData.correct) b.classList.add('correct');
      else if (j === optIndex && !isCorrect) {
        b.classList.add('wrong');
        b.classList.add('shake'); // Adds shake animation to the wrong answer
      }
    });
    
    // Show explanation
    const exp = document.getElementById(`quiz-exp-${qIndex}`);
    exp.classList.remove('hidden');
  }

  function restart() {
    window.location.reload();
  }

  return { 
    init, submitSetup, selectPq, submitPriorQuiz, 
    startStressTest, submitStressTest, goToFinalTeachBack, 
    submitFinalTeachBack, selectArtifact, answerQuiz, restart 
  };

})();

window.addEventListener('DOMContentLoaded', App.init);
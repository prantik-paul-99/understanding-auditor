/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — ai.js v3
   Changes: prior quiz, JSON artifacts, fence stripping
───────────────────────────────────────── */

const AI = (() => {

  async function call(systemPrompt, userMessage, maxTokens = 1000) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, userMessage, maxTokens })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Server error ${res.status}`);
    }
    const data = await res.json();
    return (data.text || "").trim();
  }

  function stripFences(raw) {
    return raw
      .replace(/^```[\w]*\s*\n?/gm, '')
      .replace(/\n?```\s*$/gm, '')
      .trim();
  }

  function parseJSON(raw) {
    const clean = stripFences(raw);
    try { return JSON.parse(clean); } catch {
      const arr = clean.match(/\[[\s\S]*\]/);
      const obj = clean.match(/\{[\s\S]*\}/);
      if (arr) return JSON.parse(arr[0]);
      if (obj) return JSON.parse(obj[0]);
      throw new Error("Could not parse AI response as JSON");
    }
  }

  function renderText(raw) {
    return raw
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm,  '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\s*[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .split(/\n{2,}/)
      .map(p => p.trim()).filter(Boolean)
      .map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g, ' ')}</p>`)
      .join('\n');
  }

  // ── 0. Prior Knowledge Quiz ───────────────────────────────────────────────
  async function generatePriorQuiz({ concept, background }) {
    const system = `You are a diagnostic quiz generator. Return ONLY valid JSON — no markdown, no backticks, no extra text whatsoever.`;
    const user = `
Generate exactly 5 diagnostic MCQ questions about "${concept}" for someone with background: "${background}".
Test different aspects at varied difficulty. All 4 options should be plausible (not obviously wrong).
Return ONLY this JSON array with no other text before or after:
[
  {
    "id": 1,
    "question": "...",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]
"correct" is the 0-based index of the correct option.
    `.trim();
    const raw = await call(system, user, 900);
    return parseJSON(raw);
  }

  // ── 1. Gap Analysis (from quiz answers) ──────────────────────────────────
  async function analyzeGaps({ concept, background, goal, priorQuiz, priorAnswers }) {
    const score = priorAnswers.filter((a, i) => a === priorQuiz[i].correct).length;
    const summary = priorQuiz.map((q, i) => {
      const ans = priorAnswers[i];
      const answered = ans !== null && ans !== undefined;
      const selected = answered ? q.options[ans] : "(not answered)";
      const correct  = q.options[q.correct];
      const isCorrect = ans === q.correct;
      return `Q: ${q.question}\nSelected: "${selected}" — ${isCorrect ? '✓ CORRECT' : '✗ WRONG'}\nCorrect: "${correct}"`;
    }).join('\n\n');

    const system = `You are an expert learning analyst. Diagnose understanding from quiz performance. Be specific, honest, constructive. Use markdown headers.`;
    const user = `
Concept: "${concept}" | Background: "${background}" | Goal: "${goal}"
Diagnostic score: ${score}/5

Quiz results:
---
${summary}
---

Include these sections:

## What you got right
Specific things demonstrated from correct answers. Genuine — no invented praise.

## The gaps
3-5 knowledge gaps from wrong answers. For each: what the correct understanding is and why it matters.

## The core misconception
If one central misunderstanding drove multiple wrong answers, name it clearly.

## Learning priorities
2-3 sentences on what to focus on given background and goal.

Direct. No filler. Speak as "you".
    `.trim();
    const raw = await call(system, user, 900);
    return renderText(raw);
  }

  // ── 2. Personalized Explanation ──────────────────────────────────────────
  async function explainConcept({ concept, background, goal, gapAnalysis, priorQuiz, priorAnswers }) {
    const score = priorAnswers.filter((a, i) => a === priorQuiz[i].correct).length;
    const system = `You are a world-class teacher. Give personalized explanations. Connect to what the learner already knows. Precise, vivid, never condescending.`;
    const user = `
Concept: "${concept}" | Background: "${background}" | Goal: "${goal}" | Quiz score: ${score}/5

Gap analysis:
---
${gapAnalysis}
---

Write a personalized explanation that:
1. Opens with a hook/analogy relevant to their specific background
2. Addresses each identified gap in order of importance
3. Builds from what they got right — don't re-explain known things
4. Uses concrete examples, not abstract definitions
5. Ends with one memorable "mental model" sentence

Clear sections. Under 500 words. Every sentence earns its place.
    `.trim();
    const raw = await call(system, user, 1100);
    return renderText(raw);
  }

  // ── 3. Stress Test ────────────────────────────────────────────────────────
  async function generateStressTest({ concept, background, gapAnalysis }) {
    const system = `You generate stress-test questions targeting a learner's gaps. Return ONLY valid JSON — no markdown, no backticks.`;
    const user = `
Concept: "${concept}" | Background: "${background}"
Gaps:
---
${gapAnalysis}
---
Generate exactly 4 stress-test questions targeting their specific gaps. Require genuine understanding, not recall.
- 1 edge case ("What happens when...")
- 1 "explain the difference" question
- 1 "why does this matter" question
- 1 "spot the flaw" question

Return ONLY this JSON array:
[
  { "id": 1, "type": "Edge case", "question": "..." },
  { "id": 2, "type": "Explain the difference", "question": "..." },
  { "id": 3, "type": "Why it matters", "question": "..." },
  { "id": 4, "type": "Spot the flaw", "question": "..." }
]
    `.trim();
    const raw = await call(system, user, 700);
    return parseJSON(raw);
  }

  // ── 4. Evaluate Stress Test ──────────────────────────────────────────────
  async function evaluateStressTest({ concept, questions, answers }) {
    const system = `You evaluate stress-test answers honestly and concisely.`;
    const qa = questions.map((q, i) =>
      `Q${i+1} [${q.type}]: ${q.question}\nAnswer: ${answers[i] || "(no answer)"}`
    ).join('\n\n');
    const user = `
Concept: "${concept}"
Q&A:
---
${qa}
---
For each question:
- Verdict (Strong / Partial / Missed)
- 1-2 sentences on what was right/wrong
- Key insight missed (if any)
Then 2-sentence overall summary. Be honest.
    `.trim();
    const raw = await call(system, user, 800);
    return renderText(raw);
  }

  // ── 5. Score Final Teach-Back ────────────────────────────────────────────
  async function scoreFinalTeachBack({ concept, background, finalTeachBack, gapAnalysis }) {
    const system = `You score a learner's final explanation rigorously. Return ONLY valid JSON — no markdown, no backticks.`;
    const user = `
Concept: "${concept}" | Background: "${background}"
Original gaps: ${gapAnalysis}
Final explanation: ${finalTeachBack}

Return ONLY:
{
  "score": <0-100>,
  "label": <"Novice"|"Developing"|"Solid"|"Strong"|"Mastery">,
  "feedback": "<3-5 sentences: what improved, remaining gaps, one next step>"
}
0-39=Novice, 40-59=Developing, 60-74=Solid, 75-89=Strong, 90-100=Mastery
    `.trim();
    const raw = await call(system, user, 400);
    return parseJSON(raw);
  }

  // ── 6. Generate Artifact ─────────────────────────────────────────────────
  async function generateArtifact({ type, concept, background, explanation, gapAnalysis, finalTeachBack, score }) {
    const ctx = `Concept: "${concept}" | Background: "${background}" | Score: ${score}/100\nExplanation: ${explanation}\nGaps: ${gapAnalysis}\nTeach-back: ${finalTeachBack}`;

    // FLASHCARDS → JSON
    if (type === 'flashcards') {
      const system = `You generate flashcard data as JSON. Return ONLY valid JSON, no markdown, no backticks, no extra text.`;
      const user = `${ctx}\n\nGenerate 8 flashcards for "${concept}" targeting the learner's specific gaps.\nMix types: definition, application, compare/contrast, edge case.\n\nReturn ONLY this JSON array:\n[\n  { "front": "Question or term", "back": "Answer or explanation" }\n]`;
      const raw = await call(system, user, 1000);
      return { type: 'json', subtype: 'flashcards', data: parseJSON(raw) };
    }

    // QUIZ → JSON
    if (type === 'quiz') {
      const system = `You generate quiz data as JSON. Return ONLY valid JSON, no markdown, no backticks, no extra text.`;
      const user = `${ctx}\n\nGenerate a 6-question MCQ quiz on "${concept}" targeting this learner's gaps.\nEach question needs 4 plausible options, correct index (0-based), and a brief explanation.\n\nReturn ONLY this JSON:\n{\n  "title": "Quiz: ${concept}",\n  "questions": [\n    {\n      "question": "...",\n      "options": ["A","B","C","D"],\n      "correct": 0,\n      "explanation": "..."\n    }\n  ]\n}`;
      const raw = await call(system, user, 1200);
      return { type: 'json', subtype: 'quiz', data: parseJSON(raw) };
    }

    // HTML ARTIFACTS — NO FENCES
    const prompts = {
      mindmap: {
        system: `You create concept maps as self-contained HTML+CSS. Return ONLY raw HTML with an embedded <style> tag. Absolutely no markdown fences, no backticks, no preamble text of any kind.`,
        user: `${ctx}\n\nCreate a scrollable visual concept map for "${concept}".\nStyle: center node gold (#e8b84b), sub-concept nodes teal (#00d4c8), gap nodes coral (#ff6b6b), dark bg (#0d1220).\nUse CSS flexbox/grid layout. Min-height 550px. All text readable. Connecting lines via CSS borders.\nReturn ONLY raw HTML — no fences, no backticks, no preamble.`,
        tokens: 1500
      },
      infographic: {
        system: `You create infographics as self-contained HTML+CSS. Return ONLY raw HTML with an embedded <style> tag. No markdown fences, no backticks, no preamble.`,
        user: `${ctx}\n\nCreate a visual infographic for "${concept}":\n- Large headline definition\n- 3-4 key facts with emoji icons in colored boxes\n- Learner's top 2 gaps as "⚠️ Watch out" callouts\n- "Bottom line" summary box\n- Dark theme (#0d1220), gold and teal accents, readable fonts\nReturn ONLY raw HTML — no fences, no backticks.`,
        tokens: 1500
      },
      slides: {
        system: `You create slide decks as self-contained HTML+CSS. Return ONLY raw HTML with an embedded <style> tag. No markdown fences, no backticks, no preamble.`,
        user: `${ctx}\n\nCreate 6 presentation slides for "${concept}":\n1. Hook/Why it matters  2. Core definition  3. How it works  4. Misconceptions from gaps  5. Real-world example  6. Key takeaway\nEach slide: numbered div, large heading, 3-4 bullets. Dark theme, large readable text. Each slide min-height 300px with clear separation. Include @media print CSS.\nReturn ONLY raw HTML — no fences, no backticks.`,
        tokens: 1500
      },
      explainer: {
        system: `You write explainer articles as self-contained HTML+CSS. Return ONLY raw HTML with an embedded <style> tag. No markdown fences, no backticks, no preamble.`,
        user: `${ctx}\n\nWrite a 400-500 word explainer on "${concept}" for this learner.\nSections: hook intro, core explanation addressing their gaps, concrete example, memorable closing.\nReadable serif typography, dark theme, generous spacing.\nReturn ONLY raw HTML — no fences, no backticks.`,
        tokens: 1300
      }
    };

    const p = prompts[type];
    const raw = await call(p.system, p.user, p.tokens);
    return { type: 'html', data: stripFences(raw) };
  }

  return {
    generatePriorQuiz,
    analyzeGaps,
    explainConcept,
    generateStressTest,
    evaluateStressTest,
    scoreFinalTeachBack,
    generateArtifact,
    renderText
  };

})();

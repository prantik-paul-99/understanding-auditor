/* ─────────────────────────────────────────
   UNDERSTANDING AUDITOR — ai.js
   Calls /api/chat (Vercel serverless → Gemini)
───────────────────────────────────────── */

const AI = (() => {

  // ── Core call ──────────────────────────────────────────────────────────────
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

  // ── Render markdown-ish text to HTML ──────────────────────────────────────
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
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => p.startsWith('<') ? p : `<p>${p.replace(/\n/g, ' ')}</p>`)
      .join('\n');
  }

  // ── 1. Gap Analysis ────────────────────────────────────────────────────────
  async function analyzeGaps({ concept, background, goal, priorKnowledge }) {
    const system = `You are an expert learning analyst and educator. Your job is to identify exactly where someone's understanding of a concept breaks down — not to lecture, but to diagnose. Be honest but kind. Use structured output.`;

    const user = `
Concept the user wants to learn: "${concept}"
Their background: "${background}"
Their goal: "${goal}"

Here is what they wrote when asked to explain the concept:
---
${priorKnowledge}
---

Analyze their understanding. Your response must include:

## What you got right
List 2-3 things they understood correctly (even partially). Be specific and genuine — don't invent praise.

## The gaps
List 3-5 specific gaps or misconceptions in their understanding. For each gap, briefly say why it matters. Be precise — name the actual missing piece.

## The one biggest misunderstanding
If there's a core misconception anchoring the other gaps, call it out clearly.

## What to focus on
2-3 sentences on which gaps to prioritize given their background and goal.

Keep it tight. No filler. Speak directly to them as "you".
    `.trim();

    const raw = await call(system, user, 900);
    return renderText(raw);
  }

  // ── 2. Personalized Explanation ───────────────────────────────────────────
  async function explainConcept({ concept, background, goal, gapAnalysis, priorKnowledge }) {
    const system = `You are a world-class teacher who specializes in making complex ideas click for specific people. You never give generic explanations. You always connect new knowledge to what the learner already knows and cares about. You are precise, vivid, and never condescending.`;

    const user = `
Concept: "${concept}"
Learner's background: "${background}"
Their goal: "${goal}"

Here is what they already knew (their brain dump):
---
${priorKnowledge}
---

Here is the gap analysis of their understanding:
---
${gapAnalysis}
---

Now write a personalized explanation that:
1. Starts with a hook — a vivid analogy or real-world example that connects to their specific background
2. Addresses each gap identified above, in order of importance
3. Builds from what they already got right — don't re-explain things they know
4. Uses concrete examples, not abstract definitions
5. Ends with a "mental model" — one memorable sentence that captures the whole concept

Format with clear sections. Keep it under 500 words. Make every sentence earn its place.
    `.trim();

    const raw = await call(system, user, 1100);
    return renderText(raw);
  }

  // ── 3. Stress Test Questions ───────────────────────────────────────────────
  async function generateStressTest({ concept, background, gapAnalysis }) {
    const system = `You are a rigorous examiner who designs stress tests to distinguish surface-level knowledge from deep understanding. Your questions target the specific weak points of this specific learner. You always return valid JSON and nothing else — no markdown, no backticks, no preamble.`;

    const user = `
Concept: "${concept}"
Learner background: "${background}"
Their identified gaps:
---
${gapAnalysis}
---

Generate exactly 4 stress-test questions that target their specific gaps. These should NOT be simple recall questions — they should require genuine understanding to answer well. Include:
- 1 edge case question ("What happens when...")
- 1 "explain the difference" question
- 1 "why does this matter" question
- 1 "spot the flaw" or misconception-busting question

Return ONLY a JSON array, no markdown, no backticks, no preamble:
[
  { "id": 1, "type": "Edge case", "question": "..." },
  { "id": 2, "type": "Explain the difference", "question": "..." },
  { "id": 3, "type": "Why it matters", "question": "..." },
  { "id": 4, "type": "Spot the flaw", "question": "..." }
]
    `.trim();

    const raw = await call(system, user, 700);
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  // ── 4. Evaluate Stress Test ────────────────────────────────────────────────
  async function evaluateStressTest({ concept, questions, answers }) {
    const system = `You are a fair, sharp examiner. You evaluate how well someone answered stress-test questions and give concise, specific feedback. You point out what was good, what was missing, and what the correct insight is.`;

    const qa = questions.map((q, i) =>
      `Q${i+1} [${q.type}]: ${q.question}\nAnswer: ${answers[i] || "(no answer)"}`
    ).join("\n\n");

    const user = `
Concept: "${concept}"

Here are the questions and the learner's answers:
---
${qa}
---

For each question, give:
- A one-line verdict (Strong / Partial / Missed)
- 1-2 sentences on what was right or wrong
- The key insight they may have missed (if any)

Then a 2-sentence summary of their overall performance on the stress test.

Be honest. Don't pad with encouragement.
    `.trim();

    const raw = await call(system, user, 800);
    return renderText(raw);
  }

  // ── 5. Score Final Teach-Back ─────────────────────────────────────────────
  async function scoreFinalTeachBack({ concept, background, finalTeachBack, gapAnalysis }) {
    const system = `You are a rigorous understanding evaluator. You score how well someone has internalized a concept based on their final explanation. You are calibrated, not generous. A 90+ means they genuinely understand it. Return valid JSON only — no markdown, no backticks, no preamble.`;

    const user = `
Concept: "${concept}"
Learner background: "${background}"

Original gaps identified:
---
${gapAnalysis}
---

Their final teach-back explanation:
---
${finalTeachBack}
---

Evaluate their final explanation and return ONLY this JSON:
{
  "score": <integer 0-100>,
  "label": <one of: "Novice", "Developing", "Solid", "Strong", "Mastery">,
  "feedback": "<3-5 sentences of specific feedback — what improved, what gaps remain, one thing to do next>"
}

Scoring guide:
0-39: Novice (major gaps remain)
40-59: Developing (partial understanding)
60-74: Solid (good grasp, some gaps)
75-89: Strong (clear understanding, minor gaps)
90-100: Mastery (could teach it confidently)
    `.trim();

    const raw = await call(system, user, 400);
    const clean = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  // ── 6. Generate Artifact ──────────────────────────────────────────────────
  async function generateArtifact({ type, concept, background, explanation, gapAnalysis, finalTeachBack, score }) {

    const context = `
Concept: "${concept}"
Learner background: "${background}"
Their final understanding score: ${score}/100

Key explanation (personalized):
${explanation}

Identified gaps:
${gapAnalysis}

Their final teach-back:
${finalTeachBack}
    `.trim();

    const prompts = {
      mindmap: {
        system: `You create clear, well-structured concept maps in HTML. Use divs and CSS to visually represent a concept and its connected ideas. Make it visually appealing using a dark theme with gold and teal accents. Return only the HTML/CSS snippet — no full page, just the content div and a <style> block.`,
        user: `${context}\n\nCreate a visual concept map for "${concept}" based on the learner's journey. Show the main concept in the center, branch out to 4-6 key sub-concepts, and note the learner's specific gaps in red. Use a dark background (#0d1220), gold (#e8b84b) for the center node, teal (#00d4c8) for sub-concepts, and #ff6b6b for gap nodes. Make it visually structured with connecting lines using CSS borders. Label everything clearly.`,
        tokens: 1400
      },
      infographic: {
        system: `You create informative, visually structured infographics as HTML+CSS. Use a clean layout with sections, icons (use Unicode/emoji), bold numbers, and clear hierarchy. Dark theme with gold and teal. Return only the content HTML and a <style> block — no full page wrapper.`,
        user: `${context}\n\nCreate an infographic about "${concept}" tailored to this learner. Include: a headline definition, 3-4 key facts or stats, the learner's top 2 gaps as "watch out" callouts, and a "bottom line" summary. Make it visually rich — use colored sections, emoji icons, and typographic hierarchy.`,
        tokens: 1400
      },
      flashcards: {
        system: `You create flashcard sets in clean HTML. Each card has a front (question/term) and back (answer/explanation). Target the learner's specific gaps. Return only the HTML content and a <style> block.`,
        user: `${context}\n\nCreate 8 flashcards for "${concept}" targeting this learner's specific gaps. Mix question types: definition, application, "what's the difference between X and Y", and "what happens when...". Style them with dark backgrounds, gold card fronts, teal card backs. Show both sides stacked for each card.`,
        tokens: 1200
      },
      slides: {
        system: `You create mini slide decks as HTML. Each slide is a styled div. Use a clean presentation layout with dark backgrounds, large text, and bullet points. Return only the slides HTML and a <style> block.`,
        user: `${context}\n\nCreate a 6-slide mini-lecture on "${concept}" for someone with this background. Slides: 1) Hook/why it matters, 2) Core definition, 3) How it works, 4) Common misconceptions (from the gaps), 5) Real-world example, 6) Key takeaway. Style each slide with a dark background, numbered, with large headings and concise bullets.`,
        tokens: 1400
      },
      explainer: {
        system: `You write polished, well-structured written explainers. Clear prose, good examples, no jargon without explanation. Return only the article content HTML and a <style> block.`,
        user: `${context}\n\nWrite a 400-500 word explainer article on "${concept}" at the level appropriate for this learner's background. Structure: engaging intro, core explanation (addressing their gaps), one concrete example, and a memorable closing line. Use headers. Write like a smart friend who actually knows the subject.`,
        tokens: 1200
      },
      quiz: {
        system: `You create interactive quizzes in HTML+JS. Multiple choice questions with instant feedback on click. Dark themed. Return only the quiz HTML, CSS, and JS — no full page wrapper.`,
        user: `${context}\n\nCreate a 5-question multiple choice quiz testing understanding of "${concept}". Target the learner's identified gaps. Each question should have 4 options with one correct answer. Add click-to-reveal correct answer with a brief explanation. Style with dark backgrounds, gold for correct answers, red for wrong. Make it interactive.`,
        tokens: 1400
      }
    };

    const p = prompts[type];
    return await call(p.system, p.user, p.tokens);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  return {
    analyzeGaps,
    explainConcept,
    generateStressTest,
    evaluateStressTest,
    scoreFinalTeachBack,
    generateArtifact,
    renderText
  };

})();
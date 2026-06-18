# 🧠 Understanding Auditor

> "Because thinking you know it and actually knowing it are two entirely different things."

Ever felt like you *mostly* get a complex topic, but the second you try to explain it to someone else, your brain totally blue-screens? Yeah, me too. 

I built **Understanding Auditor** to fix that. It is an AI-powered learning pipeline that rigorously audits your knowledge gaps, stress-tests your understanding, forces you to teach the concept back, and generates custom study artifacts you can actually take with you.

## ⚡ The Pipeline

| Stage | What it does | Why it matters |
| :--- | :--- | :--- |
| **1. Diagnostic** | Hits you with a custom multiple-choice quiz upfront. | Exposes what you *don't* know before you even start studying. |
| **2. Gap Analysis** | The AI breaks down exactly why you got questions wrong. | Stops you from memorizing mistakes. |
| **3. The Explainer** | Delivers a targeted breakdown of the concept. | Fills in the specific craters in your knowledge. |
| **4. Stress Test** | Open-ended, brutal questions. No multiple choice. | Forces you to recall information, not just recognize it. |
| **5. Teach-Back** | You write out an explanation as if teaching a beginner. | The ultimate test of mastery (The Feynman Technique). |
| **6. Artifacts** | Generates offline PDFs, Flashcards, and Slide Decks. | Gives you hard copies of your success. |

## 🛠️ Built With

No bloated frameworks. Just clean, fast, vanilla code.

* **Frontend:** HTML, CSS, Vanilla JavaScript
* **AI Brain:** [Google Gemini 3.1 Flash Lite API](https://ai.google.dev/)
* **Artifact Generation:** [jsPDF](https://github.com/parallax/jsPDF) (Native PDF painting) & [html2canvas](https://html2canvas.hertzen.com/)
* **Deployment:** [Vercel](https://vercel.com/)

## 🚀 Run it Locally

1. Clone the repo:
   `git clone https://github.com/your-username/understanding-auditor.git`
2. Open the directory:
   `cd understanding-auditor`
3. Add your Gemini API key to your `.env` file or backend logic.
4. Launch with a local server (e.g., Live Server or `npx serve`).

## 📜 License & Copyright

&copy; 2026 Your Name. All rights reserved.
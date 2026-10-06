import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function clip(text, max) {
  if (!text) return '';
  text = String(text).trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

const BASE_CONTEXT =
  'You are a warm, friendly, encouraging mentor for Beyond Circumstances, a free venture ' +
  'program for teen founders (ages 13-18) in Delhi and Gurgaon, India. Respond in plain ' +
  'conversational text — no markdown headers, no bullet lists, no bold text. Be encouraging ' +
  'but honest, not just complimentary. Never just hand the student the answer or write their ' +
  'content for them — your job is to help them think it through themselves, point out gaps, ' +
  'and ask them the right questions, not to do the work.';

const STAGE_LABEL = { research: 'confirming a problem is real', plan: 'writing a project or business plan', pitch: 'practicing an elevator pitch' };

const REVIEW_PROMPTS = {
  research:
    BASE_CONTEXT +
    ' A student is trying to confirm a problem is real before building anything for it. ' +
    "They've logged research notes and/or attached a PDF of their research. Read what " +
    "they've gathered and respond in 4-6 sentences: whether their evidence actually supports " +
    'that this problem is real and worth solving, one specific gap or weak spot in their ' +
    'research, and one concrete next thing to look into or ask about. If their evidence is ' +
    'thin, say so directly.',
  plan:
    BASE_CONTEXT +
    ' A student has written a first draft of a project or business plan. Respond in 4-6 ' +
    'sentences: name one specific strength, then one concrete thing to improve or think ' +
    'through next — feasibility, clarity, who it actually serves, etc.',
  pitch:
    BASE_CONTEXT +
    ' A student has recorded and transcribed a short elevator pitch for their project. ' +
    'Respond in 4-6 sentences covering three things: how clear the structure of their pitch ' +
    'was (did it flow logically), how clearly they explained the problem, and how clearly ' +
    'they explained their solution. Name one specific strength and one concrete thing to improve.',
};

function askPrompt(stage) {
  return (
    BASE_CONTEXT +
    ' The student is currently working on ' + STAGE_LABEL[stage] + ' and has a specific ' +
    "question. Answer it directly and helpfully in 3-5 sentences, using whatever work-in-" +
    "progress context they've given you. Do not write their research, plan, or pitch for " +
    'them — guide them toward figuring it out themselves.'
  );
}

const LANGUAGE_NAMES = { hi: 'Hindi', ur: 'Urdu' };

function languageInstruction(lang) {
  if (!LANGUAGE_NAMES[lang]) return '';
  return ' Respond entirely in ' + LANGUAGE_NAMES[lang] + ', written in its native script, not English — including if the student wrote their question or notes in English.';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const body = req.body || {};
  const stage = body.stage;
  const mode = body.mode === 'ask' ? 'ask' : 'review';
  if (!REVIEW_PROMPTS[stage]) {
    return res.status(400).json({ error: 'Unknown or missing stage' });
  }

  const interest = clip(body.interest, 60);
  const question = clip(body.question, 500);
  const lang = body.language === 'hi' || body.language === 'ur' ? body.language : 'en';

  if (mode === 'ask' && !question) {
    return res.status(400).json({ error: 'Type a question first.' });
  }

  try {
    let userContent;

    if (stage === 'research') {
      const problemLog = clip(body.problemLog, 4000);
      const pdfBase64 = mode === 'review' ? body.pdfBase64 : null;
      const pdfName = clip(body.pdfName, 120);

      if (mode === 'review' && !problemLog && !pdfBase64) {
        return res.status(400).json({ error: 'Add some research notes or a PDF first.' });
      }

      const blocks = [];
      if (pdfBase64) {
        blocks.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
        });
      }
      let text = 'Area of interest: ' + (interest || '(not set)') + '\n\n';
      text += problemLog ? 'Research log so far:\n' + problemLog : 'No research logged yet.';
      if (pdfName) text += '\n\n(Attached file: ' + pdfName + ')';
      if (mode === 'ask') text += '\n\nStudent question: ' + question;
      blocks.push({ type: 'text', text });
      userContent = blocks;
    } else if (stage === 'plan') {
      const planText = clip(body.planText, 6000);
      if (mode === 'review' && !planText) {
        return res.status(400).json({ error: 'Write something in your plan first.' });
      }
      userContent =
        'Area of interest: ' + (interest || '(not set)') + '\n\nProject plan draft so far:\n' +
        (planText || '(nothing written yet)') +
        (mode === 'ask' ? '\n\nStudent question: ' + question : '');
    } else if (stage === 'pitch') {
      const transcript = clip(body.transcript, 4000);
      if (mode === 'review' && !transcript) {
        return res.status(400).json({ error: 'Record or write your pitch first.' });
      }
      userContent =
        'Area of interest: ' + (interest || '(not set)') + '\n\nPitch transcript so far:\n' +
        (transcript || '(nothing recorded yet)') +
        (mode === 'ask' ? '\n\nStudent question: ' + question : '');
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: (mode === 'ask' ? askPrompt(stage) : REVIEW_PROMPTS[stage]) + languageInstruction(lang),
      messages: [{ role: 'user', content: userContent }],
    });

    const block = msg.content && msg.content.find((b) => b.type === 'text');
    const feedback = block && block.text ? block.text.trim() : "Sorry, I couldn't generate a response just now.";

    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Anthropic error:', err);
    return res.status(502).json({ error: 'The AI mentor is unavailable right now. Try again shortly.' });
  }
}

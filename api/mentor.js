import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function clip(text, max) {
  if (!text) return '';
  text = String(text).trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

const BASE_CONTEXT =
  'You are a warm, encouraging startup mentor for Beyond Circumstances, a free venture ' +
  'program for teen founders (ages 13-18) in Delhi and Gurgaon, India. Respond in plain ' +
  'conversational text — no markdown headers, no bullet lists, no bold text. Be encouraging ' +
  'but honest, not just complimentary.';

const PROMPTS = {
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const body = req.body || {};
  const stage = body.stage;
  if (!PROMPTS[stage]) {
    return res.status(400).json({ error: 'Unknown or missing stage' });
  }

  const interest = clip(body.interest, 60);

  try {
    let userContent;

    if (stage === 'research') {
      const problemLog = clip(body.problemLog, 4000);
      const pdfBase64 = body.pdfBase64;
      const pdfName = clip(body.pdfName, 120);

      if (!problemLog && !pdfBase64) {
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
      text += problemLog ? 'Research log:\n' + problemLog : 'No log entries — see attached PDF.';
      if (pdfName) text += '\n\n(Attached file: ' + pdfName + ')';
      blocks.push({ type: 'text', text });
      userContent = blocks;
    } else if (stage === 'plan') {
      const planText = clip(body.planText, 6000);
      if (!planText) {
        return res.status(400).json({ error: 'Write something in your plan first.' });
      }
      userContent = 'Area of interest: ' + (interest || '(not set)') + '\n\nProject plan draft:\n' + planText;
    } else if (stage === 'pitch') {
      const transcript = clip(body.transcript, 4000);
      if (!transcript) {
        return res.status(400).json({ error: 'Record or write your pitch first.' });
      }
      userContent = 'Area of interest: ' + (interest || '(not set)') + '\n\nPitch transcript:\n' + transcript;
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: PROMPTS[stage],
      messages: [{ role: 'user', content: userContent }],
    });

    const block = msg.content && msg.content.find((b) => b.type === 'text');
    const feedback = block && block.text ? block.text.trim() : "Sorry, I couldn't generate feedback just now.";

    return res.status(200).json({ feedback });
  } catch (err) {
    console.error('Anthropic error:', err);
    return res.status(502).json({ error: 'The AI mentor is unavailable right now. Try again shortly.' });
  }
}

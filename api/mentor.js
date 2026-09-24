import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function clip(text, max) {
  if (!text) return '';
  text = String(text).trim();
  return text.length > max ? text.slice(0, max) + '…' : text;
}

const SYSTEM_PROMPT =
  'You are a warm, encouraging startup mentor for Beyond Circumstances, a free venture ' +
  'program for teen founders (ages 13-18) in Delhi and Gurgaon, India. A student is working ' +
  "through the early stages of a project or business idea and wants feedback. Respond in " +
  '4-6 short sentences of plain conversational text — no markdown headers, no bullet lists, ' +
  'no bold text. Name one specific strength in their idea, then one concrete, specific thing ' +
  'to improve or think through next. Be encouraging but honest — do not just praise, and do ' +
  "not invent details they didn't give you. If they asked a specific question, answer it " +
  'directly first, then add the strength/improvement framing.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'Server is missing ANTHROPIC_API_KEY' });
  }

  const body = req.body || {};
  const title = clip(body.title, 200);
  const problem = clip(body.problem, 600);
  const helps = clip(body.helps, 400);
  const solution = clip(body.solution, 600);
  const feasible = clip(body.feasible, 600);
  const steps = clip(body.steps, 600);
  const question = clip(body.question, 400);

  if (!title && !problem && !solution) {
    return res.status(400).json({ error: 'Add a bit more to your project before asking for feedback.' });
  }

  const projectSummary =
    'Project title: ' + (title || '(none yet)') + '\n' +
    'Problem: ' + (problem || '(none yet)') + '\n' +
    'Who it helps: ' + (helps || '(none yet)') + '\n' +
    'Proposed solution: ' + (solution || '(none yet)') + '\n' +
    'Why this could work: ' + (feasible || '(none yet)') + '\n' +
    'Next steps: ' + (steps || '(none yet)');

  const userMessage = question
    ? projectSummary + '\n\nSpecific question from the student: ' + question
    : projectSummary + '\n\nGive general feedback on this project idea.';

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = msg.content && msg.content.find(function (b) { return b.type === 'text'; });
    const feedback = block && block.text ? block.text.trim() : "Sorry, I couldn't generate feedback just now.";

    return res.status(200).json({ feedback: feedback });
  } catch (err) {
    console.error('Anthropic error:', err);
    return res.status(502).json({ error: 'The AI mentor is unavailable right now. Try again shortly.' });
  }
}

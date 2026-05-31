/**
 * Lightweight follow-up prompts after an assistant reply (no extra API calls).
 */
export function generateFollowUpSuggestions(lastAssistantContent: string): string[] {
  const t = lastAssistantContent.toLowerCase();
  const out: string[] = [];
  const push = (s: string) => {
    if (!out.includes(s)) out.push(s);
  };

  if (/pest|insect|larva|caterpillar|aphid|thrips|whitefly|borer|jassid|mite/.test(t)) {
    push('Pre-harvest interval (PHI) and re-entry precautions for farmers?');
    push('Bio-pesticide or IPM-compatible alternatives for the same pest?');
  }
  if (/fertiliz|urea|dap|npk|ssp|potash|micronutrient|zinc|boron|sulphur/.test(t)) {
    push('Simple per-acre schedule: basal vs topdress for my farmer?');
    push('How to explain cost per acre vs expected yield bump in plain terms?');
  }
  if (/irrigat|water|moisture|drip|flood|canal/.test(t)) {
    push('How to judge irrigation need without gadgets in the field?');
    push('Stress signs if we cut one irrigation wrongly — what to watch?');
  }
  if (/disease|fungus|blight|rust|wilt|smut|mildew|tikka/.test(t)) {
    push('Field symptoms to confirm this before recommending a fungicide.');
    push('Resistance risk — alternate MoA suggestions for dealers?');
  }
  if (/weather|rain|monsoon|drought|frost|hail/.test(t)) {
    push('Short contingency plan if rain delays sowing/transplant.');
  }

  const defaults = [
    'Give me the 3 bullet points I should tell my farmer today.',
    'Any local-extension or KVK checks before we commit to this?',
    'Translate the main takeaway into natural Hinglish for my farmer.',
    'Safety: PPE, tank-mix cautions, and bee-friendly timings — quick recap.',
  ];
  for (const d of defaults) {
    if (out.length >= 3) break;
    push(d);
  }

  return out.slice(0, 3);
}

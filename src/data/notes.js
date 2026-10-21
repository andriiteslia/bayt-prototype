// Design notes shown next to the prototype (desktop) or in a sheet (mobile).
// Keep in sync with README.md.

export const NOTES = {
  intro: {
    title: 'Describe your next home',
    text: 'A renter describes the home they want in their own words. Above the results, the app shows what it understood and how sure it is. Every part of that can be fixed with one tap or a sentence. The short list below explains itself, including the bad parts.',
    bet: 'The hard part isn\'t parsing the sentence. It\'s getting someone to trust the result enough to message an agent from another country.',
  },

  framing: {
    persona: {
      name: 'Anna, 32, relocating from London',
      line: 'New job in DIFC, moving in March with her partner and a dog. Has never lived in Dubai.',
    },
    assumptions: [
      ['She knows her life, not the map', 'She can say "quiet, 25 minutes to work". She can\'t say "JLT or JVC". The app has to turn needs into areas, and explain each area in one line.'],
      ['Her budget comes from a relocation package', 'She doesn\'t know what it buys. If a request can\'t be met, she should hear that up front with a real number, not find out from an empty list.'],
      ['She\'ll shortlist from abroad', 'She can\'t check things in person, so every claim needs a source, and anything we don\'t know has to show.'],
      ['Car or metro is still undecided', 'That changes which areas make sense more than anything else, so it\'s worth asking. Travel times are ranges at rush hour, never one optimistic number.'],
    ],
    why: 'Her words and the portal\'s filters are furthest apart. A Dubai local can type "JLT 2BR 120k". Anna can\'t. That\'s where AI helps most, and where trust is hardest to earn.',
    job: 'Get from a vague description to five or fewer homes she\'d feel safe contacting.',
    out: ['Maps', 'Booking viewings', 'Chat with agents', 'Neighbourhood guides beyond one line', 'Buying'],
    changed: 'Anything you type is read by a live model (Claude Haiku) behind a serverless function, so the key never reaches the browser. If the model is slow, down or returns something that fails validation, a scripted keyword reader with the same output takes over, and the screen says "Basic reading". The guided examples use that fixed reading on purpose, so every reviewer sees the same edge case behave the same way.',
  },

  decisions: [
    {
      title: 'The reading sits above the results, always',
      why: 'A quiet misreading does the most damage to trust. If "quiet" became "Downtown", nothing on the screen would tell her. So the reading is never a separate step and never fully hidden.',
      cost: 'It costs space above the first home. See the next decision.',
    },
    {
      title: 'Collapsed by default, but the guesses stay visible',
      why: 'Results come first: the reading starts as one line, with my guesses (dashed) leading and a count like "2 guesses to check". Any chip is still one tap to fix. It opens on its own when it needs attention: a basic reading, a refused filter or an out-of-scope request.',
      cost: 'Fewer people will open the full reading. That\'s fine if they still see and fix the guesses; the test plan checks exactly that.',
    },
    {
      title: 'Three levels of certainty, always visible',
      why: 'You said (solid) · I assumed (dashed, with the reasoning one tap away) · Can\'t check (grey). Being honest about what the AI knows means showing where it guessed.',
      cost: 'Three styles to learn. A one-screen legend covers it, and it\'s a test question: do people get the difference?',
    },
    {
      title: 'Must have vs nice to have',
      why: 'One sentence has to become a filter and a ranking. Must-haves hide homes. Nice-to-haves only change the order. Numbers she gives are must-haves, vibes are nice-to-haves, and each one is a tap to flip.',
      cost: 'The default weight can be wrong. It\'s visible and one tap to change, so the cost of a wrong guess stays small.',
    },
    {
      title: 'Ask only what changes the result',
      why: 'At most three tappable questions, and only when budget, bedrooms or travel mode are missing. Guessing a budget would hand a newcomer a confident list that\'s wrong.',
      cost: 'One extra step for vague requests. Every question can be skipped.',
    },
    {
      title: 'The model reads; our data answers',
      why: 'The model only turns words into criteria, from a fixed list of fields and areas. Matching, prices and every fact on a card come from listing data, labelled Agent or Estimate. It can\'t make up a flat.',
      cost: 'No free-form questions about a listing in v1. That\'s on purpose.',
    },
    {
      title: 'Problems first on every card',
      why: 'What doesn\'t fit, what\'s partial and what isn\'t stated come above what matches. "Pets not stated — ask the agent" is more useful than another green tick.',
      cost: 'Cards look less salesy. Trust before click-through is a bet worth testing with agents too.',
    },
    {
      title: 'Words and filters are the same state',
      why: 'The Filters view shows the reading in the form she already knows. It\'s a way out for people who prefer filters, and it shows what words add: several wishes have no filter at all.',
      cost: 'Two ways to edit one thing. Both change the same state, so they can\'t drift apart.',
    },
    {
      title: 'Saying no is part of the design',
      why: 'Requests to filter by who lives nearby are refused out loud, and something useful is offered instead: quiet streets, gated communities. "Safe" goes under can\'t check. We don\'t make up a safety score.',
      cost: 'Some users want exactly that filter. Being transparent beats a quiet proxy that does the same thing.',
    },
  ],

  scenarios: [
    { title: 'Vague newcomer', text: "I'm moving from London in March for a job in DIFC and don't know the city at all. We have a dog.", look: 'It doesn\'t guess a budget. It asks three skippable questions, then shows one-line area intros on each card.' },
    { title: 'Clear request, honest trade-offs', text: "Somewhere quiet, 2 bedrooms, under 140k. I don't want to drive more than 25 minutes to DIFC, and a park I can walk my dog to.", look: 'The reading is one line with two dashed guesses. Tap "Quiet" to see how it was read. Tap Show, then Filters: half the request has no filter.' },
    { title: 'Conflicting / unrealistic', text: '3 bedroom in Downtown under 90k', look: 'No empty screen. It gives the real starting price, which single must-have to relax and how many homes each option unlocks.' },
    { title: 'Unverifiable & discriminatory', text: 'A safe area with nice neighbours, no families with kids, 1 bedroom near the metro under 110k', look: 'It declines the demographic filter and offers an alternative. "Safe" and "neighbours" go under can\'t check.' },
    { title: 'Correct it in words', text: null, look: 'After any search, type "forget the park", "flexible on budget" or "actually 3 bedrooms". Each change comes with Undo.' },
    { title: 'Your own words', text: null, look: 'Type anything in the phone. The live model reads it and you\'ll see "Read by AI" with the time it took. Try slang, a monthly budget, a workplace, or something it can\'t check.' },
  ],

  production: [
    ['Architecture', 'One model call with forced tool use and a strict schema: criteria with certainty, quote and reasoning, plus can\'t-check, declined and out-of-scope notes. Fields and areas come from fixed lists. The server validates everything: unknown fields and areas are dropped, and a "you said" without the renter\'s actual words is downgraded to "I assumed". Search and ranking run on the listing data, never on the model.'],
    ['Latency', 'Target: the reading on screen in under 1.5 s. Use a small, fast model, stream the chips, and run search alongside the reading. A refinement sends only what changed, not a new conversation.'],
    ['Cost', 'About 1–2k tokens per reading on a small model: fractions of a cent per search. Cache common phrases ("near the metro", "quiet"). Use a larger model only when the input is ambiguous.'],
    ['Data quality', 'The real risk. Pets, furnishing, noise and availability are often missing or out of date. The design assumes gaps and shows them. Production needs prompts for agents to complete listings, and freshness flags.'],
    ['Risks', 'Made-up facts (the model never writes listing data) · discriminatory filtering (refused out loud, policy list) · trusting estimates too much (ranges, labels, "ask the agent") · a quiet misreading (the reading is always shown).'],
  ],

  test: {
    first: 'Week 1: 6–8 people relocating to Dubai within six months, moderated, remote, on their own phones.',
    tasks: ['Describe your next home in your own words', 'Fix something it got wrong', 'Pick two homes you\'d contact, and say why'],
    watch: ['Do they read the reading at all?', 'Do they get said / assumed / can\'t check?', 'Do they fix things by tapping, typing, or switching to Filters?', 'What makes them stop trusting a result?'],
    then: 'Then a limited A/B against filters:',
    metrics: [
      ['Primary', 'Sessions that reach a contacted listing · time to first contact'],
      ['Reading quality', 'Chips edited or removed. High means we misread. Zero means nobody looks.'],
      ['Trust', '"Was this listing what you expected?" after contact · mismatch rate reported by agents'],
      ['Guardrails', 'Zero-result rate · more than three refinements in a row · fallback rate · p95 latency · cost per session'],
    ],
  },

  next: ['Map view of the list', 'Travel time by hour of day', 'Arabic and right-to-left layout', 'Voice input', 'Compare two homes', 'Remember the last search'],
};

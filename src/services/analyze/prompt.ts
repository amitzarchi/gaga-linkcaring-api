export function buildPrompt(args: {
  basePrompt: string;
  milestoneName: string;
  validators: Array<{ description: string }>;
}): string {
  const { basePrompt, milestoneName, validators } = args;
  const validatorsList = validators.map((v) => `- ${v.description}`).join("\n");
  const sections = [
    basePrompt,
    `Milestone: ${milestoneName}`,
    `Validators:\n${validatorsList}`,
  ];
  return sections.filter(Boolean).join("\n\n");
}



export function portraitPrompt(input: {
  characterName: string
  characterPrompt: string
  style: string
}): string {
  return `Generate one 9:16 storybook portrait of exactly ${input.characterName}.
Follow this visual art direction: ${input.style}
Character description: ${input.characterPrompt}
Show no unrelated characters. Produce a display-ready character portrait.`
}

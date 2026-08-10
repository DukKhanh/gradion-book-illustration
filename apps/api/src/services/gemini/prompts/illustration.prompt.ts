export function illustrationPrompt(input: {
  chapterName: string
  chapterPrompt: string
  style: string
}): string {
  return `Create exactly one wide, display-ready storybook scene illustration.
Chapter: ${input.chapterName}
Scene: ${input.chapterPrompt}
Art direction: ${input.style}
Follow the established character portrayal implied by the scene. Do not add an
unrelated scene or generate text output.`
}

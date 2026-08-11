export function illustrationPrompt(input: {
  chapterName: string
  chapterPrompt: string
  style: string
  characterReferences: Array<{ name: string, prompt: string }>
}): string {
  const references = input.characterReferences
    .map((character, index) => `Reference ${index + 1}: ${character.name}\nPersisted character direction: ${character.prompt}`)
    .join('\n\n')

  return `Create exactly one wide, display-ready storybook scene illustration.
Chapter: ${input.chapterName}
Scene: ${input.chapterPrompt}
Art direction: ${input.style}

The JPEG images supplied with this request are the canonical portrait references
for the named characters below. Preserve their recognizable facial features,
age, hairstyle, clothing design, and overall visual identity when they appear in
the scene. Adapt pose, expression, framing, and lighting to the chapter scene,
but do not redesign the characters.

${references}

Do not add unrelated characters or scenes. Do not render captions, labels, or
other text in the image. Return only the requested illustration.`
}

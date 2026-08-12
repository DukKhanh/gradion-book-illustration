import { useState } from 'react'

type PromptDisclosureProps = {
  prompt: string
  label?: string
  hideLabel?: string
  onOpenChange?: (open: boolean) => void
}

export function PromptDisclosure({
  prompt,
  label = 'View prompt',
  hideLabel = 'Hide prompt',
  onOpenChange,
}: PromptDisclosureProps) {
  const [open, setOpen] = useState(false)

  function handleToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    const nextOpen = event.currentTarget.open
    setOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return (
    <details className="prompt-disclosure" open={open} onToggle={handleToggle}>
      <summary>{open ? hideLabel : label}</summary>
      <div className="prompt-disclosure__wrapper">
        <div className="prompt-disclosure__inner">
          <div className="prompt-disclosure__content">
            <span className="prompt-disclosure__label">Generation prompt</span>
            <p>{prompt}</p>
          </div>
        </div>
      </div>
    </details>
  )
}

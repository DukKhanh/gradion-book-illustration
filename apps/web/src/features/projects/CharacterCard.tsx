import type { CharacterDto } from '../../api/types'
import { PromptDisclosure } from './PromptDisclosure'

type CharacterCardProps = {
  character: CharacterDto
}

export function CharacterCard({ character }: CharacterCardProps) {
  return (
    <article className="character-card">
      <div className={`character-card__media character-card__media--${character.generationStatus.toLowerCase()}`}>
        {character.portraitUrl ? (
          <img
            src={character.portraitUrl}
            alt={`Portrait of ${character.name}`}
            loading="lazy"
          />
        ) : (
          <PortraitState
            status={character.generationStatus}
            error={character.generationError}
          />
        )}
      </div>

      <div className="character-card__content">
        <h3>{character.name}</h3>
        <p className="character-prompt-preview">{character.prompt}</p>
        <PromptDisclosure prompt={character.prompt} />
      </div>
    </article>
  )
}

function PortraitState({ status, error }: { status: string; error: string | null }) {
  if (status === 'RUNNING') {
    return (
      <div className="portrait-state portrait-state--running" role="status">
        <span className="portrait-spinner" aria-hidden="true" />
        <strong>Generating portrait…</strong>
        <span>This portrait will appear as soon as it is saved.</span>
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="portrait-state portrait-state--failed">
        <strong>Portrait failed</strong>
        <span>{error ?? 'Retry the PORTRAITS step to continue.'}</span>
      </div>
    )
  }

  if (status === 'DONE') {
    return (
      <div className="portrait-state">
        <strong>Portrait unavailable</strong>
        <span>The saved portrait could not be displayed.</span>
      </div>
    )
  }

  return (
    <div className="portrait-state">
      <strong>Portrait pending</strong>
      <span>Waiting for this portrait.</span>
    </div>
  )
}

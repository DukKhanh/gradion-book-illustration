import { useState } from 'react'

import type { ProjectDetailDto } from '../../../api/types'
import { PromptDisclosure } from './PromptDisclosure'

type Chapter = ProjectDetailDto['chapters'][number]

type ChapterCardProps = {
  chapter: Chapter
}

export function ChapterCard({ chapter }: ChapterCardProps) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <article className={`chapter-card${promptOpen ? ' chapter-card--expanded' : ''}`}>
      <div className="chapter-card__media">
        {chapter.illustrationUrl ? (
          <img
            className="chapter-card__image"
            src={chapter.illustrationUrl}
            alt={`Illustration for ${chapter.name}`}
            loading="lazy"
          />
        ) : (
          <div className="illustration-placeholder">Illustration pending</div>
        )}
      </div>

      <div className="chapter-card__content">
        <div className="chapter-card__heading">
          <h3>{chapter.name}</h3>
          <PromptDisclosure
            prompt={chapter.prompt}
            label="View prompt"
            hideLabel="Hide prompt"
            onOpenChange={setPromptOpen}
          />
        </div>
      </div>
    </article>
  )
}

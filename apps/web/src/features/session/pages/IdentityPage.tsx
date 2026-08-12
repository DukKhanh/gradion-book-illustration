import { useState, type FormEvent } from 'react'

import { useSession } from '../SessionProvider'
import './IdentityPage.css'

export function IdentityPage() {
  const { identify } = useSession()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    identify.mutate({ name: name.trim(), email: email.trim() })
  }

  return <main className="welcome-page"><section className="identity-card">
    <p className="eyebrow">GRADION BOOK ILLUSTRATION STUDIO</p>
    <h1>Bring a book to life.</h1>
    <p className="lede">Start a private project, then guide its illustrated story through the studio.</p>
    <form onSubmit={submit} aria-describedby={identify.isError ? 'identity-error' : undefined}>
      <label htmlFor="identity-name">Your name</label>
      <input id="identity-name" value={name} onChange={(event) => setName(event.target.value)} required />
      <label htmlFor="identity-email">Email address</label>
      <input id="identity-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      {identify.isError && <p id="identity-error" className="form-error" role="alert">{identify.error.message}</p>}
      <button className="primary-button" disabled={identify.isPending}>{identify.isPending ? 'Entering studio…' : 'Enter studio'}</button>
    </form>
  </section></main>
}

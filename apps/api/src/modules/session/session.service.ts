import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import { HttpError } from '../../shared/http-error.js'
import type { User } from './user.repository.js'
import { UserRepository } from './user.repository.js'

const identitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
})

export class SessionService {
  constructor(private readonly users: UserRepository) {}

  async identify(input: unknown): Promise<User> {
    const parsed = identitySchema.safeParse(input)
    if (!parsed.success) {
      throw new HttpError('Name and email are required.', 400)
    }

    const email = parsed.data.email.toLowerCase()
    const existing = await this.users.findByEmail(email)
    if (existing) {
      return existing
    }

    const user: User = {
      id: randomUUID(),
      name: parsed.data.name,
      email,
      createdAt: new Date(),
    }

    try {
      return await this.users.create(user)
    } catch {
      const concurrentUser = await this.users.findByEmail(email)
      if (concurrentUser) {
        return concurrentUser
      }
      throw new HttpError('Could not create identity.', 500)
    }
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId)
    if (!user) {
      throw new HttpError('Session user not found.', 401)
    }
    return user
  }
}

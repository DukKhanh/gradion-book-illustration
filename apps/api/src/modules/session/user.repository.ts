import { eq } from 'drizzle-orm'

import { db } from '../../db/client.js'
import { users } from '../../db/schema.js'

export type User = {
  id: string
  name: string
  email: string
  createdAt: Date
}

export class UserRepository {
  constructor(private readonly database: typeof db = db) {}

  async findByEmail(email: string): Promise<User | null> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.email, email))
    return user ?? null
  }

  async findById(id: string): Promise<User | null> {
    const [user] = await this.database
      .select()
      .from(users)
      .where(eq(users.id, id))
    return user ?? null
  }

  async create(user: User): Promise<User> {
    await this.database.insert(users).values(user)
    return user
  }
}

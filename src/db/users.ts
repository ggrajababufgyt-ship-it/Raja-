import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  avatarUrl?: string
) {
  try {
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      const nextEmail = email || current.email;
      const nextAvatar = avatarUrl ?? current.avatarUrl;
      if (nextEmail !== current.email || nextAvatar !== current.avatarUrl) {
        const updated = await db
          .update(users)
          .set({
            email: nextEmail,
            avatarUrl: nextAvatar,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: email || `${uid}@speakup.user`,
        name: name || (email ? email.split('@')[0] : 'Learner'),
        avatarUrl: avatarUrl || null,
        currentLevel: 1,
        completedLevels: [],
        streakCount: 0,
        totalQuestionsAnswered: 0,
        totalScoreSum: 0,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: email || `${uid}@speakup.user`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to load user profile. Please try again.', { cause: error });
  }
}

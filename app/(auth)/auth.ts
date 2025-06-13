import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createGuestUser, getUser, findOrCreateGuestUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/constants';
import type { DefaultJWT } from 'next-auth/jwt';

export type UserType = 'guest' | 'regular';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    telegramId?: number | null;
    telegramUsername?: string | null;
    telegramFirstName?: string | null;
    telegramLastName?: string | null;
    telegramPhotoUrl?: string | null;
    telegramLanguageCode?: string | null;
    telegramIsPremium?: boolean | null;
    telegramAllowsWriteToPm?: boolean | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {},
      async authorize({ email, password }: any) {
        const users = await getUser(email);

        if (users.length === 0) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        const [user] = users;

        if (!user.password) {
          await compare(password, DUMMY_PASSWORD);
          return null;
        }

        // Special handling for Telegram authentication
        if (password === 'telegram_auth' && user.telegramId) {
          return { ...user, type: 'regular' };
        }

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) return null;

        return { ...user, type: 'regular' };
      },
    }),
    Credentials({
      id: 'guest',
      credentials: {},
      async authorize() {
        // Use findOrCreateGuestUser to reuse existing unused guest users
        const [guestUser] = await findOrCreateGuestUser();
        return { ...guestUser, type: 'guest' };
      },
    }),
  ],
});

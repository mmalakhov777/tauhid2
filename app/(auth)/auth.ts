import { compare } from 'bcrypt-ts';
import NextAuth, { type DefaultSession } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { createGuestUser, getUser, getUserByTelegramId, createOrUpdateTelegramUser } from '@/lib/db/queries';
import { authConfig } from './auth.config';
import { DUMMY_PASSWORD } from '@/lib/constants';
import type { DefaultJWT } from 'next-auth/jwt';

export type UserType = 'guest' | 'regular' | 'telegram';

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
      telegramId?: number;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
    telegramId?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
    telegramId?: number;
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

        const passwordsMatch = await compare(password, user.password);

        if (!passwordsMatch) return null;

        return { 
          id: user.id,
          email: user.email,
          type: 'regular' as UserType,
        };
      },
    }),
    Credentials({
      id: 'guest',
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { 
          id: guestUser.id,
          email: guestUser.email,
          type: 'guest' as UserType,
        };
      },
    }),
    Credentials({
      id: 'telegram',
      credentials: {
        telegramId: { type: 'number' },
        username: { type: 'text' },
        firstName: { type: 'text' },
        lastName: { type: 'text' },
        photoUrl: { type: 'text' },
        languageCode: { type: 'text' },
        isPremium: { type: 'boolean' },
        allowsWriteToPm: { type: 'boolean' },
      },
      async authorize(credentials) {
        if (!credentials?.telegramId) return null;
        
        const telegramUser = await createOrUpdateTelegramUser({
          telegramId: Number(credentials.telegramId),
          username: credentials.username as string | undefined,
          firstName: credentials.firstName as string,
          lastName: credentials.lastName as string | undefined,
          photoUrl: credentials.photoUrl as string | undefined,
          languageCode: credentials.languageCode as string | undefined,
          isPremium: credentials.isPremium === 'true',
          allowsWriteToPm: credentials.allowsWriteToPm === 'true',
        });
        
        return {
          id: telegramUser.id,
          email: telegramUser.email,
          type: 'telegram',
          telegramId: telegramUser.telegramId!,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        if (user.telegramId) {
          token.telegramId = user.telegramId;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
        if (token.telegramId) {
          session.user.telegramId = token.telegramId;
        }
      }

      return session;
    },
  },
});

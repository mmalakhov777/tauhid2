import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    newUser: '/',
  },
  providers: [
    // added later in auth.ts since it requires bcrypt which is only compatible with Node.js
    // while this file is also used in non-Node.js environments
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days for better session persistence
    updateAge: 24 * 60 * 60, // 24 hours - update session every day
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      // Persist user data in JWT
      if (user) {
        token.id = user.id as string;
        token.type = user.type;
        // Store all Telegram user data in JWT token
        token.telegramId = user.telegramId;
        token.telegramUsername = user.telegramUsername;
        token.telegramFirstName = user.telegramFirstName;
        token.telegramLastName = user.telegramLastName;
        token.telegramPhotoUrl = user.telegramPhotoUrl;
        token.telegramLanguageCode = user.telegramLanguageCode;
        token.telegramIsPremium = user.telegramIsPremium;
        token.telegramAllowsWriteToPm = user.telegramAllowsWriteToPm;
      }
      
      // Log session updates for debugging
      if (trigger === 'update') {
        console.log('[auth.config] JWT token updated for user:', token.id);
      }
      
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (session.user && token) {
        session.user.id = token.id;
        session.user.type = token.type;
        // Include all Telegram user data in session
        session.user.telegramId = token.telegramId as number | null;
        session.user.telegramUsername = token.telegramUsername as string | null;
        session.user.telegramFirstName = token.telegramFirstName as string | null;
        session.user.telegramLastName = token.telegramLastName as string | null;
        session.user.telegramPhotoUrl = token.telegramPhotoUrl as string | null;
        session.user.telegramLanguageCode = token.telegramLanguageCode as string | null;
        session.user.telegramIsPremium = token.telegramIsPremium as boolean | null;
        session.user.telegramAllowsWriteToPm = token.telegramAllowsWriteToPm as boolean | null;
      }
      
      return session;
    },
  },
} satisfies NextAuthConfig;

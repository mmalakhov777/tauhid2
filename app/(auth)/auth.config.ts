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
      }
      
      return session;
    },
  },
} satisfies NextAuthConfig;

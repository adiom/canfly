import NextAuth from 'next-auth'
import { createAuthConfig } from './auth.config'

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth((request) => createAuthConfig(request))

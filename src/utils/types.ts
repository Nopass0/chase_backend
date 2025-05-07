/**
 * Common types used throughout the application
 */

import { Elysia } from 'elysia'

// Elysia context types
export interface ElysiaContext {
  request: Request
  ip: string
  error: (code: number, message: string) => Response
  set: {
    status?: number
    headers?: Record<string, string>
  }
}

// JWT related types
export interface JWTHandler {
  sign: (payload: Record<string, any>) => Promise<string>
  verify: (token: string) => Promise<Record<string, any> | null>
}

// User related types
export interface UserAuthBody {
  email: string
  password: string
}

export interface UserProfile {
  id: string
  email: string
  banned: boolean
}

// Admin related types
export interface AdminBanUserBody {
  id: string
}
export interface User {
  id: string
  username: string
  email: string
  displayName: string
  role: 'ADMIN' | 'MEMBER'
  householdId: string | null
  householdName: string | null
}

export interface AuthResponse {
  token: string
  tokenType: string
  userId: string
  username: string
  displayName: string
  role: string
  householdId: string | null
  householdName: string | null
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  displayName: string
  householdName?: string
  inviteCode?: string
}

export interface ApiError {
  message: string
  errors?: Record<string, string>
  timestamp: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  system: boolean
}

export interface BankAccount {
  id: string
  userId: string
  bankName: string
  accountNumberMasked: string | null
  accountType: string | null
  currency: string
}

export interface Transaction {
  id: string
  bankAccountId: string
  valueDate: string
  transactionDate: string
  rawRemarks: string
  merchantName: string | null
  withdrawalAmount: number
  depositAmount: number
  balance: number | null
  category: Category | null
  reviewed: boolean
}

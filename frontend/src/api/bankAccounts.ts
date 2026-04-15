import apiClient from './client'
import type { BankAccount } from '../types'

export interface BankAccountRequest {
  bankName: string
  accountNumberMasked?: string
  accountType?: string
}

export async function getBankAccounts(): Promise<BankAccount[]> {
  const { data } = await apiClient.get<BankAccount[]>('/bank-accounts')
  return data
}

export async function createBankAccount(req: BankAccountRequest): Promise<BankAccount> {
  const { data } = await apiClient.post<BankAccount>('/bank-accounts', req)
  return data
}

export async function updateBankAccount(id: string, req: BankAccountRequest): Promise<BankAccount> {
  const { data } = await apiClient.put<BankAccount>(`/bank-accounts/${id}`, req)
  return data
}

export async function deleteBankAccount(id: string): Promise<void> {
  await apiClient.delete(`/bank-accounts/${id}`)
}

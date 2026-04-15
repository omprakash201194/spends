import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Copy, Check, TrendingDown, TrendingUp, Crown } from 'lucide-react'
import { getHouseholdSummary, type HouseholdSummary, type MemberStat } from '../api/household'

// ── Helpers ───────────────────────────────────────────────────────────────────

function inr(n: number) {
  if (n >= 100000) return '₹' + (n / 100000).toFixed(1) + 'L'
  if (n >= 1000)   return '₹' + (n / 1000).toFixed(1) + 'K'
  return '₹' + n.toFixed(0)
}

function inrFull(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// Deterministic avatar colour based on name
const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-emerald-500',
  'bg-rose-500',  'bg-amber-500',  'bg-cyan-500',
]
function avatarColor(name: string) {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HouseholdPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['household'],
    queryFn: getHouseholdSummary,
    staleTime: 60_000,
  })

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Household</h1>
        {data && <p className="text-sm text-gray-500 mt-1">{data.month}</p>}
      </div>

      {isLoading && <LoadingSkeleton />}
      {isError   && <ErrorState />}
      {data      && <HouseholdContent data={data} />}
    </div>
  )
}

// ── Content ───────────────────────────────────────────────────────────────────

function HouseholdContent({ data }: { data: HouseholdSummary }) {
  const totalNet = data.totalIncome - data.totalSpent

  return (
    <>
      {/* Household header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-lg truncate">{data.householdName}</p>
            <p className="text-sm text-gray-400">{data.members.length} member{data.members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <InviteCodeChip code={data.inviteCode} />
      </div>

      {/* Aggregate stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-500">Total Spent</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{inr(data.totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs text-gray-500">Total Income</span>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{inr(data.totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500">Net</span>
          </div>
          <p className={`text-lg sm:text-xl font-bold ${totalNet >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {totalNet >= 0 ? '+' : ''}{inr(totalNet)}
          </p>
        </div>
      </div>

      {/* Member cards */}
      {data.members.length === 1 ? (
        <SoloState inviteCode={data.inviteCode} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.members.map(m => (
            <MemberCard key={m.userId} member={m} householdTotal={data.totalSpent} />
          ))}
        </div>
      )}
    </>
  )
}

// ── Invite code chip ──────────────────────────────────────────────────────────

function InviteCodeChip({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
      title="Copy invite code"
    >
      <div className="text-left">
        <p className="text-xs text-gray-400 leading-none mb-0.5">Invite code</p>
        <p className="font-mono font-bold text-gray-800 tracking-widest text-sm">{code}</p>
      </div>
      {copied
        ? <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        : <Copy className="w-4 h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" />
      }
    </button>
  )
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({ member, householdTotal }: { member: MemberStat; householdTotal: number }) {
  const hasData    = member.transactionCount > 0
  const shareOfTotal = householdTotal > 0 ? (member.totalSpent / householdTotal) * 100 : 0

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full ${avatarColor(member.displayName)} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
          {initials(member.displayName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 truncate">{member.displayName}</span>
            {member.role === 'ADMIN' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <Crown className="w-3 h-3" /> Admin
              </span>
            )}
          </div>
          {member.topCategory && (
            <span
              className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: member.topCategoryColor ?? '#94a3b8' }}
            >
              {member.topCategory}
            </span>
          )}
        </div>
      </div>

      {hasData ? (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Spent</p>
              <p className="font-bold text-gray-900">{inrFull(member.totalSpent)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-0.5">Income</p>
              <p className="font-bold text-gray-900">{inrFull(member.totalIncome)}</p>
            </div>
          </div>

          {/* Share of household spending */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">Share of household spend</span>
              <span className="text-xs font-medium text-gray-600">{shareOfTotal.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(shareOfTotal, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{member.transactionCount} transaction{member.transactionCount !== 1 ? 's' : ''}</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-400 text-center py-2">No transactions this month</p>
      )}
    </div>
  )
}

// ── Solo state (only 1 member) ────────────────────────────────────────────────

function SoloState({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
      <Users className="mx-auto w-10 h-10 text-gray-300 mb-3" />
      <p className="font-semibold text-gray-700 mb-1">You're the only member</p>
      <p className="text-sm text-gray-400 mb-5">Share the invite code with your household members so they can join.</p>
      <div className="inline-flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 mb-4">
        <span className="font-mono font-bold text-xl tracking-widest text-gray-800">{inviteCode}</span>
      </div>
      <div>
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
    </div>
  )
}

// ── Skeletons / states ────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-gray-100 rounded-xl h-20" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-20" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => <div key={i} className="bg-gray-100 rounded-xl h-40" />)}
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
      <Users className="mx-auto w-8 h-8 text-red-300 mb-2" />
      <p className="text-red-600 font-medium">Failed to load household data</p>
      <p className="text-sm text-red-400 mt-1">Check backend logs for details</p>
    </div>
  )
}

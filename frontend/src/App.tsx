import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import OAuth2CallbackPage from './pages/OAuth2CallbackPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import DashboardPage from './pages/DashboardPage'
import BankAccountsPage from './pages/BankAccountsPage'
import ImportPage from './pages/ImportPage'
import TransactionPage from './pages/TransactionPage'
import CategoriesPage from './pages/CategoriesPage'
import BudgetPage from './pages/BudgetPage'
import HouseholdPage from './pages/HouseholdPage'
import SettingsPage from './pages/SettingsPage'
import ViewsPage from './pages/ViewsPage'
import ViewDetailPage from './pages/ViewDetailPage'
import RecurringPage from './pages/RecurringPage'
import ReportsPage from './pages/ReportsPage'
import NetWorthPage from './pages/NetWorthPage'
import DataHealthPage from './pages/DataHealthPage'
import GoalsPage from './pages/GoalsPage'
import MerchantAliasesPage from './pages/MerchantAliasesPage'
import SettlementsPage from './pages/SettlementsPage'
import AlertsPage from './pages/AlertsPage'
import AnnualReviewPage from './pages/AnnualReviewPage'
import CustomDashboardPage from './pages/CustomDashboardPage'
import DashboardListPage from './pages/DashboardListPage'
import DashboardDetailPage from './pages/DashboardDetailPage'
import OnboardingPage from './pages/OnboardingPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useThemeStore } from './store/themeStore'
import { usePersonaStore } from './store/personaStore'
import { useAuthStore } from './store/authStore'

function ThemeApplier() {
  const { theme } = useThemeStore()
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])
  return null
}

// Redirects logged-in users to /onboarding if they haven't picked a persona yet
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  const { onboardingDone } = usePersonaStore()
  if (user && !onboardingDone) {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/oauth2/callback" element={<OAuth2CallbackPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <OnboardingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <OnboardingGuard>
                <Layout />
              </OnboardingGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<BankAccountsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="custom-dashboard" element={<CustomDashboardPage />} />
          <Route path="dashboards" element={<DashboardListPage />} />
          <Route path="dashboards/:id" element={<DashboardDetailPage />} />
          <Route path="budgets" element={<BudgetPage />} />
          <Route path="household" element={<HouseholdPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="net-worth" element={<NetWorthPage />} />
          <Route path="data-health" element={<DataHealthPage />} />
          <Route path="goals" element={<GoalsPage />} />
          <Route path="merchant-aliases" element={<MerchantAliasesPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="annual-review" element={<AnnualReviewPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import BankAccountsPage from './pages/BankAccountsPage'
import ImportPage from './pages/ImportPage'
import TransactionPage from './pages/TransactionPage'
import BudgetPage from './pages/BudgetPage'
import HouseholdPage from './pages/HouseholdPage'
import SettingsPage from './pages/SettingsPage'
import ViewsPage from './pages/ViewsPage'
import ViewDetailPage from './pages/ViewDetailPage'
import RecurringPage from './pages/RecurringPage'
import ReportsPage from './pages/ReportsPage'
import DataHealthPage from './pages/DataHealthPage'
import GoalsPage from './pages/GoalsPage'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useThemeStore } from './store/themeStore'

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

export default function App() {
  return (
    <BrowserRouter>
      <ThemeApplier />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="accounts" element={<BankAccountsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="transactions" element={<TransactionPage />} />
          <Route path="budgets" element={<BudgetPage />} />
          <Route path="household" element={<HouseholdPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="views" element={<ViewsPage />} />
          <Route path="views/:id" element={<ViewDetailPage />} />
          <Route path="recurring" element={<RecurringPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="data-health" element={<DataHealthPage />} />
          <Route path="goals" element={<GoalsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

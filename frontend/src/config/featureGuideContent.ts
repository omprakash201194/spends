export interface GuideFeature {
  icon: string
  title: string
  description: string
  tip?: string
}

export interface PageGuide {
  summary: string
  features: GuideFeature[]
}

export const PAGE_GUIDES: Record<string, PageGuide> = {
  '/': {
    summary: 'Your financial command centre — monthly stats, spending breakdown, alerts, and trends at a glance.',
    features: [
      {
        icon: '📊',
        title: 'Stat cards',
        description: 'Total spent, income, net savings, and transaction count for your anchor month (the most recent month with data — not necessarily today).',
      },
      {
        icon: '↕️',
        title: 'Month vs. year comparison',
        description: 'Toggle "vs last month" or "vs last year" above the cards. Arrows show whether spending is up or down, colour-coded by direction.',
        tip: 'Green ↓ on Spent means you spent less than the comparison period — that\'s good.',
      },
      {
        icon: '⚠️',
        title: 'Alerts panel',
        description: 'Amber panel surfaces unusual transactions: single debits over ₹10 000, new merchants never seen before, and categories spiking more than 150% above their 3-month average.',
      },
      {
        icon: '🔁',
        title: 'Recurring banner',
        description: 'Shows how many recurring patterns (subscriptions, EMIs, salaries) were detected. Click "View all" to see the full list.',
      },
      {
        icon: '📈',
        title: '12-month trend chart',
        description: 'Grouped bar chart of monthly spend vs. income. Hover a bar to see exact amounts.',
      },
      {
        icon: '🍩',
        title: 'Category donut',
        description: 'Share of spending by category for the anchor month. Click a slice to jump to that category\'s transactions.',
      },
      {
        icon: '🏆',
        title: 'Top merchants',
        description: 'Your top 8 merchants by total spend with proportional progress bars.',
      },
      {
        icon: '🎯',
        title: 'Goals banner',
        description: 'Shows how many savings goals are achieved. Click "View all" to manage goals.',
      },
      {
        icon: '🔮',
        title: 'Spending forecast',
        description: 'Projects total spend for the month: what you\'ve imported so far + recurring charges not yet seen. Progress bar turns amber at 75% and red at 90% of projection.',
        tip: 'The forecast is only as fresh as your latest import. Import a recent statement for an accurate projection.',
      },
    ],
  },

  '/transactions': {
    summary: 'Every transaction from all your bank accounts — searchable, filterable, and fully categorisable.',
    features: [
      {
        icon: '🔍',
        title: 'Search & filters',
        description: 'Type in the search bar to match merchant names or remarks. Use the year/month/week pickers to drill into a specific period. Filter by category, account, or type (Debit/Credit).',
        tip: 'The time pickers show counts and uncategorised counts in each button — aim for zero uncategorised.',
      },
      {
        icon: '🏷️',
        title: 'Category picker',
        description: 'Click the category badge on any row to change it. Select "Uncategorized" to clear. Tick "Create rule" to auto-categorise this merchant in future imports.',
      },
      {
        icon: '✅',
        title: 'Reviewed flag',
        description: 'Check the tick on a row to mark a transaction as reviewed. Reviewed rows fade out so you can work through new imports systematically.',
      },
      {
        icon: '☑️',
        title: 'Bulk category update',
        description: 'Check multiple rows using the leftmost checkbox, then pick a category from the floating action bar to update them all at once.',
      },
      {
        icon: '✂️',
        title: 'Split transactions',
        description: 'Click the scissors icon on a row to split one transaction across multiple categories (e.g. a supermarket trip that covers groceries and household items).',
      },
      {
        icon: '📝',
        title: 'Notes',
        description: 'Click the chat-bubble icon on a row to add a personal note to any transaction.',
      },
      {
        icon: '📤',
        title: 'Export CSV',
        description: 'The "Export CSV" button at the top downloads all transactions matching your current filters — no pagination limit.',
      },
    ],
  },

  '/import': {
    summary: 'Upload bank statement files — duplicates are detected automatically, and each transaction is auto-categorised on the fly.',
    features: [
      {
        icon: '🏦',
        title: 'Supported banks',
        description: 'ICICI Bank (XLS/XLSX export) and Bank of Baroda (CSV export). Select your bank from the dropdown before uploading.',
      },
      {
        icon: '📁',
        title: 'Drag & drop',
        description: 'Drop one or many files at once. The summary shows new, duplicate, and error counts per file.',
      },
      {
        icon: '🔁',
        title: 'Duplicate detection',
        description: 'Each transaction is fingerprinted by date, amounts, and raw remarks. Re-uploading the same file is safe — duplicates are silently skipped.',
      },
      {
        icon: '🎯',
        title: 'Categorisation confidence',
        description: 'After import, a badge shows the % of transactions that were auto-categorised. Green ≥80%, yellow ≥50%, red <50% — low scores mean you need more rules.',
        tip: 'Go to Categories & Rules and add rules for your most common uncategorised merchants.',
      },
      {
        icon: '📋',
        title: 'Review queue',
        description: 'Duplicates and error rows are listed in collapsible panels per file so you can inspect what was skipped.',
      },
      {
        icon: '🗂️',
        title: 'Import history',
        description: 'Scroll down to see all previous imports with file name, bank, account, and transaction counts. Delete individual batches or all data from here.',
      },
    ],
  },

  '/budgets': {
    summary: 'Set spending limits per category and see at a glance where you are for the month.',
    features: [
      {
        icon: '📅',
        title: 'Monthly vs. annual',
        description: 'Switch tabs to set either a monthly limit (resets each month) or an annual limit (tracks the whole year).',
      },
      {
        icon: '✏️',
        title: 'Setting a limit',
        description: 'Click the pencil icon or "Set limit" on any category card. Type an amount and press Enter or click Save.',
      },
      {
        icon: '📊',
        title: 'Progress bars',
        description: 'Green below 80%, amber 80–100%, red when over budget. The percentage shows actual spend against your limit.',
      },
      {
        icon: '🔁',
        title: 'Rollover carry-forward',
        description: 'Enable the rollover toggle on a budget to add last month\'s unspent amount to this month\'s effective limit. Useful for irregular categories like clothing.',
      },
      {
        icon: '🤖',
        title: 'AI budget advice',
        description: 'If you have an Anthropic API key set in Settings, the "Get Budget Advice" button analyses your budget vs. actual and suggests adjustments.',
      },
    ],
  },

  '/goals': {
    summary: 'Savings goals with automatic progress tracking — computed from your actual transactions.',
    features: [
      {
        icon: '➕',
        title: 'Create a goal',
        description: 'Click "+ New Goal". Enter a name, target amount, start date, and optional deadline.',
      },
      {
        icon: '📈',
        title: 'Automatic progress',
        description: 'Progress is computed as net savings (deposits − withdrawals) from your start date. No manual updates needed.',
        tip: 'Progress reflects all transactions across all your accounts — make sure your Income transactions are correctly categorised.',
      },
      {
        icon: '🏆',
        title: 'Status badges',
        description: '"Achieved" (green) when 100% reached. "Overdue" (red) when past the deadline. "X days left" (blue) when on track with a deadline.',
      },
      {
        icon: '🗑️',
        title: 'Deleting goals',
        description: 'Two-step confirm: click the trash icon, then confirm. Deleting a goal does not affect your transactions.',
      },
    ],
  },

  '/net-worth': {
    summary: 'Your cumulative net savings over time — a running total of income minus spending.',
    features: [
      {
        icon: '📅',
        title: 'Period selector',
        description: 'Choose 6, 12, or 24 months of history. The chart always ends at your most recent transaction date.',
      },
      {
        icon: '📈',
        title: 'Cumulative line (indigo)',
        description: 'Running total of all net savings since the start of the selected period.',
      },
      {
        icon: '💹',
        title: 'Monthly bar (emerald)',
        description: 'Net savings per individual month (income minus spending). Positive = saved, negative = overspent.',
      },
      {
        icon: '⚠️',
        title: 'Note on accuracy',
        description: 'Net worth here is based only on imported transactions. It does not include assets you haven\'t tracked (property, investments, etc.).',
        tip: 'For true net worth, combine this view with your offline assets and subtract debts.',
      },
    ],
  },

  '/recurring': {
    summary: 'Automatically detected recurring patterns — subscriptions, EMIs, salaries, and regular bills.',
    features: [
      {
        icon: '🔍',
        title: 'Detection logic',
        description: 'A pattern is flagged when the same merchant appears ≥3 times, within a consistent interval, with ≤20% amount variance.',
      },
      {
        icon: '📅',
        title: 'Lookback period',
        description: 'Use the 6M / 12M / 24M / All buttons to adjust how far back the analysis looks. Longer periods surface annual subscriptions.',
      },
      {
        icon: '🟢',
        title: 'Active this month',
        description: 'Patterns with a green "Active" badge have already appeared in the current anchor month. Patterns marked "Due" are expected but not yet seen.',
      },
      {
        icon: '🤖',
        title: 'AI analysis',
        description: 'The insight card on the right summarises your recurring patterns and flags anything unusual (e.g. a subscription that disappeared).',
      },
    ],
  },

  '/alerts': {
    summary: 'Unusual spending patterns surfaced automatically — browse by month.',
    features: [
      {
        icon: '💸',
        title: 'Large transactions',
        description: 'Single debits above ₹10 000 are flagged. The threshold is fixed — contact your developer to configure it.',
      },
      {
        icon: '🆕',
        title: 'New merchants',
        description: 'Merchants that have never appeared in your last 6 months of history. Useful for spotting unexpected charges.',
      },
      {
        icon: '📈',
        title: 'Category spikes',
        description: 'Categories where spending is more than 150% of the 3-month rolling average. Minimum average of ₹500 to avoid noise.',
      },
      {
        icon: '◀▶',
        title: 'Month navigation',
        description: 'Use the arrow buttons to review alerts for past months. The current calendar month is the default.',
      },
    ],
  },

  '/reports': {
    summary: 'Year-at-a-glance: 12-month summary table with grand totals and per-category breakdown.',
    features: [
      {
        icon: '📅',
        title: 'Year selector',
        description: 'Pick any year that has imported data. Only years with at least one transaction appear in the list.',
      },
      {
        icon: '📊',
        title: 'Monthly table',
        description: 'One row per month showing total spent, income, net, and top categories. Zero-fill for months with no data.',
      },
      {
        icon: '📤',
        title: 'Export CSV',
        description: 'Click "Export CSV" to download the monthly summary as a spreadsheet.',
      },
      {
        icon: '🖨️',
        title: 'Print',
        description: 'Click "Print" for a clean printable layout — sidebar and header are automatically hidden.',
      },
    ],
  },

  '/categories': {
    summary: 'Organise spending into a category tree, then write rules to auto-categorise on import.',
    features: [
      {
        icon: '🌳',
        title: 'Category tree',
        description: 'Categories are hierarchical. Create sub-categories under any parent. Spending rolls up to parent categories in dashboards and budgets.',
        tip: 'Maximum depth is set in Settings → Preferences. Default is 5 levels.',
      },
      {
        icon: '🔒',
        title: 'System categories',
        description: '12 built-in categories (Food & Dining, Transport, etc.) are read-only and visible to everyone. You can create sub-categories under them.',
      },
      {
        icon: '➕',
        title: 'Custom categories',
        description: 'Add household-specific categories (e.g. "School Fees") from the custom section. Assign a colour so they\'re easy to spot in charts.',
      },
      {
        icon: '📏',
        title: 'Categorisation rules',
        description: 'Switch to the Rules tab to manage keyword/UPI-handle patterns. Higher priority rules are matched first. Rules can target a category or be marked global (applies to all users).',
      },
      {
        icon: '⚡',
        title: 'Inline rule creation',
        description: 'When you correct a transaction\'s category, tick "Create rule" to auto-add a rule for that merchant — no need to visit this page.',
      },
    ],
  },

  '/accounts': {
    summary: 'Manage the bank accounts you import statements from.',
    features: [
      {
        icon: '➕',
        title: 'Adding an account',
        description: 'Click "+ Add Account". Enter the bank name, masked account number, account type, and currency. The account is linked to your import history.',
      },
      {
        icon: '✏️',
        title: 'Editing',
        description: 'Click the pencil icon to rename or update an account. The account number is masked by default for privacy.',
      },
      {
        icon: '🗑️',
        title: 'Deleting',
        description: 'Deleting an account removes all its imported transactions. This is irreversible — confirm carefully.',
        tip: 'You can delete individual import batches instead (in Import → Import History) to undo specific uploads without losing the account.',
      },
    ],
  },

  '/household': {
    summary: 'Household-wide spending across all members for the current anchor month.',
    features: [
      {
        icon: '🔗',
        title: 'Invite code',
        description: 'Share the 8-character invite code (top of the page) with family members. They enter it on the Register screen to join your household.',
      },
      {
        icon: '👥',
        title: 'Member cards',
        description: 'Each member\'s card shows their spend, income, transaction count, and top category for the anchor month.',
      },
      {
        icon: '📊',
        title: 'Household totals',
        description: 'The three stat cards at the top sum across all members — useful for understanding the household\'s total financial picture.',
      },
    ],
  },

  '/views': {
    summary: 'Group transactions into named views for trips, events, or any custom period.',
    features: [
      {
        icon: '✈️',
        title: 'Trip template',
        description: 'Creates a view pre-loaded with Travel, Accommodation, Food and Entertainment budgets. Transactions in the date range are auto-added.',
      },
      {
        icon: '🎉',
        title: 'Event template',
        description: 'Pre-loaded with Food, Entertainment, Shopping and Transport budgets. Good for weddings, parties, or festivals.',
      },
      {
        icon: '🔧',
        title: 'Custom view',
        description: 'Pick any date range and set your own category budgets. Auto-tags all household transactions in that range.',
      },
      {
        icon: '📋',
        title: 'List / Board / Summary tabs',
        description: 'List shows paginated transactions. Board groups by category. Summary shows total vs. budget, category breakdown, and per-member split.',
      },
      {
        icon: '➕',
        title: 'Add transactions manually',
        description: 'In the Transactions page, use the bookmark icon on any row to add it to an existing view even if it\'s outside the view\'s date range.',
      },
    ],
  },

  '/settlements': {
    summary: 'Track shared expenses and who owes whom.',
    features: [
      {
        icon: '➕',
        title: 'Create a settlement',
        description: 'Click "+ New Settlement". Enter the person\'s name, total owed, and line items (what each amount was for).',
      },
      {
        icon: '✅',
        title: 'Mark as settled',
        description: 'Once paid, click "Mark Settled" to move the settlement to the Settled section. Settled items are kept for your records.',
      },
      {
        icon: '📋',
        title: 'Line items',
        description: 'Each settlement can have multiple line items (e.g. rent ₹8 000 + electricity ₹1 200). Expand the card to see the breakdown.',
      },
    ],
  },

  '/data-health': {
    summary: 'Audit the quality of your transaction data — categorisation gaps, duplicates, and rule coverage.',
    features: [
      {
        icon: '📊',
        title: 'Categorisation score',
        description: 'Shows what % of transactions have a category assigned. Green ≥80%, amber ≥60%, red <60%. Aim for green.',
        tip: 'Uncategorised and Miscellaneous transactions are the main drag. Add rules for your most common merchants.',
      },
      {
        icon: '📏',
        title: 'Rule coverage',
        description: 'Shows how many user rules and global rules are active. More rules = higher auto-categorisation on future imports.',
      },
      {
        icon: '⚠️',
        title: 'Near-duplicate candidates',
        description: 'Transactions with the same account, date, and withdrawal amount — could be genuine duplicates that slipped past the hash check. Review and delete manually if needed.',
      },
    ],
  },

  '/annual-review': {
    summary: 'Your year in numbers — savings rate, best and worst months, top categories, and a month-by-month net chart.',
    features: [
      {
        icon: '📅',
        title: 'Year selector',
        description: 'Switch between years that have imported data. Only years with at least one transaction appear.',
      },
      {
        icon: '💰',
        title: 'Savings rate',
        description: 'Net savings as a percentage of total income. Aim for 20%+ (green). 10–19% is on track (blue). Below 10% shows an alert.',
      },
      {
        icon: '🏆',
        title: 'Highlights',
        description: 'Best month (highest net savings), toughest month (biggest deficit), and the category you spent the most on across the year.',
      },
      {
        icon: '📊',
        title: 'Month bars',
        description: 'Green bar = net positive (saved money). Red bar = net negative (spent more than earned). Click any bar to jump to that month\'s transactions.',
      },
      {
        icon: '⚠️',
        title: 'Months in the red',
        description: 'If you overspent in any months, an amber callout shows how many. Links to Budgets so you can set limits for next year.',
      },
    ],
  },

  '/dashboards': {
    summary: 'Build custom chart dashboards with any combination of widgets.',
    features: [
      {
        icon: '➕',
        title: 'Create a dashboard',
        description: 'Click "+ New Dashboard". Give it a name. Then add widgets one by one.',
      },
      {
        icon: '📊',
        title: 'Widget types',
        description: 'Pie (category breakdown), Bar (monthly comparison), Line (trend over time), and Stat (single KPI number).',
      },
      {
        icon: '🔍',
        title: 'Filter types',
        description: 'All transactions, a specific category subtree, or a text tag (any keyword matched against transaction remarks — e.g. "Swiggy", "Amazon", "rent"). Metrics: Spend, Income, or Count.',
      },
      {
        icon: '📅',
        title: 'Period',
        description: 'Choose 3m, 6m, 12m, 24m, or All time. Each widget can have a different period.',
      },
      {
        icon: '👁️',
        title: 'Preview',
        description: 'Use the Preview tab in the widget form to see a live chart before saving.',
      },
    ],
  },

  '/merchant-aliases': {
    summary: 'Normalise messy merchant names from bank statements into clean display names.',
    features: [
      {
        icon: '🔤',
        title: 'Raw pattern',
        description: 'The exact string (or substring) as it appears in your bank\'s remarks field — e.g. "SWIGGY*ORDER".',
      },
      {
        icon: '✨',
        title: 'Alias name',
        description: 'The clean name to display in the UI and charts — e.g. "Swiggy".',
      },
      {
        icon: '⚡',
        title: 'Applied on import',
        description: 'Aliases are checked first during merchant extraction, before the regex rules. So an alias always wins if the pattern matches.',
      },
    ],
  },
}

export function getPageGuide(pathname: string): PageGuide | null {
  // Exact match first
  if (PAGE_GUIDES[pathname]) return PAGE_GUIDES[pathname]
  // Strip trailing segments for nested routes (e.g. /views/abc-123 → /views)
  const base = '/' + pathname.split('/').filter(Boolean)[0]
  return PAGE_GUIDES[base] ?? null
}

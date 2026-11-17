"use client";

// TanStack Query hooks over the service layer. Pages use these hooks and never touch mock data or services directly.
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import { toast } from "sonner";
import { services } from "@/services";
import { useApp } from "@/providers/app-provider";
import type { ContactKind, Dimension, ID } from "@/types";

type Services = typeof services;

/** Query scoped to the active entity: the entity id is part of the key, so data never leaks between entities. */
export function useEntityQuery<T>(key: readonly unknown[], fn: (entityId: ID) => Promise<T>, opts: { enabled?: boolean; staleTime?: number } = {}) {
  const { entityId, ready } = useApp();
  return useQuery<T>({ queryKey: [...key, entityId], queryFn: () => fn(entityId), enabled: ready && (opts.enabled ?? true), staleTime: opts.staleTime } as UseQueryOptions<T>);
}

interface MutOpts<I, O> { success?: string | ((out: O, input: I) => string); invalidate?: readonly (readonly unknown[])[]; optimistic?: { key: readonly unknown[]; update: (old: unknown, input: I) => unknown }; onDone?: (out: O, input: I) => void }

/** Mutation scoped to the active entity. Success/errors surface as toasts; all queries are invalidated because
 *  one accounting action (e.g. a payment) affects ledgers, reports and dashboards. */
export function useEntityMutation<I, O>(fn: (entityId: ID, input: I) => Promise<O>, o: MutOpts<I, O> = {}) {
  const { entityId } = useApp();
  const qc = useQueryClient();
  return useMutation<O, Error, I, { prev?: unknown }>({
    mutationFn: (input) => fn(entityId, input),
    onMutate: async (input) => {
      if (!o.optimistic) return {};
      const key = [...o.optimistic.key, entityId];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) => o.optimistic!.update(old, input));
      return { prev };
    },
    onError: (err, _in, ctx) => {
      if (o.optimistic && ctx?.prev !== undefined) qc.setQueryData([...o.optimistic.key, entityId], ctx.prev);
      toast.error(err.message || "Something went wrong");
    },
    onSuccess: (out, input) => {
      const msg = typeof o.success === "function" ? o.success(out, input) : o.success;
      if (msg) toast.success(msg);
      o.onDone?.(out, input);
    },
    onSettled: () => { void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "entities" && (q.queryKey[0] !== "roles" || !!o.invalidate?.some((k) => k[0] === "roles")) }); },
  });
}

// ---- Query keys (single place) ----
export const qk = {
  accounts: ["accounts"], journals: ["journals"], journal: (id: ID) => ["journal", id], ledger: ["ledger"], contacts: (k?: ContactKind) => ["contacts", k ?? "all"], contact: (id: ID) => ["contact", id],
  invoices: ["invoices"], bills: ["bills"], expenses: ["expenses"], bank: ["bank"], tax: ["tax"], reports: ["reports"], assets: ["assets"], currency: ["currency"], budgets: ["budgets"],
  approvals: ["approvals"], ai: ["ai"], org: ["org"],
} as const;

// ---- Core / org ----
export const useEntities = () => useApp().entities;
export const useFiscalYears = () => useEntityQuery(["fiscalYears"], (e) => services.periods.fiscalYears(e));
export const usePeriods = () => useEntityQuery(["periods"], (e) => services.periods.periods(e));
export const useRoles = () => useQuery({ queryKey: ["roles"], queryFn: () => services.org.roles() });
export const useUsers = () => useEntityQuery(["users"], (e) => services.org.users(e));
export const useDocuments = () => useEntityQuery(["documents"], (e) => services.org.documents(e));
export const useAudit = () => useEntityQuery(["audit"], (e) => services.org.audit(e));
export const useNotifications = () => useEntityQuery(["notifications"], (e) => services.org.notifications(e));

// ---- Accounting ----
export const useAccounts = () => useEntityQuery(qk.accounts, (e) => services.accounts.list(e));
export const useJournals = () => useEntityQuery(qk.journals, (e) => services.journals.list(e));
export const useJournal = (id: ID) => useEntityQuery(qk.journal(id), (e) => services.journals.get(e, id), { enabled: !!id && id !== "__new" });
export const useJournalHistory = (id: ID) => useEntityQuery(["journalHistory", id], (e) => services.journals.history(e, id), { enabled: !!id });
export const useLedger = (i: { accountId?: ID; from?: string; to?: string }) => useEntityQuery([...qk.ledger, i], (e) => services.ledger.entries(e, i));
export const useAccountSummary = (i: { from: string; to: string }) => useEntityQuery(["accountSummary", i], (e) => services.ledger.accountSummary(e, i));
export const useContacts = (kind?: ContactKind) => useEntityQuery(qk.contacts(kind), (e) => services.contacts.list(e, kind));
export const useContact = (id: ID) => useEntityQuery(qk.contact(id), (e) => services.contacts.get(e, id));
export const useStatement = (i: { contactId: ID; from: string; to: string }) => useEntityQuery(["statement", i], (e) => services.contacts.statement(e, i));

// ---- Receivables / payables / expenses ----
export const useInvoices = () => useEntityQuery(qk.invoices, (e) => services.receivables.invoices(e));
export const useInvoice = (id: ID) => useEntityQuery(["invoice", id], (e) => services.receivables.invoice(e, id));
export const useReceipts = () => useEntityQuery(["receipts"], (e) => services.receivables.receipts(e));
export const useCreditNotes = (kind: "customer" | "vendor") => useEntityQuery(["creditNotes", kind], (e) => services.receivables.creditNotes(e, kind));
export const useArAgeing = (asOf: string) => useEntityQuery(["arAgeing", asOf], (e) => services.receivables.ageing(e, asOf));
export const useBills = () => useEntityQuery(qk.bills, (e) => services.payables.bills(e));
export const useBill = (id: ID) => useEntityQuery(["bill", id], (e) => services.payables.bill(e, id));
export const usePayments = () => useEntityQuery(["payments"], (e) => services.payables.payments(e));
export const useApAgeing = (asOf: string) => useEntityQuery(["apAgeing", asOf], (e) => services.payables.ageing(e, asOf));
export const useExpenses = () => useEntityQuery(qk.expenses, (e) => services.expenses.list(e));
export const useExpense = (id: ID) => useEntityQuery(["expense", id], (e) => services.expenses.get(e, id));
export const useExpenseCategories = () => useEntityQuery(["expenseCategories"], (e) => services.expenses.categories(e));

// ---- Banking ----
export const useBankAccounts = () => useEntityQuery([...qk.bank, "accounts"], (e) => services.banking.accounts(e));
export const useBankTxns = (bankAccountId?: ID) => useEntityQuery([...qk.bank, "txns", bankAccountId ?? "all"], (e) => services.banking.txns(e, bankAccountId));
export const useBookLines = (bankId?: ID) => useEntityQuery([...qk.bank, "book", bankId ?? ""], (e) => services.banking.bookLines(e, bankId!), { enabled: !!bankId });
export const useReconSummary = (bankAccountId: ID | undefined, asOf: string) => useEntityQuery([...qk.bank, "summary", bankAccountId ?? "", asOf], (e) => services.banking.summary(e, { bankAccountId: bankAccountId!, asOf }), { enabled: !!bankAccountId });
export const useReconciliations = (bankAccountId?: ID) => useEntityQuery([...qk.bank, "recs", bankAccountId ?? "all"], (e) => services.banking.reconciliations(e, bankAccountId));
export const useBankFeeds = () => useEntityQuery([...qk.bank, "feeds"], (e) => services.banking.feeds(e));

// ---- Tax & reports ----
export const useTaxOverview = (from: string, to: string) => useEntityQuery([...qk.tax, "overview", from, to], (e) => services.tax.overview(e, from, to));
export const useTaxTransactions = (from: string, to: string) => useEntityQuery([...qk.tax, "txns", from, to], (e) => services.tax.transactions(e, from, to));
export const useTds = () => useEntityQuery([...qk.tax, "tds"], (e) => services.tax.tds(e));
export const useItc = (from: string, to: string) => useEntityQuery([...qk.tax, "itc", from, to], (e) => services.tax.itc(e, from, to));
export const useTaxCodes = () => useEntityQuery([...qk.tax, "codes"], (e) => services.tax.codes(e));
export const useDashboard = (from: string, to: string) => useEntityQuery([...qk.reports, "dashboard", from, to], (e) => services.reports.dashboard(e, { from, to }));
export const usePnl = (i: { from: string; to: string; compareFrom?: string; compareTo?: string }) => useEntityQuery([...qk.reports, "pnl", i], (e) => services.reports.pnl(e, i));
export const useBalanceSheet = (i: { asOf: string; compareAsOf?: string }) => useEntityQuery([...qk.reports, "bs", i], (e) => services.reports.balanceSheet(e, i));
export const useCashFlow = (i: { from: string; to: string }) => useEntityQuery([...qk.reports, "cf", i], (e) => services.reports.cashFlow(e, i));
export const useTrialBalance = (asOf: string) => useEntityQuery([...qk.reports, "tb", asOf], (e) => services.reports.trialBalance(e, { asOf }));
export const useJournalReport = (i: { from: string; to: string; kind?: string }) => useEntityQuery([...qk.reports, "jr", i], (e) => services.reports.journalReport(e, i));
export const useExpenseReport = (i: { from: string; to: string }) => useEntityQuery([...qk.reports, "er", i], (e) => services.reports.expenseReport(e, i));
export const useBankReconReport = (asOf: string) => useEntityQuery([...qk.reports, "br", asOf], (e) => services.reports.bankRecon(e, asOf));
export const useTaxSummaryReport = (from: string, to: string) => useEntityQuery([...qk.reports, "ts", from, to], (e) => services.tax.summary(e, from, to));

// ---- Advanced ----
export const useAssets = () => useEntityQuery(qk.assets, (e) => services.assets.list(e));
export const useAsset = (id: ID) => useEntityQuery(["asset", id], (e) => services.assets.get(e, id));
export const useDepPreview = (month: string) => useEntityQuery(["depPreview", month], (e) => services.assets.depreciationPreview(e, month));
export const useCurrencyOverview = () => useEntityQuery(qk.currency, (e) => services.currency.overview(e));
export const useBudgets = () => useEntityQuery(qk.budgets, (e) => services.budgets.list(e));
export const useBudgetVariance = (id?: ID) => useEntityQuery(["budgetVariance", id ?? ""], (e) => services.budgets.variance(e, id!), { enabled: !!id });
export const useForecast = () => useEntityQuery(["forecast"], (e) => services.budgets.forecast(e));
export const useDimensions = (kind?: Dimension["kind"]) => useEntityQuery(["dimensions", kind ?? "all"], (e) => services.dimensions.list(e, kind));
export const useDimensionReport = (i: { kind: Dimension["kind"]; from: string; to: string }) => useEntityQuery(["dimReport", i], (e) => services.dimensions.report(e, i));
export const useAllocations = () => useEntityQuery(["allocations"], (e) => services.dimensions.allocations(e));
export const useApprovalRequests = () => useEntityQuery(qk.approvals, (e) => services.approvals.requests(e));
export const useApprovalRules = () => useEntityQuery(["approvalRules"], (e) => services.approvals.rules(e));
export const useGroupSummary = () => useQuery({ queryKey: ["groupSummary"], queryFn: () => services.consolidation.groupSummary() });

// ---- AI ----
export const useCategorization = () => useEntityQuery([...qk.ai, "cat"], (e) => services.ai.categorization(e));
export const useJournalSuggestions = () => useEntityQuery([...qk.ai, "jv"], (e) => services.ai.journalSuggestions(e));
export const useMatchSuggestions = () => useEntityQuery([...qk.ai, "match"], (e) => services.ai.matchSuggestions(e));
export const useAnomalies = () => useEntityQuery([...qk.ai, "anomalies"], (e) => services.ai.anomalies(e));
export const useCashInsights = (days = 90) => useEntityQuery([...qk.ai, "cash", days], (e) => services.ai.cashInsights(e, days));
export const useAgents = () => useEntityQuery([...qk.ai, "agents"], (e) => services.ai.agents(e));
export const useAutomations = () => useEntityQuery([...qk.ai, "automations"], (e) => services.ai.automations(e));

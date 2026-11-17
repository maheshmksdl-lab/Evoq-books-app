// Service registry. Pages never import mock data directly — they go through these services (via hooks).
// To connect a real backend later, implement the same method signatures in an API adapter and swap the objects below.
import { entitiesService, periodsService, orgService } from "./core";
import { accountsService, journalsService, ledgerService, contactsService } from "./accounting";
import { receivablesService, payablesService, expensesService } from "./transactions";
import { bankingService } from "./banking";
import { taxService, reportsService } from "./reporting";
import { assetsService, currencyService, budgetsService, dimensionsService, approvalsService, consolidationService } from "./advanced";
import { aiService } from "./ai";

export const services = {
  entities: entitiesService, periods: periodsService, org: orgService,
  accounts: accountsService, journals: journalsService, ledger: ledgerService, contacts: contactsService,
  receivables: receivablesService, payables: payablesService, expenses: expensesService,
  banking: bankingService, tax: taxService, reports: reportsService,
  assets: assetsService, currency: currencyService, budgets: budgetsService, dimensions: dimensionsService, approvals: approvalsService, consolidation: consolidationService,
  ai: aiService,
};
export type Services = typeof services;
export { ServiceError } from "./base";
export type { AccountRow, JournalRow, ContactRow, JournalSave, AccountInput, ContactInput } from "./accounting";
export type { InvoiceRow, BillRow, BillInput, ExpenseInput, PaymentInput } from "./transactions";
export type { AssetRow, AssetInput } from "./advanced";
export type { AiAnswer } from "./ai";
export { SUGGESTED_QUESTIONS } from "./ai";
export type { BankAccountRow as BankAccountRowT } from "./banking";

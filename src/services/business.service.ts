import { BusinessEntryType, PaymentStatus, Prisma } from "@prisma/client";
import {
  CreateBusinessEntryInput,
  CreateSupplierInput,
  ListBusinessEntriesInput,
  resolveBusinessPaymentStatus,
} from "../schemas/business.schema";
import { AppError } from "../utils/AppError";
import { prisma } from "../utils/prisma";

const getDateRangeWhere = (from?: string, to?: string) => {
  const occurredAt: Prisma.DateTimeFilter = {};
  if (from) occurredAt.gte = new Date(from);
  if (to) occurredAt.lte = new Date(to);
  return Object.keys(occurredAt).length > 0 ? { occurredAt } : {};
};

export class BusinessService {
  async createSupplier(tenantId: string, input: CreateSupplierInput) {
    return prisma.supplier.create({
      data: {
        tenantId,
        name: input.name,
        phone: input.phone,
        notes: input.notes,
      },
    });
  }

  async listSuppliers(tenantId: string) {
    return prisma.supplier.findMany({
      where: { tenantId },
      orderBy: { name: "asc" },
    });
  }

  async createEntry(tenantId: string, input: CreateBusinessEntryInput) {
    if (input.type === BusinessEntryType.SALE) {
      throw new AppError(
        "Les ventes sont déjà suivies via les ventes à crédit et paiements clients.",
        400
      );
    }

    if (input.paidAmount && input.paidAmount > input.amount) {
      throw new AppError("Le montant payé dépasse le montant total", 400);
    }

    const paidAmount =
      input.type === BusinessEntryType.SUPPLIER_PURCHASE
        ? input.paidAmount ?? input.amount
        : input.amount;
    const remainingAmount = Math.max(input.amount - paidAmount, 0);
    const paymentStatus = resolveBusinessPaymentStatus(input.amount, paidAmount);

    let supplierId = input.supplierId;

    if (input.type === BusinessEntryType.SUPPLIER_PURCHASE && input.supplierName && !supplierId) {
      const supplier = await prisma.supplier.create({
        data: {
          tenantId,
          name: input.supplierName,
          phone: input.supplierPhone,
        },
      });
      supplierId = supplier.id;
    }

    if (supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: supplierId, tenantId },
      });

      if (!supplier) {
        throw new AppError("Fournisseur introuvable", 404);
      }
    }

    return prisma.businessEntry.create({
      data: {
        tenantId,
        supplierId,
        type: input.type,
        title: input.title,
        amount: input.amount,
        paidAmount,
        remainingAmount,
        paymentStatus,
        note: input.note,
        occurredAt: input.occurredAt ?? new Date(),
      },
      include: { supplier: true },
    });
  }

  async listEntries(tenantId: string, filters: ListBusinessEntriesInput = {}) {
    const where: Prisma.BusinessEntryWhereInput = {
      tenantId,
      ...getDateRangeWhere(filters.from, filters.to),
    };

    if (filters.type) where.type = filters.type;
    if (filters.supplierId) where.supplierId = filters.supplierId;

    return prisma.businessEntry.findMany({
      where,
      include: { supplier: true },
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
  }

  async deleteEntry(tenantId: string, id: string) {
    const entry = await prisma.businessEntry.findFirst({
      where: { id, tenantId },
    });

    if (!entry) {
      throw new AppError("Opération introuvable", 404);
    }

    await prisma.businessEntry.delete({ where: { id } });
    return { deleted: true };
  }

  async summary(tenantId: string, from?: string, to?: string) {
    const dateWhere = getDateRangeWhere(from, to);

    const [revenue, purchases, expenses, supplierDebt, recentEntries] =
      await Promise.all([
        prisma.payment.aggregate({
          where: {
            tenantId,
            status: PaymentStatus.COMPLETED,
            ...(dateWhere.occurredAt
              ? {
                  paidAt: {
                    gte: dateWhere.occurredAt.gte,
                    lte: dateWhere.occurredAt.lte,
                  },
                }
              : {}),
          },
          _sum: { amount: true },
        }),
        prisma.businessEntry.aggregate({
          where: {
            tenantId,
            type: BusinessEntryType.SUPPLIER_PURCHASE,
            ...dateWhere,
          },
          _sum: { amount: true, paidAmount: true, remainingAmount: true },
        }),
        prisma.businessEntry.aggregate({
          where: { tenantId, type: BusinessEntryType.EXPENSE, ...dateWhere },
          _sum: { amount: true },
        }),
        prisma.businessEntry.aggregate({
          where: {
            tenantId,
            type: BusinessEntryType.SUPPLIER_PURCHASE,
            remainingAmount: { gt: 0 },
          },
          _sum: { remainingAmount: true },
        }),
        prisma.businessEntry.findMany({
          where: { tenantId },
          include: { supplier: true },
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          take: 5,
        }),
      ]);

    const collectedRevenue = revenue._sum.amount ?? 0;
    const supplierPurchases = purchases._sum.amount ?? 0;
    const operatingExpenses = expenses._sum.amount ?? 0;
    const estimatedProfit = collectedRevenue - supplierPurchases - operatingExpenses;

    return {
      revenue: collectedRevenue,
      supplierPurchases,
      supplierPurchasesPaid: purchases._sum.paidAmount ?? 0,
      supplierPurchasesRemaining: purchases._sum.remainingAmount ?? 0,
      expenses: operatingExpenses,
      estimatedProfit,
      supplierDebt: supplierDebt._sum.remainingAmount ?? 0,
      recentEntries,
    };
  }
}

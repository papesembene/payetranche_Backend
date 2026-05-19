import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export const creditModel = {
  create(data: Prisma.CreditUncheckedCreateInput) {
    return prisma.credit.create({
      data,
      include: { client: true },
    });
  },

  findMany(where: Prisma.CreditWhereInput) {
    return prisma.credit.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { client: true, payments: { orderBy: { paidAt: "desc" } } },
    });
  },

  findById(tenantId: string, id: string) {
    return prisma.credit.findFirst({
      where: { id, tenantId },
      include: { client: true, payments: { orderBy: { paidAt: "desc" } } },
    });
  },

  update(tenantId: string, id: string, data: Prisma.CreditUpdateInput) {
    return prisma.credit.update({
      where: { id },
      data,
      include: { client: true, payments: true },
    });
  },

  delete(tenantId: string, id: string) {
    return prisma.credit.delete({
      where: { id },
    });
  },
};

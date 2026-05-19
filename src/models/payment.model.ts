import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export const paymentModel = {
  create(data: Prisma.PaymentUncheckedCreateInput) {
    return prisma.payment.create({
      data,
      include: { client: true, credit: true },
    });
  },

  findMany(where: Prisma.PaymentWhereInput) {
    return prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      include: { client: true, credit: true },
    });
  },

  findById(tenantId: string, id: string) {
    return prisma.payment.findFirst({
      where: { id, tenantId },
      include: { client: true, credit: true },
    });
  },
};

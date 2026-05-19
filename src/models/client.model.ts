import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export const clientModel = {
  create(data: Prisma.ClientUncheckedCreateInput) {
    return prisma.client.create({ data });
  },

  findMany(where: Prisma.ClientWhereInput) {
    return prisma.client.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { credits: true, payments: true },
        },
      },
    });
  },

  findById(tenantId: string, id: string) {
    return prisma.client.findFirst({
      where: { id, tenantId },
      include: {
        credits: { orderBy: { createdAt: "desc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });
  },

  update(tenantId: string, id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({
      where: { id },
      data,
    });
  },

  delete(tenantId: string, id: string) {
    return prisma.client.delete({
      where: { id },
    });
  },
};

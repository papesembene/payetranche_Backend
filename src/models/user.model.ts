import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";

export const userModel = {
  create(data: Prisma.UserUncheckedCreateInput) {
    return prisma.user.create({ data });
  },

  findByEmail(tenantId: string, email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  },

  findById(tenantId: string, id: string) {
    return prisma.user.findFirst({
      where: { id, tenantId },
    });
  },
};

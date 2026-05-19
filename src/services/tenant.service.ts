import { prisma } from "../utils/prisma";

export class TenantService {
  create(name: string) {
    return prisma.tenant.create({
      data: { name },
    });
  }

  findById(id: string) {
    return prisma.tenant.findUnique({
      where: { id },
    });
  }
}

import { ClientStatus, Prisma } from "@prisma/client";
import { clientModel } from "../models/client.model";
import { CreateClientInput, UpdateClientInput } from "../schemas/client.schema";
import { AppError } from "../utils/AppError";

export class ClientService {
  async create(tenantId: string, input: CreateClientInput) {
    return clientModel.create({
      ...input,
      tenantId,
    });
  }

  async list(
    tenantId: string,
    filters: {
      search?: string;
      status?: ClientStatus | string;
      isActive?: boolean | string;
    } = {}
  ) {
    const where: Prisma.ClientWhereInput = { tenantId };

    if (filters.status) {
      where.status = filters.status as ClientStatus;
    }

    if (filters.isActive !== undefined) {
      where.isActive =
        typeof filters.isActive === "string"
          ? filters.isActive === "true"
          : filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return clientModel.findMany(where);
  }

  async getById(tenantId: string, id: string) {
    const client = await clientModel.findById(tenantId, id);

    if (!client) {
      throw new AppError("Client not found", 404);
    }

    return client;
  }

  async update(tenantId: string, id: string, input: UpdateClientInput) {
    await this.getById(tenantId, id);
    return clientModel.update(tenantId, id, input);
  }

  async delete(tenantId: string, id: string) {
    await this.getById(tenantId, id);
    await clientModel.delete(tenantId, id);
    return { deleted: true };
  }
}

import { CreateUserUseCase } from "../../../../src/core/usecases/CreateUserUseCase";
import { UserRepository } from "../../../../src/types/UserRepository";
import { User } from "../../../../src/core/entities/User";
import { AppError } from "../../../../src/core/errors/AppError";

// Mock repository
class MockUserRepository implements UserRepository {
  private users: User[] = [];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((user) => user.email === email) || null;
  }

  async create(user: User): Promise<User> {
    this.users.push(user);
    return user;
  }
}

describe("CreateUserUseCase", () => {
  let useCase: CreateUserUseCase;
  let mockRepo: MockUserRepository;

  beforeEach(() => {
    mockRepo = new MockUserRepository();
    useCase = new CreateUserUseCase(mockRepo);
  });

  it("should create a user successfully", async () => {
    const userData = { name: "John Doe", email: "john@example.com" };

    const result = await useCase.execute(userData);

    expect(result).toBeInstanceOf(User);
    expect(result.name).toBe(userData.name);
    expect(result.email).toBe(userData.email);
  });

  it("should throw error if user already exists", async () => {
    const userData = { name: "John Doe", email: "john@example.com" };

    // Create first user
    await useCase.execute(userData);

    // Try to create again
    await expect(useCase.execute(userData)).rejects.toThrow(AppError);
    await expect(useCase.execute(userData)).rejects.toThrow(
      "User already exists"
    );
  });
});

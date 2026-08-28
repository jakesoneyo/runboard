import { apiClient } from "../../lib/api-client";
import type { AuthResponse, User, LoginMembership } from "../../types/api";
import type { LoginInput } from "../../schemas/auth.schema";

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

export async function login(payload: LoginInput): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function registerAccount(
  payload: RegisterInput
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(
    "/auth/register",
    payload
  );
  return data;
}

export async function logoutRequest(refreshToken: string): Promise<void> {
  await apiClient.post("/auth/logout", { refreshToken });
}

export async function fetchMe(): Promise<{
  user: User;
  memberships: LoginMembership[];
}> {
  const { data } = await apiClient.get("/auth/me");
  return data;
}

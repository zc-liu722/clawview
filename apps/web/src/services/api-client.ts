import { API_BASE_URL } from "@/lib/constants";
import type { ApiEnvelope } from "@/types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

export async function apiGet<TData>(path: string): Promise<TData> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const json = (await response.json()) as ApiEnvelope<TData> & {
    error?: { code: string; message: string };
  };

  if (!response.ok || json.error) {
    throw new ApiError(
      json.error?.message ?? "请求失败。",
      json.error?.code ?? "UNKNOWN",
    );
  }

  return json.data;
}

export async function apiPost<TData>(
  path: string,
  body: unknown,
): Promise<TData> {
  return apiRequest<TData>(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function apiPatch<TData>(
  path: string,
  body: unknown,
): Promise<TData> {
  return apiRequest<TData>(path, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function apiDelete<TData>(path: string): Promise<TData> {
  return apiRequest<TData>(path, {
    method: "DELETE",
  });
}

async function apiRequest<TData>(
  path: string,
  init?: RequestInit,
): Promise<TData> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
  });
  const json = (await response.json()) as ApiEnvelope<TData> & {
    error?: { code: string; message: string };
  };

  if (!response.ok || json.error) {
    throw new ApiError(
      json.error?.message ?? "请求失败。",
      json.error?.code ?? "UNKNOWN",
    );
  }

  return json.data;
}

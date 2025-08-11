"use server";

import { headers } from "next/dist/server/request/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { accessRequest, user } from "@/db/auth-schema";
import { asc, eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AccessRequest } from "@/lib/defs";

export async function getAccessRequests(): Promise<AccessRequest[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db
    .select()
    .from(accessRequest)
    .orderBy(desc(accessRequest.requestedAt));

  return result;
}

export async function getAccessRequestById(id: string): Promise<AccessRequest | undefined> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db
    .select()
    .from(accessRequest)
    .where(eq(accessRequest.id, id))
    .limit(1);

  return result[0];
}

export async function getAccessRequestByEmail(email: string): Promise<AccessRequest | undefined> {
  const result = await db
    .select()
    .from(accessRequest)
    .where(eq(accessRequest.email, email))
    .limit(1);

  return result[0];
}

export async function createAccessRequest(data: {
  id: string;
  email: string;
  name: string;
  reason?: string;
}): Promise<AccessRequest> {
  // Check if request already exists for this email
  const existingRequest = await getAccessRequestByEmail(data.email);
  if (existingRequest) {
    throw new Error("Access request already exists for this email");
  }

  const result = await db.insert(accessRequest).values(data).returning();

  if (!result[0]) {
    throw new Error("Failed to create access request");
  }
  
  return result[0];
}

export async function updateAccessRequest(
  id: string,
  data: Partial<{
    status: "PENDING" | "APPROVED" | "REJECTED";
    reviewedAt: Date;
    reviewedBy: string;
    notes: string;
  }>
): Promise<AccessRequest> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db
    .update(accessRequest)
    .set(data)
    .where(eq(accessRequest.id, id))
    .returning();

  if (!result[0]) {
    throw new Error("Failed to update access request");
  }

  return result[0];
}

export async function approveAccessRequest(
  id: string,
  reviewedBy: string,
  notes?: string
): Promise<AccessRequest> {
  return updateAccessRequest(id, {
    status: "APPROVED",
    reviewedAt: new Date(),
    reviewedBy,
    notes,
  });
}

export async function rejectAccessRequest(
  id: string,
  reviewedBy: string,
  notes?: string
): Promise<AccessRequest> {
  return updateAccessRequest(id, {
    status: "REJECTED",
    reviewedAt: new Date(),
    reviewedBy,
    notes,
  });
}

export async function deleteAccessRequest(id: string): Promise<AccessRequest> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db.delete(accessRequest).where(eq(accessRequest.id, id)).returning();
  
  if (!result[0]) {
    throw new Error("Failed to delete access request");
  }

  return result[0];
}

export async function getPendingAccessRequests(): Promise<AccessRequest[]> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db
    .select()
    .from(accessRequest)
    .where(eq(accessRequest.status, "PENDING"))
    .orderBy(desc(accessRequest.requestedAt));

  return result;
}

export async function getAllUsers() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    .from(user)
    .orderBy(asc(user.name));

  return result;
}

export async function handleApproveRequest(requestId: string, notes?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await approveAccessRequest(requestId, session.user.id, notes);
  return result;
}

export async function handleRejectRequest(requestId: string, notes?: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    redirect("/");
  }

  const result = await rejectAccessRequest(requestId, session.user.id, notes);
  return result;
} 
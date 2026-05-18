import type { Role } from "@/lib/constants";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      employeeId: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
    employeeId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    employeeId: string | null;
  }
}

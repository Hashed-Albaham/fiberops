export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  localAdminUsername: process.env.LOCAL_ADMIN_USERNAME ?? "",
  localAdminPassword: process.env.LOCAL_ADMIN_PASSWORD ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
};

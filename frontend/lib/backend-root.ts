export function getBackendRoot(): string {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/api\/?$/, "");
}

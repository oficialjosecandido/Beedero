import { AppColumnHeader } from "@/components/AppColumnHeader";
import { AppRightColumn } from "@/components/AppRightColumn";
import { ProfileColumn } from "@/components/ProfileColumn";
import { loadAppShellData } from "@/lib/app-shell-data";

export async function AppShellLayout({
  label,
  children,
  showMessagesInSidebar = true,
}: {
  label: string;
  children: React.ReactNode;
  showMessagesInSidebar?: boolean;
}) {
  const { me, orgs, events, stats, orgNews } = await loadAppShellData();

  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8">
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-1 lg:order-none">
          <ProfileColumn me={me} orgs={orgs} events={events} stats={stats} />
        </div>

        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none lg:gap-6">
          <div className="hidden lg:block">
            <AppColumnHeader label={label} />
          </div>
          {children}
        </div>

        <div className="order-3 lg:order-none">
          <AppRightColumn updates={orgNews} showMessages={showMessagesInSidebar} />
        </div>
      </div>
    </main>
  );
}

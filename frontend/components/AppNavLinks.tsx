"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FaBriefcase, FaHome, FaSearch } from "react-icons/fa";

function navLinkClass(active: boolean, mobile = false) {
  if (mobile) {
    return `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-beedero-yellow hover:text-beedero-black ${
      active ? "bg-beedero-yellow text-beedero-black" : "text-beedero-black/70"
    }`;
  }
  return `rounded-full p-2.5 hover:bg-beedero-black/10 ${
    active ? "bg-beedero-black/10 text-beedero-black" : "text-beedero-black/65 hover:text-beedero-black"
  }`;
}

function FeedIcon({ className = "size-5" }: { className?: string }) {
  return <FaHome className={className} aria-hidden />;
}

function DiscoverIcon({ className = "size-5" }: { className?: string }) {
  return <FaSearch className={className} aria-hidden />;
}

function JobsIcon({ className = "size-5" }: { className?: string }) {
  return <FaBriefcase className={className} aria-hidden />;
}

export function DesktopAppNavLinks() {
  const pathname = usePathname();
  const feedActive = pathname.startsWith("/feed");
  const discoverActive = pathname.startsWith("/discovery");
  const jobsActive = pathname.startsWith("/jobs");
  const dashboardActive = pathname.startsWith("/dashboard");

  return (
    <>
      <Link
        href="/feed"
        className={navLinkClass(feedActive)}
        aria-label="Feed"
        aria-current={feedActive ? "page" : undefined}
      >
        <FeedIcon />
      </Link>
      <Link
        href="/discovery"
        className={navLinkClass(discoverActive)}
        aria-label="Discover"
        aria-current={discoverActive ? "page" : undefined}
      >
        <DiscoverIcon />
      </Link>
      <Link
        href="/jobs"
        className={navLinkClass(jobsActive)}
        aria-label="Jobs"
        aria-current={jobsActive ? "page" : undefined}
      >
        <JobsIcon />
      </Link>
      <Link
        href="/dashboard"
        className={`rounded-full px-4 py-2 text-sm font-semibold hover:bg-beedero-black/10 ${
          dashboardActive
            ? "bg-beedero-black/10 text-beedero-black"
            : "text-beedero-black/80 hover:text-beedero-black"
        }`}
        aria-current={dashboardActive ? "page" : undefined}
      >
        Dashboard
      </Link>
    </>
  );
}

export function MobileAppNavLinks() {
  const pathname = usePathname();
  const feedActive = pathname.startsWith("/feed");
  const discoverActive = pathname.startsWith("/discovery");
  const jobsActive = pathname.startsWith("/jobs");
  const dashboardActive = pathname.startsWith("/dashboard");

  return (
    <>
      <Link
        href="/feed"
        className={navLinkClass(feedActive, true)}
        aria-label="Feed"
        aria-current={feedActive ? "page" : undefined}
      >
        <FeedIcon />
        <span>Feed</span>
      </Link>
      <Link
        href="/discovery"
        className={navLinkClass(discoverActive, true)}
        aria-label="Discover"
        aria-current={discoverActive ? "page" : undefined}
      >
        <DiscoverIcon />
        <span>Discover</span>
      </Link>
      <Link
        href="/jobs"
        className={navLinkClass(jobsActive, true)}
        aria-label="Jobs"
        aria-current={jobsActive ? "page" : undefined}
      >
        <JobsIcon />
        <span>Jobs</span>
      </Link>
      <Link
        href="/dashboard"
        className={navLinkClass(dashboardActive, true)}
        aria-current={dashboardActive ? "page" : undefined}
      >
        Dashboard
      </Link>
    </>
  );
}

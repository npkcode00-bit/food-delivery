// app/page.jsx
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/auth';

import Hero from './components/layout/Hero';
import HomeMenu from './components/layout/HomeMenu';
import SectionHeaders from './components/layout/SectionHeaders';

export default async function Home() {
  const session = await getServerSession(authOptions);

  const role = session?.user?.role; // 'admin' | 'cashier' | 'accounting' | 'customer' | undefined
  const isPrivileged = ['admin', 'cashier', 'accounting'].includes(role);
  if (isPrivileged) redirect('/orders');

  return (
    <section className="relative ">
      {/* Soft wallpaper blobs behind the single window */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-12%] h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-indigo-400 to-blue-600 opacity-30 blur-3xl" />
        <div className="absolute bottom-[-12%] left-8 h-72 w-72 rounded-full bg-gradient-to-br from-rose-400 to-orange-300 opacity-20 blur-3xl" />
        <div className="absolute right-10 top-1/3 h-64 w-64 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 opacity-20 blur-3xl" />
      </div>

      {/* Single mac-style window */}
      <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl ">
       

        {/* Glossy top highlight */}
        <div className="pointer-events-none relative">
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
        </div>

        {/* Window content */}
        <div className="px-6 py-10 md:px-12 md:py-14">
          {/* Hero and Best Sellers render "flat" inside this window */}
          <Hero insideBox />

          <div className="mt-10">
            <HomeMenu insideBox />
          </div>

          {/* About */}
          <section className="mx-auto my-16 max-w-3xl text-center" id="about">
            <SectionHeaders subHeader="Our story" mainHeader="About us" />
            <p className="mt-4 text-zinc-600">
              Pngpl Cafe ☕ – A small business coffee shop serving blessed cups with love and
              community. Join us for great coffee, warm fellowship, and a peaceful atmosphere.
            </p>
          </section>

          {/* Contact */}
          <section className="mx-auto my-10 max-w-3xl text-center" id="contact">
            <SectionHeaders subHeader="Don't hesitate" mainHeader="Contact us" />
            <div className="mt-6 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="https://web.facebook.com/profile.php?id=61565188780261"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300/60 bg-white/80 px-6 py-2.5 font-semibold text-zinc-700 backdrop-blur-md transition hover:border-zinc-400 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Pinagpala Cafe on Facebook"
              >
                {/* Facebook icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M22 12.06C22 6.52 17.52 2 12 2S2 6.52 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.62.77-1.62 1.56v1.86h2.76l-.44 2.91h-2.32v7.03C18.34 21.21 22 17.06 22 12.06Z"
                  />
                </svg>
                <span>Pinagpala Cafe</span>
              </a>

              <a
                href="tel:+639693257152"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300/60 bg-white/80 px-6 py-2.5 font-semibold text-zinc-700 backdrop-blur-md transition hover:border-zinc-400 hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/60"
                aria-label="Call Pinagpala Cafe at plus 63 969 325 7152"
              >
                {/* Phone icon */}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.11.37 2.31.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1C11.73 21 3 12.27 3 2a1 1 0 011-1h3.5a1 1 0 011 1c0 1.27.2 2.47.57 3.58a1 1 0 01-.24 1.01l-2.2 2.2z"
                  />
                </svg>
                <span>+63 969 325 7152</span>
              </a>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-14 border-t border-white/50 pt-6 text-center text-sm text-zinc-500">
            © {new Date().getFullYear()} Pinagpala Cafe — All rights reserved
          </footer>
        </div>
      </div>
    </section>
  );
}

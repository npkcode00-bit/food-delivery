import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/auth';

import Header from "./components/layout/Header";
import Hero from "./components/layout/Hero";
import HomeMenu from "./components/layout/HomeMenu";
import SectionHeaders from "./components/layout/SectionHeaders";

export default async function Home() {
  const session = await getServerSession(authOptions);

  // If the logged-in user is an admin, send them straight to /orders
 const role = session?.user?.role;           // 'admin' | 'cashier' | 'accounting' | 'customer' | undefined
const isPrivileged = ['admin', 'cashier', 'accounting'].includes(role);

if (isPrivileged) {
  redirect('/orders');
}

   console.log(session?.user?.role)
  

  return (
    <>
      {/* Header is fine to keep; this page will never render for admins */}
      <Hero />
      <HomeMenu />

      <section className="text-center my-16" id="about">
        <SectionHeaders subHeader="Our story" mainHeader="About us" />
        <div className="text-gray-500 max-w-md mx-auto mt-4 flex flex-col gap-4">
          <p>
            Pngpl Cafe ☕ – A small business coffee shop serving blessed cups with love and community.
            Join us for great coffee, warm fellowship, and a peaceful atmosphere.
          </p>
        </div>
      </section>

      <section className="text-center my-8" id="contact">
        <SectionHeaders subHeader="Don't hesitate" mainHeader="Contact us" />
        <div className="mt-8">
         <a
            href="https://www.facebook.com/profile.php?id=61579343604645"
            className="text-2xl underline text-gray-500 inline-flex items-center gap-2"
            target="_blank"
            rel="noopener noreferrer"
            style={{textDecoration:'none',fontWeight:'bold'}}
            aria-label="Pinagpala Cafe on Facebook"
          >
            {/* Facebook logo */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="1.25em"
              height="1.25em"
              aria-hidden="true"
              color='blue'
            >
              <path
                fill="currentColor"
                d="M22 12.06C22 6.52 17.52 2 12 2S2 6.52 2 12.06c0 5 3.66 9.15 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.5 1.49-3.88 3.77-3.88 1.09 0 2.23.2 2.23.2v2.46h-1.26c-1.24 0-1.62.77-1.62 1.56v1.86h2.76l-.44 2.91h-2.32v7.03C18.34 21.21 22 17.06 22 12.06Z"
              />
            </svg>

            <span>Pinagpala Cafe</span>
          </a>

        </div>
      </section>
    </>
  );
}
